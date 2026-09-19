"""Fills the fillable PDF templates by field name, then flattens them into plain PDFs.

No coordinates live here. Each field's box, font and size come from the template itself (made once by
`manage.py build_pdf_templates`, and adjustable in any PDF editor), so moving a field never touches this code.
"""

from __future__ import annotations

import io
import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from django.utils import timezone
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
from reportlab.pdfbase.pdfmetrics import stringWidth

TEMPLATE_DIR = Path(__file__).resolve().parent / "assets" / "templates"

# Field text is set in the PDF standard fonts; these are the template's resource names for them.
_STANDARD_FONTS = {"/Helv": "Helvetica", "/HeBo": "Helvetica-Bold", "/TiBo": "Times-Bold"}
# The standard fonts have no peso sign, so the official form's Part 2 prices use an Arial subset embedded in the
# template, holding exactly these characters. Arial shares Helvetica's widths, and its peso sign is as wide as "P".
PRICE_FONT = "/ArPe"
PRICE_CHARS = "₱0123456789,./()pg nosetf"
# pypdf starts field text 2pt in from the box's left edge and clips it 4pt before the right.
_TEXT_INSETS = 6.0
MIN_FONT_SIZE = 5.5
ELLIPSIS = "…"


class TemplateChanged(RuntimeError):
    """A template is missing, or lacks a field the code fills. Refusing beats handing out a form with gaps in it."""


@dataclass(frozen=True)
class TemplateField:
    kind: str  # "text" or "check"
    width: float = 0.0  # room for the text inside pypdf's insets
    font: str = "/Helv"
    size: float = 8.0


@lru_cache(maxsize=None)
def _template(filename: str) -> tuple[bytes, dict[str, TemplateField]]:
    """The template's bytes and its fields, read once per process."""
    path = TEMPLATE_DIR / filename
    if not path.exists():
        raise TemplateChanged(f"PDF template missing: {path}. Build it with `manage.py build_pdf_templates`.")
    raw = path.read_bytes()
    fields = {}
    for annotation in PdfReader(io.BytesIO(raw)).pages[0].get("/Annots") or []:
        widget = annotation.get_object()
        if widget.get("/Subtype") != "/Widget" or "/T" not in widget:
            continue
        if widget.get("/FT") == "/Btn":
            fields[str(widget["/T"])] = TemplateField("check")
            continue
        left, _, right, _ = (float(v) for v in widget["/Rect"])
        match = re.search(r"(/\S+)\s+([\d.]+)\s+Tf", str(widget.get("/DA", "")))
        font, size = (match.group(1), float(match.group(2))) if match else ("/Helv", 8.0)
        fields[str(widget["/T"])] = TemplateField("text", abs(right - left) - _TEXT_INSETS, font, size)
    return raw, fields


def template_fields(filename: str) -> dict[str, TemplateField]:
    return _template(filename)[1]


def printable(text: str) -> str:
    """The standard fonts cover Windows-1252 (ñ, é, ü and the like); anything past that falls back to its base letter."""
    out = []
    for char in str(text):
        try:
            char.encode("cp1252")
            out.append(char)
        except UnicodeEncodeError:
            out.append(unicodedata.normalize("NFKD", char).encode("ascii", "ignore").decode() or "?")
    return "".join(out)


def _in_font(value, field: TemplateField) -> str:
    """The value as the field's font can print it."""
    text = str(value)
    if field.font != PRICE_FONT:
        return printable(text)
    # Only prices go in this font, so anything outside its subset is a bug, not a name to fall back on.
    missing = set(text) - set(PRICE_CHARS)
    if missing:
        raise ValueError(f"{text!r} uses characters the price font lacks: {''.join(sorted(missing))!r}")
    return text


def _width(text: str, field: TemplateField, size: float) -> float:
    if field.font == PRICE_FONT:
        return stringWidth(text.replace("₱", "P"), "Helvetica", size)
    return stringWidth(text, _STANDARD_FONTS.get(field.font, "Helvetica"), size)


def _fitted(value, field: TemplateField):
    """(text, font, size) for a text field: the first candidate that fits at the template's size, otherwise the last one
    stepped down in size, and cut with an ellipsis only when even the smallest size can't hold it."""
    candidates = [_in_font(v, field) for v in (value if isinstance(value, tuple) else (value,)) if v not in (None, "")]
    if not candidates:
        return None
    for text in candidates:
        if _width(text, field, field.size) <= field.width:
            return text, field.font, field.size
    text, size = candidates[-1], field.size
    while size > MIN_FONT_SIZE and _width(text, field, size) > field.width:
        size -= 0.25
    if _width(text, field, size) > field.width:
        if field.font == PRICE_FONT:
            return text, field.font, size  # a price is never cut short; the smallest size is the last resort
        while text and _width(text + ELLIPSIS, field, size) > field.width:
            text = text[:-1]
        text = text.rstrip() + ELLIPSIS
    return text, field.font, size


def fill_pdf(filename: str, text: dict, checked: set[str], *, required: frozenset[str], metadata: dict) -> bytes:
    """Fill a template by field name and flatten it.

    text maps a field to its value; a tuple offers alternatives, longest first (a course and its abbreviation). checked
    names the checkboxes to tick. required is every field the caller can ever fill: a template without one of them is
    refused up front, not discovered on the one request that needed it.
    """
    raw, fields = _template(filename)
    missing = required - fields.keys()
    if missing:
        raise TemplateChanged(f"{filename} has no field named {', '.join(sorted(missing))}.")
    unknown = (text.keys() | checked) - required
    if unknown:
        raise ValueError(f"Not declared as required for {filename}: {', '.join(sorted(unknown))}")

    values = {}
    for name, value in text.items():
        fitted = _fitted(value, fields[name])
        if fitted:
            values[name] = fitted
    for name in checked:
        values[name] = "/Yes"

    writer = PdfWriter(clone_from=io.BytesIO(raw))
    if values:
        writer.update_page_form_field_values(writer.pages[0], values, auto_regenerate=False, flatten=True)
    # Flattening drew every value into the page itself. Dropping the widgets and the form dictionary leaves an ordinary
    # PDF: nothing is left to fill in or change in a PDF viewer.
    writer.remove_annotations(subtypes="/Widget")
    del writer.root_object[NameObject("/AcroForm")]
    writer.add_metadata(metadata)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# ---- Values as the forms print them ------------------------------------------------------------------------------
def money(value) -> str | None:
    """A peso amount as "PHP 1,300.00", or None so the field stays blank rather than showing a misleading 0.00."""
    if value is None:
        return None
    return f"PHP {Decimal(value).quantize(Decimal('0.01')):,.2f}"


def local(dt):
    """A stored datetime in local time, tolerating naive values."""
    if dt is None:
        return None
    try:
        return timezone.localtime(dt)
    except (ValueError, TypeError):
        return dt


def student_name(user, profile) -> str:
    parts = [user.first_name or ""]
    if profile is not None and profile.middle_name:
        parts.append(profile.middle_name)
    parts.append(user.last_name or "")
    return " ".join(p for p in parts if p).strip() or user.email


_CONNECTORS = {"of", "in", "and", "the", "for"}


def abbreviate(text) -> str:
    """Course code from a degree title: "BS Information Technology" -> "BSIT"."""
    parts = []
    for word in str(text).split():
        cleaned = word.strip(".,()")
        if not cleaned or cleaned.lower() in _CONNECTORS:
            continue
        parts.append(cleaned if cleaned.isupper() else cleaned[0].upper())
    return "".join(parts)
