"""Build the fillable PDF templates the app fills by field name: the official form and the claim stub.

One-time setup, re-runnable. It writes into TrailSync/assets/templates/:

- Request_of_Credentials_Form_2023_fillable.pdf: the university's own FM-USTP-RGTR-09 page with an AcroForm field
  over each blank. Its drawing is untouched except for the fees printed in Part 2 ("(P125/pg)" and the like), which
  are cut out of the page's text and replaced by fields, so the form always shows the current fees. The positions
  below were measured from that exact page, which is why the original is SHA-256 pinned.
- Claim_Stub_fillable.pdf: TrailSync's claim stub card, drawn here, with a field where each value goes.

The written PDFs are the masters. pdf_forms.py fills them by name and never sees a coordinate, and a field can be
nudged in any PDF editor. Re-running this overwrites such edits, so run it only when the university issues a new
revision of the form or the claim stub's design changes.
"""

from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    ByteStringObject,
    ContentStream,
    DictionaryObject,
    FloatObject,
    NameObject,
    NumberObject,
    StreamObject,
    TextStringObject,
)

from TrailSync.pdf_forms import PRICE_CHARS, PRICE_FONT
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas

ASSET_DIR = Path(__file__).resolve().parents[2] / "assets"
TEMPLATE_DIR = ASSET_DIR / "templates"
FONT_DIR = ASSET_DIR / "fonts"
LOGO_PATH = ASSET_DIR / "trailsync-logo.png"

ORIGINAL_FORM = TEMPLATE_DIR / "FM-USTP-RGTR-09.pdf"
ORIGINAL_FORM_SHA256 = "3d21a47d645bde0d0be7b9036bdfb32f0615418cc90428f0d15f309ad4768320"
FORM_OUT = TEMPLATE_DIR / "Request_of_Credentials_Form_2023_fillable.pdf"
STUB_OUT = TEMPLATE_DIR / "Claim_Stub_fillable.pdf"

INK = (0.063, 0.078, 0.094)  # #101418
FOOTER_GREY = (0.357, 0.392, 0.455)  # #5B6474
LABEL_GREY = (0.110, 0.110, 0.110)  # the grey the form prints its Part 2 labels in
# Arial, so the prices match the labels they sit in; any Arial-compatible face with a peso sign will do.
DEFAULT_PRICE_FONT_FILE = Path(r"C:\Windows\Fonts\arial.ttf")

# Field text uses the PDF standard fonts, which every viewer has, so nothing needs embedding. Ascents are from their
# AFM metrics: pypdf centres a single line on the ascent, so the box is placed to put the baseline where it belongs.
FIELD_FONTS = {
    "/Helv": ("Helvetica", 718),
    "/HeBo": ("Helvetica-Bold", 718),
    "/TiBo": ("Times-Bold", 683),
}
# pypdf starts a field's text 2pt in from its left edge and clips 4pt before the right; the box allows for both.
TEXT_INSET_LEFT = 2.0
TEXT_INSET_RIGHT = 4.0
TICK_BOX = 9.0


@dataclass(frozen=True)
class Text:
    name: str
    x: float  # where the first character starts
    baseline: float
    width: float  # the room before the next printed element
    size: float
    font: str = "/Helv"
    color: tuple = INK
    tooltip: str = ""


@dataclass(frozen=True)
class Check:
    name: str
    x: float  # the tick's lower-left corner
    y: float
    tooltip: str = ""


