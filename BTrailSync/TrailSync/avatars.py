"""Server-side validation and normalisation for student profile pictures.

Everything the upload endpoint accepts passes through process_avatar(), which
re-checks what the browser already checked and then re-encodes the image.
The client's checks are a courtesy for the student; this is the control,
since the endpoint can be called directly with any bytes at all.

WHY RE-ENCODE RATHER THAN STORE THE UPLOAD AS-IS
- Metadata. Photos straight off a phone carry EXIF, and EXIF routinely
  includes GPS coordinates - for a student photographing themselves at home,
  that is their home address, served from a public media URL. Decoding to
  pixels and writing a fresh JPEG leaves every metadata block behind.
- Trust. A file whose extension says .png and whose magic bytes say PNG can
  still carry a trailing payload. Only pixels survive a re-encode.
- Consistency. The client centre-crops to a square, but a direct API call
  need not. Cropping again here means every stored avatar is square, so
  circles never stretch, whoever uploaded it and however.
- Size. Output is capped at 512x512, a few tens of KB, regardless of the
  upload - a 5 MB original is not what a 34px sidebar circle should load.
"""

from __future__ import annotations

import io

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
OUTPUT_SIZE = 512

# A small file can still decode to an enormous bitmap (a 5 MB PNG of one flat
# colour can claim tens of thousands of pixels a side). Pillow's own guard
# only fires near 90 MP; this is far lower, and far above any real photo.
MAX_PIXELS = 40_000_000


class AvatarRejected(ValueError):
    """The upload is not an image we will store. Message is student-facing."""


def process_avatar(uploaded) -> ContentFile:
    """Validate an uploaded file and return a normalised square JPEG.

    Raises AvatarRejected with a message fit to show the student.
    """
    size = getattr(uploaded, "size", None)
    if size is None or size <= 0:
        raise AvatarRejected("That file is empty.")
    if size > MAX_UPLOAD_BYTES:
        raise AvatarRejected(
            f"That image is {size / (1024 * 1024):.1f} MB. The limit is "
            f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
        )

    raw = uploaded.read()

    # Identify by content, never by the filename or the declared content type,
    # both of which the client controls.
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            fmt = probe.format
            width, height = probe.size
            probe.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        raise AvatarRejected("That file isn't a readable image. Use a JPEG, PNG, or WebP.")

    if fmt not in ALLOWED_FORMATS:
        raise AvatarRejected(f"{fmt or 'That'} images aren't supported. Use a JPEG, PNG, or WebP.")
    if width * height > MAX_PIXELS:
        raise AvatarRejected("That image's dimensions are too large. Try a smaller photo.")

    # verify() leaves the image unusable, so decode again for real.
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (OSError, Image.DecompressionBombError):
        raise AvatarRejected("That image couldn't be decoded. Try exporting it again.")

    # Honour the orientation flag before the metadata is thrown away, or
    # portrait phone photos come out lying on their side.
    img = ImageOps.exif_transpose(img)

    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side))
    if side > OUTPUT_SIZE:
        img = img.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)

    # JPEG has no alpha. Flatten transparent PNG/WebP onto white rather than
    # letting the conversion default to black behind the subject.
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        backdrop = Image.new("RGB", rgba.size, (255, 255, 255))
        backdrop.paste(rgba, mask=rgba.getchannel("A"))
        img = backdrop
    else:
        img = img.convert("RGB")

    out = io.BytesIO()
    # No exif= argument: nothing from the original is carried across.
    img.save(out, format="JPEG", quality=88, optimize=True, progressive=True)
    return ContentFile(out.getvalue(), name="avatar.jpg")
