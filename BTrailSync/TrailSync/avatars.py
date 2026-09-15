"""Validates and re-encodes profile pictures: strips metadata such as GPS, crops to a square and caps the size at 512px."""

from __future__ import annotations

import io

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
OUTPUT_SIZE = 512

# A small file can still decode to an enormous bitmap; this cap is far above any real photo.
MAX_PIXELS = 40_000_000


class AvatarRejected(ValueError):
    """The upload is not an image we will store. Message is student-facing."""


def process_avatar(uploaded) -> ContentFile:
    """Validate an uploaded file and return a normalised square JPEG, or raise AvatarRejected."""
    size = getattr(uploaded, "size", None)
    if size is None or size <= 0:
        raise AvatarRejected("That file is empty.")
    if size > MAX_UPLOAD_BYTES:
        raise AvatarRejected(
            f"That image is {size / (1024 * 1024):.1f} MB. The limit is "
            f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
        )

    raw = uploaded.read()

    # Identify by content, never by the client-controlled filename or content type.
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

    # Apply the orientation flag before metadata is dropped, or portrait photos come out sideways.
    img = ImageOps.exif_transpose(img)

    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side))
    if side > OUTPUT_SIZE:
        img = img.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)

    # JPEG has no alpha: flatten transparent images onto white rather than black.
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