# ---- The official form ------------------------------------------------------------------------------------------
# Text blanks: where each underscore run starts, and the width before the next printed element.
FORM_TEXT = [
    Text("signature_over_printed_name", 175.1, 727.0, 170.0, 9.0, tooltip="Student's full name"),
    Text("course", 391.0, 727.0, 54.0, 8.0, tooltip="Course, abbreviated when long"),
    Text("date_of_request", 534.7, 727.0, 42.0, 7.5),
    Text("birth_date", 80.3, 708.0, 66.0, 8.0),
    Text("contact_no", 349.3, 589.5, 79.0, 8.0),
    Text("date_of_graduation", 217.2, 567.3, 98.0, 8.0),
    Text("last_semester_sy", 285.0, 555.4, 108.0, 8.0),
    Text("previously_requested_document", 259.0, 533.2, 129.0, 7.0),
    Text("previously_requested_date", 470.5, 533.2, 59.0, 7.0),
    Text("cav_others_specify", 289.0, 397.1, 49.0, 7.0),
    Text("cert_others_specify", 492.0, 373.7, 74.0, 7.0),
    Text("inc_semester_taken", 447.0, 322.8, 75.0, 7.0),
    Text("inc_subject_code", 410.0, 310.9, 139.0, 8.0),
    Text("purpose_others_specify", 130.0, 287.2, 149.0, 8.0),
    Text("verified_by", 74.0, 237.3, 126.0, 8.5, tooltip="Front Desk; left for a signature"),
    Text("approved_by_name", 290.8, 220.1, 138.0, 8.5, tooltip="Registrar staff who approved it in TrailSync"),
    Text("amount", 75.0, 169.8, 49.0, 8.5, tooltip="Current fee until payment is logged, then the locked amount"),
    Text("or_number", 185.2, 169.8, 59.0, 8.5),
    Text("payment_date", 316.3, 169.8, 49.0, 8.5),
    Text("date_of_release", 468.1, 169.8, 84.0, 8.5),
    Text("stub_name", 62.6, 83.2, 164.0, 8.0),
    Text("stub_course", 291.8, 83.2, 59.0, 7.0),
    Text("stub_date_of_request", 481.7, 83.2, 89.0, 8.0),
    Text("stub_credential_requested", 152.8, 67.7, 144.0, 8.0),
    Text("stub_date_of_release", 480.6, 67.7, 89.0, 8.0),
    Text("stub_assessed_by", 399.6, 43.9, 54.0, 6.5),
    Text("stub_or_number", 502.2, 43.9, 74.0, 7.0),
    # The paper form has no box for the tracking number or the fee's working, so they go in the bottom margin.
    Text("footer_note", 27.0, 14.0, 541.32, 5.8, color=FOOTER_GREY, tooltip="TrailSync tracking line"),
]

FORM_CHECKS = [
    Check("classification_student", 153.0, 708.9),
    Check("classification_alumnus", 342.0, 708.9),
    Check("already_requested_yes", 268.2, 543.9),
    Check("already_requested_no", 316.0, 543.9),
    Check("cleared_yes", 76.6, 511.5),
    Check("cleared_no", 77.5, 499.7),
    # Part 2: the "____" before each document name.
    Check("doc_certification", 359.0, 469.0),
    Check("doc_diploma_replacement", 35.0, 455.7),
    Check("doc_form_137", 194.0, 455.7),
    Check("doc_evaluation", 35.0, 443.9),
    Check("doc_authentication", 194.0, 443.9),
    Check("doc_honorable_dismissal", 35.0, 432.3),
    Check("doc_cav_certification", 194.4, 432.3),
    Check("doc_correction_of_name", 35.0, 420.5),
    Check("doc_transcript_of_records", 35.0, 408.7),
    Check("doc_permit_to_study", 35.0, 397.1),
    Check("doc_rush_fee", 35.0, 385.3),
    # CAV Certification: the agency it goes through.
    Check("cav_dfa", 196.6, 420.9),
    Check("cav_ched", 244.4, 420.9),
    Check("cav_dep_ed", 294.7, 420.9),
    Check("cav_pnp", 195.6, 409.1),
    Check("cav_poea", 244.0, 409.1),
    Check("cav_bfp", 293.8, 409.1),
    Check("cav_bjmp", 196.1, 397.5),
    Check("cav_others", 244.9, 397.5),
    # Certification sub-types.
    Check("cert_car", 359.0, 456.1),
    Check("cert_letter_of_no_objection", 467.0, 456.1),
    Check("cert_gpa", 359.0, 444.4),
    Check("cert_graduated", 467.0, 444.4),
    Check("cert_endorsement", 359.0, 432.7),
    Check("cert_earned_units", 467.0, 432.7),
    Check("cert_officially_enrolled", 359.0, 421.0),
    Check("cert_grading_system", 467.0, 421.0),
    Check("cert_subjects_enrolled", 359.0, 409.2),
    Check("cert_subjects_with_grades", 467.0, 409.2),
    Check("cert_ustp_conversion", 359.0, 397.6),
    Check("cert_english_medium_of_instruction", 359.0, 385.8),
    Check("cert_others", 492.0, 385.8),
    Check("cert_authorization_letter", 359.0, 374.2),
    # Part 3: the "____" before each purpose. Completion of INC has no printed line on this revision of the form, so
    # its tick and its two answers sit in the empty right-hand column, where they always have.
    Check("purpose_evaluation", 40.0, 334.7),
    Check("purpose_employment", 179.0, 334.7),
    Check("purpose_completion_of_inc", 323.0, 334.7),
    Check("purpose_scholarship", 40.0, 322.8),
    Check("purpose_personal_file", 179.0, 322.8),
    Check("purpose_passport", 40.0, 310.9),
    Check("purpose_advanced_studies", 179.0, 310.9),
    Check("purpose_board_exam", 40.0, 299.1),
    Check("purpose_ranking", 179.0, 299.1),
    Check("purpose_others", 40.0, 287.2),
]

# Part 2's fees, which the paper form prints after each document ("(P125/pg)"). They are cut out of the page's text
# (see cut_printed_prices) and these fields take their place, filled with the current fee every time. Each starts where
# the printed fee's "(" did, in the labels' size and grey; the width runs to the next printed element on the line.
PRICE_FIELDS = [
    Text("price_certification", 431.29, 468.84, 130.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_diploma_replacement", 148.28, 455.52, 42.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_form_137", 257.32, 455.52, 97.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_evaluation", 101.80, 443.76, 88.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_authentication", 275.77, 443.76, 79.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_honorable_dismissal", 142.23, 432.12, 48.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_cav_certification", 308.40, 432.12, 47.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_correction_of_name", 137.76, 420.36, 55.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_transcript_of_records", 145.71, 408.60, 46.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_permit_to_study", 121.21, 396.96, 71.0, 9.0, PRICE_FONT, LABEL_GREY),
    Text("price_rush_fee", 98.84, 385.20, 95.0, 9.0, PRICE_FONT, LABEL_GREY),
]
# What the 2023 revision prints, in page order. Cutting anything else means the page isn't the one measured.
PRINTED_PRICES = [
    "(P80)", "(P100)", "(P100)", "(P50)", "(P5/pg)", "(P100)", "(P125)", "(P100)", "(P125/pg)", "(P100)", "(P100)",
]
PRICE_BAND = (380.0, 475.0)  # Part 2's lines, in points from the bottom of the page
_PRICE_START = re.compile(r"\(P\d")


# ---- Part 2's printed fees ------------------------------------------------------------------------------------------
def _decoded(element) -> str:
    """A shown string's text. Part 2's labels are Arial with WinAnsi encoding, so their bytes are their characters."""
    return element.get_original_bytes().decode("latin-1") if hasattr(element, "get_original_bytes") else ""


def cut_printed_prices(writer: PdfWriter) -> list[str]:
    """Remove Part 2's printed fees from the page's text, leaving the price fields as the only prices on it.

    Each fee is the tail of its line's text, "____ Transcript of Records (P125/pg)", so cutting where "(P" starts leaves
    every glyph before it exactly where it was. It is removed from the text itself, not covered up, so copying or
    searching the form can't turn up the old fee either. Returns what was cut, in page order.
    """
    page = writer.pages[0]
    content = ContentStream(page.get_contents(), writer)
    cut: list[str] = []
    tm_y = None
    open_fee = None  # (index in cut, baseline) of a fee whose ")" is drawn separately, as Certification's is
    for operands, op in content.operations:
        if op == b"Tm":
            tm_y = float(operands[5])
        if op not in (b"TJ", b"Tj") or tm_y is None or not PRICE_BAND[0] < tm_y < PRICE_BAND[1]:
            continue
        parts = list(operands[0]) if op == b"TJ" else [operands[0]]
        text = "".join(_decoded(part) for part in parts)
        if open_fee is not None and text == ")" and tm_y == open_fee[1]:
            cut[open_fee[0]] += ")"
            operands[0] = ArrayObject() if op == b"TJ" else ByteStringObject(b"")
            open_fee = None
            continue
        starts = [m.start() for m in _PRICE_START.finditer(text)]
        if not starts:
            continue
        start = starts[-1]
        kept, seen = [], 0
        for part in parts:
            chars = _decoded(part)
            if not hasattr(part, "get_original_bytes"):
                kept.append(part)  # a kerning adjustment before the fee
                continue
            if seen + len(chars) <= start:
                kept.append(part)
                seen += len(chars)
                continue
            head = part.get_original_bytes()[: start - seen]
            if head:
                kept.append(ByteStringObject(head))
            break
        if op == b"TJ":
            operands[0] = ArrayObject(kept)
        else:
            operands[0] = kept[0] if kept else ByteStringObject(b"")
        cut.append(text[start:])
        if not text.endswith(")"):
            open_fee = (len(cut) - 1, tm_y)
    page.replace_contents(content)
    page.compress_content_streams()
    return cut


def price_font(writer: PdfWriter, font_file: Path):
    """An Arial subset holding exactly PRICE_CHARS, embedded for the price fields. Returns (reference, ascent)."""
    if not font_file.exists():
        raise CommandError(
            f"No price font at {font_file}. Pass --price-font with an Arial-compatible TrueType font that has a peso sign."
        )
    pdfmetrics.registerFont(TTFont("TS-Price", str(font_file)))
    lacking = [ch for ch in PRICE_CHARS if ord(ch) not in pdfmetrics.getFont("TS-Price").face.charToGlyph]
    if lacking:
        raise CommandError(f"{font_file.name} has no glyph for {''.join(lacking)!r}.")
    # ReportLab embeds just the glyphs a page uses, so drawing the characters once produces the subset.
    buffer = io.BytesIO()
    c = pdfcanvas.Canvas(buffer, pagesize=(200, 20))
    c.setFont("TS-Price", 9)
    c.drawString(0, 5, PRICE_CHARS)
    c.save()
    fonts = PdfReader(io.BytesIO(buffer.getvalue())).pages[0]["/Resources"]["/Font"]
    subset = next(ref.get_object() for ref in fonts.values() if ref.get_object()["/Subtype"] == "/TrueType")
    return writer._add_object(subset.clone(writer)), float(subset["/FontDescriptor"]["/Ascent"])


# ---- Widgets ------------------------------------------------------------------------------------------------------
def _rgb(color):
    return " ".join(f"{c:.3f}" for c in color)


def _text_widget(spec: Text, page_ref, ascents) -> DictionaryObject:
    ascent = ascents[spec.font]
    # Tall enough for descenders, and placed so pypdf's vertical centring lands the baseline on spec.baseline.
    height = round(spec.size * 1.5, 3)
    bottom = spec.baseline - (height - ascent * spec.size / 1000) / 2
    left = spec.x - TEXT_INSET_LEFT
    right = spec.x + spec.width + TEXT_INSET_RIGHT
    widget = DictionaryObject({
        NameObject("/Type"): NameObject("/Annot"),
        NameObject("/Subtype"): NameObject("/Widget"),
        NameObject("/FT"): NameObject("/Tx"),
        NameObject("/T"): TextStringObject(spec.name),
        NameObject("/Rect"): ArrayObject([FloatObject(round(v, 3)) for v in (left, bottom, right, bottom + height)]),
        NameObject("/F"): NumberObject(4),  # print
        NameObject("/P"): page_ref,
        NameObject("/DA"): TextStringObject(f"{spec.font} {spec.size:g} Tf {_rgb(spec.color)} rg"),
        # No border, so pypdf applies no border margin and the box adds nothing to the printed page.
        NameObject("/BS"): DictionaryObject({NameObject("/W"): NumberObject(0), NameObject("/S"): NameObject("/S")}),
        NameObject("/MK"): DictionaryObject(),
        NameObject("/Q"): NumberObject(0),
    })
    if spec.tooltip:
        widget[NameObject("/TU")] = TextStringObject(spec.tooltip)
    return widget


def _tick_streams(writer):
    """The checked and unchecked looks, shared by every checkbox: a drawn tick, so no font is needed to show it."""
    def stream(data):
        s = StreamObject()
        s.update({
            NameObject("/Type"): NameObject("/XObject"),
            NameObject("/Subtype"): NameObject("/Form"),
            NameObject("/BBox"): ArrayObject([FloatObject(0), FloatObject(0), FloatObject(TICK_BOX), FloatObject(TICK_BOX)]),
            NameObject("/Resources"): DictionaryObject(),
        })
        s.set_data(data.encode())
        return writer._add_object(s)

    tick = f"q {_rgb(INK)} RG 0.95 w 1 J 1 j 2.15 4.15 m 3.65 2.05 l 7.35 7.55 l S Q"
    return stream(tick), stream("")


def _check_widget(spec: Check, page_ref, on_ref, off_ref) -> DictionaryObject:
    widget = DictionaryObject({
        NameObject("/Type"): NameObject("/Annot"),
        NameObject("/Subtype"): NameObject("/Widget"),
        NameObject("/FT"): NameObject("/Btn"),
        NameObject("/T"): TextStringObject(spec.name),
        NameObject("/Rect"): ArrayObject(
            [FloatObject(v) for v in (spec.x, spec.y, spec.x + TICK_BOX, spec.y + TICK_BOX)]
        ),
        NameObject("/F"): NumberObject(4),
        NameObject("/P"): page_ref,
        NameObject("/V"): NameObject("/Off"),
        NameObject("/AS"): NameObject("/Off"),
        # For an editor that redraws the box itself: ZapfDingbats "4" is the standard tick.
        NameObject("/DA"): TextStringObject("/ZaDb 0 Tf 0 g"),
        NameObject("/MK"): DictionaryObject({NameObject("/CA"): TextStringObject("4")}),
        NameObject("/BS"): DictionaryObject({NameObject("/W"): NumberObject(0), NameObject("/S"): NameObject("/S")}),
        NameObject("/AP"): DictionaryObject({
            NameObject("/N"): DictionaryObject({NameObject("/Yes"): on_ref, NameObject("/Off"): off_ref}),
        }),
    })
    if spec.tooltip:
        widget[NameObject("/TU")] = TextStringObject(spec.tooltip)
    return widget


def _font_resources(writer, embedded):
    def standard(base_font, encoding=True):
        font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject(base_font),
        })
        if encoding:
            font[NameObject("/Encoding")] = NameObject("/WinAnsiEncoding")
        return writer._add_object(font)

    fonts = {name: standard(f"/{base}") for name, (base, _) in FIELD_FONTS.items()}
    fonts["/ZaDb"] = standard("/ZapfDingbats", encoding=False)
    fonts.update({name: ref for name, (ref, _) in embedded.items()})
    return DictionaryObject({NameObject(k): v for k, v in fonts.items()})


def add_fields(writer: PdfWriter, texts, checks, embedded=None) -> bytes:
    """The writer's single page with an AcroForm field for each spec. embedded maps a font resource name to the
    (reference, ascent) of a font the build embedded, for fields the standard fonts can't print."""
    embedded = embedded or {}
    names = [s.name for s in [*texts, *checks]]
    duplicates = {n for n in names if names.count(n) > 1}
    if duplicates:
        raise CommandError(f"Duplicate field names: {', '.join(sorted(duplicates))}")

    ascents = {name: ascent for name, (_, ascent) in FIELD_FONTS.items()}
    ascents.update({name: ascent for name, (_, ascent) in embedded.items()})
    page = writer.pages[0]
    page_ref = page.indirect_reference
    on_ref, off_ref = _tick_streams(writer)

    # Flattening appends each filled value to the page's contents. With a single content stream pypdf rewrites the
    # whole page for every field (an 11 MB form); as an array it just adds a small stream. The drawing is unchanged.
    contents = page.raw_get("/Contents")
    if not isinstance(contents.get_object(), ArrayObject):
        page[NameObject("/Contents")] = ArrayObject([contents])

    widgets = [_text_widget(s, page_ref, ascents) for s in texts] + [_check_widget(s, page_ref, on_ref, off_ref) for s in checks]
    refs = [writer._add_object(w) for w in widgets]
    annots = page.get("/Annots")
    if annots is None:
        page[NameObject("/Annots")] = ArrayObject(refs)
    else:
        annots.get_object().extend(refs)

    writer.root_object[NameObject("/AcroForm")] = writer._add_object(DictionaryObject({
        NameObject("/Fields"): ArrayObject(refs),
        NameObject("/DR"): DictionaryObject({NameObject("/Font"): _font_resources(writer, embedded)}),
        NameObject("/DA"): TextStringObject("/Helv 0 Tf 0 g"),
    }))
    # Drop what editing left unreferenced, such as the page's original content stream.
    writer.compress_identical_objects(remove_identicals=False, remove_orphans=True)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# ---- The claim stub's design ----------------------------------------------------------------------------------------
STUB_BLUE = colors.HexColor("#24406B")
STUB_GOLD = colors.HexColor("#B8872B")
STUB_BLACK = colors.HexColor("#111111")
STUB_GREY = colors.HexColor("#6B7280")
STUB_HAIRLINE = colors.HexColor("#9CA3AF")
MIDDOT = "·"
SCISSORS = "✂"
DOC_CODE = "FM-USTP-RGTR-09"
DOC_REVISION = "00"
DOC_EFFECTIVE = "10.01.21"
RELEASING_TIME_NOTICE = "RELEASING TIME is from 3:00 to 5:00 in the afternoon."
CLAIM_STUB_INSTRUCTION = (
    "Present this stub with a valid ID to claim your document at Window 6. "
    "If someone else is claiming on your behalf, they must also bring a "
    "notarized authorization letter and both parties' valid IDs. "
    "If this stub is lost, a valid ID must be presented instead."
)


def _stub_fonts():
    """The bundled DejaVu faces for the card's printed labels (the filled values use the standard fonts)."""
    faces = {
        "TS-Sans": "DejaVuSans.ttf",
        "TS-Sans-Bold": "DejaVuSans-Bold.ttf",
        "TS-Serif": "DejaVuSerif.ttf",
        "TS-Serif-Bold": "DejaVuSerif-Bold.ttf",
    }
    for name, filename in faces.items():
        pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))
    return {"sans": "TS-Sans", "sans_bold": "TS-Sans-Bold", "serif": "TS-Serif", "serif_bold": "TS-Serif-Bold"}


def _caps(c, x, y, text, font, size, color, spacing=0.8):
    """Letterspaced small caps via a text object, the only place ReportLab exposes character spacing."""
    obj = c.beginText(x, y)
    obj.setFont(font, size)
    obj.setFillColor(color)
    obj.setCharSpace(spacing)
    obj.textOut(text.upper())
    # Reset before emitting: character spacing persists past ET and would shift later right-aligned strings.
    obj.setCharSpace(0)
    c.drawText(obj)


def _wrap(text, font, size, max_width):
    words = (text or "").split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and pdfmetrics.stringWidth(candidate, font, size) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def _doc_control_box(c, right_x, top_y, fonts):
    """The form-control table from the official form's top corner."""
    w, row1, row2 = 152.0, 12.0, 11.0
    h = row1 + row2 + 12
    x = right_x - w
    c.setStrokeColor(STUB_BLACK)
    c.setLineWidth(0.7)
    c.rect(x, top_y - h, w, h, stroke=1, fill=0)
    c.setFillColor(STUB_BLUE)
    c.rect(x, top_y - row1, w, row1, stroke=0, fill=1)
    _caps(c, x + 4, top_y - row1 + 3.5, "Document Code No.", fonts["sans_bold"], 5.8, colors.white, spacing=0.4)
    c.setFillColor(STUB_BLACK)
    c.setFont(fonts["sans_bold"], 9)
    c.drawCentredString(x + w / 2, top_y - row1 - 10, DOC_CODE)
    divider_y = top_y - row1 - 14
    c.setStrokeColor(STUB_BLACK)
    c.setLineWidth(0.5)
    c.line(x, divider_y, x + w, divider_y)
    thirds = w / 3
    for i in (1, 2):
        c.line(x + thirds * i, divider_y, x + thirds * i, top_y - h)
    for i, (label, value) in enumerate(zip(("Rev. No.", "Effective Date", "Page No."), (DOC_REVISION, DOC_EFFECTIVE, "1 of 1"))):
        cx = x + thirds * i + thirds / 2
        c.setFillColor(STUB_GREY)
        c.setFont(fonts["sans"], 5.4)
        c.drawCentredString(cx, divider_y - 7, label)
        c.setFillColor(STUB_BLACK)
        c.setFont(fonts["sans_bold"], 6.8)
        c.drawCentredString(cx, divider_y - 16, value)


def draw_claim_stub() -> tuple[bytes, list[Text]]:
    """The claim stub's printed design on an A4 page, and a field spec wherever a value goes."""
    fonts = _stub_fonts()
    page_w, page_h = A4
    margin = 42.0
    content_w = page_w - 2 * margin
    left, right = margin, page_w - margin
    fields: list[Text] = []

    buffer = io.BytesIO()
    c = pdfcanvas.Canvas(buffer, pagesize=A4)
    c.setTitle("TrailSync Claim Stub (fillable template)")
    c.setAuthor("USTP-CDO Office of the Registrar")
    c.setSubject("Claim Stub")

    y = page_h - margin
    c.setFillColor(STUB_BLUE)
    c.rect(left, y - 3.5, content_w, 3.5, stroke=0, fill=1)
    y -= 3.5 + 16

    wordmark_x = left
    if LOGO_PATH.exists():
        c.drawImage(ImageReader(str(LOGO_PATH)), left, y - 24, width=24, height=24, mask="auto",
                    preserveAspectRatio=True, anchor="sw")
        wordmark_x = left + 31
    c.setFillColor(STUB_BLUE)
    c.setFont(fonts["serif_bold"], 17)
    c.drawString(wordmark_x, y - 17, "TrailSync")
    c.setFillColor(STUB_BLACK)
    c.setFont(fonts["sans_bold"], 7.6)
    c.drawString(wordmark_x, y - 28, "University of Science and Technology of Southern Philippines")
    c.setFillColor(STUB_GREY)
    c.setFont(fonts["sans"], 6.8)
    c.drawString(wordmark_x, y - 37, f"Cagayan de Oro {MIDDOT} Office of the Registrar {MIDDOT} Window 6")
    _doc_control_box(c, right, y, fonts)

    y -= 50
    c.setStrokeColor(STUB_GOLD)
    c.setLineWidth(1.1)
    c.line(left, y, right, y)
    y -= 24

    # The card's height follows its wrapped instruction, so no empty band looks like an unfilled field.
    instruction_lines = _wrap(CLAIM_STUB_INSTRUCTION, fonts["sans"], 8, content_w - 40)
    stub_h = 255.0 + len(instruction_lines) * 11 + 14
    stub_top = y
    c.setStrokeColor(STUB_BLACK)
    c.setLineWidth(1.4)
    c.rect(left, stub_top - stub_h, content_w, stub_h, stroke=1, fill=0)
    c.setFillColor(STUB_BLUE)
    c.rect(left, stub_top - 4, content_w, 4, stroke=0, fill=1)

    inner = left + 20
    inner_w = content_w - 40
    cursor = stub_top - 26
    _caps(c, inner, cursor, "Claim Stub", fonts["sans_bold"], 8, STUB_BLUE)
    cursor -= 10
    _caps(c, inner, cursor - 8, "Tracking Number", fonts["sans"], 7, STUB_GREY)
    fields.append(Text("tracking_number", inner, cursor - 36, inner_w, 26.0, "/TiBo", (0.141, 0.251, 0.420)))
    cursor -= 52

    c.setStrokeColor(STUB_HAIRLINE)
    c.setLineWidth(0.6)
    c.line(inner, cursor, right - 20, cursor)
    cursor -= 18

    col_w = (inner_w - 24) / 2
    col2 = inner + col_w + 24

    def labelled(name, x, y_label, label):
        _caps(c, x, y_label, label, fonts["sans"], 6.5, STUB_GREY, spacing=0.7)
        fields.append(Text(name, x, y_label - 11.5, col_w, 9.0, "/HeBo", (0.067, 0.067, 0.067)))
        return y_label - 25

    left_y = right_y = cursor
    left_y = labelled("name", inner, left_y, "Name")
    left_y = labelled("course", inner, left_y, "Course")
    left_y = labelled("date_of_request", inner, left_y, "Date of Request")
    right_y = labelled("credential_requested", col2, right_y, "Credential Requested")
    right_y = labelled("date_of_release", col2, right_y, "Date of Release")
    right_y = labelled("amount_assessed", col2, right_y, "Amount Assessed")
    right_y = labelled("or_number", col2, right_y, "O.R. Number")
    cursor = min(left_y, right_y) - 4

    c.setStrokeColor(STUB_HAIRLINE)
    c.setLineWidth(0.6)
    c.line(inner, cursor, right - 20, cursor)
    cursor -= 16

    notice_h = 17.0
    c.setStrokeColor(STUB_BLACK)
    c.setLineWidth(1.0)
    c.rect(inner, cursor - notice_h + 5, inner_w, notice_h, stroke=1, fill=0)
    c.setFillColor(STUB_BLACK)
    c.setFont(fonts["sans_bold"], 8)
    c.drawCentredString(inner + inner_w / 2, cursor - 7, RELEASING_TIME_NOTICE)
    cursor -= notice_h + 12

    c.setFillColor(STUB_BLACK)
    c.setFont(fonts["sans"], 8)
    for line in instruction_lines:
        c.drawString(inner, cursor, line)
        cursor -= 11

    y = stub_top - stub_h - 20
    c.setStrokeColor(STUB_HAIRLINE)
    c.setLineWidth(0.8)
    c.setDash(3, 3)
    c.line(left, y, right - 62, y)
    c.setDash()
    c.setFillColor(STUB_GREY)
    c.setFont(fonts["sans"], 8)
    c.drawRightString(right, y - 3, f"{SCISSORS}  cut here")
    y -= 22
    fields.append(Text("issued_note", left, y, content_w, 7.0, "/Helv", (0.420, 0.447, 0.502)))

    c.showPage()
    c.save()
    return buffer.getvalue(), fields


class Command(BaseCommand):
    help = "Build the fillable official form and claim stub templates in TrailSync/assets/templates/."

    def add_arguments(self, parser):
        parser.add_argument(
            "--price-font", type=Path, default=DEFAULT_PRICE_FONT_FILE,
            help="Arial-compatible TrueType font with a peso sign, subset into the form for Part 2's prices.",
        )

    def handle(self, *args, **options):
        raw = ORIGINAL_FORM.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if digest != ORIGINAL_FORM_SHA256:
            raise CommandError(
                f"{ORIGINAL_FORM.name} is not the revision these positions were measured on (found {digest[:12]}...). "
                "Re-measure FORM_TEXT and FORM_CHECKS against the new page first."
            )
        writer = PdfWriter(clone_from=io.BytesIO(raw))
        cut = cut_printed_prices(writer)
        if cut != PRINTED_PRICES:
            raise CommandError(f"Expected to cut Part 2's printed fees {PRINTED_PRICES}, but found {cut}.")
        embedded = {PRICE_FONT: price_font(writer, options["price_font"])}
        texts = FORM_TEXT + PRICE_FIELDS
        FORM_OUT.write_bytes(add_fields(writer, texts, FORM_CHECKS, embedded))
        self.stdout.write(
            f"Wrote {FORM_OUT.name}: {len(texts)} text fields ({len(PRICE_FIELDS)} of them Part 2 prices, replacing the "
            f"printed {', '.join(cut)}), {len(FORM_CHECKS)} checkboxes."
        )

        stub_design, stub_fields = draw_claim_stub()
        STUB_OUT.write_bytes(add_fields(PdfWriter(clone_from=io.BytesIO(stub_design)), stub_fields, []))
        self.stdout.write(f"Wrote {STUB_OUT.name}: {len(stub_fields)} text fields.")
