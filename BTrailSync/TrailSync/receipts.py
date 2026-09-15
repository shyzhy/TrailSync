"""Server-side PDF for the student's claim stub, drawn with ReportLab (pure Python, unlike WeasyPrint, which needs GTK on Windows)."""

from __future__ import annotations

import io
from decimal import Decimal
from pathlib import Path

from django.utils import timezone

from .models import COMPLETION_OF_INC_FEE, RUSH_FEE
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas

ASSET_DIR = Path(__file__).resolve().parent / "assets"
FONT_DIR = ASSET_DIR / "fonts"
LOGO_PATH = ASSET_DIR / "trailsync-logo.png"

# A4, the paper Philippine offices stock.
PAGE_W, PAGE_H = A4
MARGIN = 42.0
CONTENT_W = PAGE_W - 2 * MARGIN
LEFT = MARGIN
RIGHT = PAGE_W - MARGIN

BLUE = colors.HexColor("#24406B")
GOLD = colors.HexColor("#B8872B")
BLACK = colors.HexColor("#111111")
GREY = colors.HexColor("#6B7280")
HAIRLINE = colors.HexColor("#9CA3AF")

PESO = "₱"
EM_DASH = "—"
MIDDOT = "·"
SCISSORS = "✂"

# The official form's control block, so staff can see it's the current revision.
DOC_CODE = "FM-USTP-RGTR-09"
DOC_REVISION = "00"
DOC_EFFECTIVE = "10.01.21"

# The release window students most often get wrong, as boxed on the real form.
RELEASING_TIME_NOTICE = "RELEASING TIME is from 3:00 to 5:00 in the afternoon."

_FONTS_LOADED = False
_EMBEDDED_OK = False


def _load_fonts():
    """Register the bundled DejaVu faces once per process, for the peso sign; falls back to built-in faces and "PHP"."""
    global _FONTS_LOADED, _EMBEDDED_OK
    if _FONTS_LOADED:
        return
    _FONTS_LOADED = True
    faces = {
        "TS-Sans": "DejaVuSans.ttf",
        "TS-Sans-Bold": "DejaVuSans-Bold.ttf",
        "TS-Serif": "DejaVuSerif.ttf",
        "TS-Serif-Bold": "DejaVuSerif-Bold.ttf",
    }
    try:
        for name, filename in faces.items():
            pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))
        _EMBEDDED_OK = True
    except Exception:
        _EMBEDDED_OK = False


def _fonts():
    _load_fonts()
    if _EMBEDDED_OK:
        return {
            "sans": "TS-Sans",
            "sans_bold": "TS-Sans-Bold",
            "serif": "TS-Serif",
            "serif_bold": "TS-Serif-Bold",
        }
    return {
        "sans": "Helvetica",
        "sans_bold": "Helvetica-Bold",
        "serif": "Times-Roman",
        "serif_bold": "Times-Bold",
    }


def format_money(value):
    """A peso amount, or None so callers draw a blank write-in rule instead of a misleading 0.00."""
    if value is None:
        return None
    _load_fonts()
    symbol = PESO if _EMBEDDED_OK else "PHP "
    return f"{symbol}{Decimal(value).quantize(Decimal('0.01')):,.2f}"


def _local(dt):
    """A stored datetime in local time, tolerating naive values."""
    if dt is None:
        return None
    try:
        return timezone.localtime(dt)
    except (ValueError, TypeError):
        return dt


def _fit(text, font, size, max_width):
    """Truncate with an ellipsis to fit a fixed column, since nothing here may reflow."""
    text = "" if text is None else str(text)
    if pdfmetrics.stringWidth(text, font, size) <= max_width:
        return text
    ellipsis = "…"
    while text and pdfmetrics.stringWidth(text + ellipsis, font, size) > max_width:
        text = text[:-1]
    return text + ellipsis


def _wrap(text, font, size, max_width):
    """Greedy word wrap."""
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


def _student_name(user, profile):
    parts = [user.first_name or ""]
    if profile is not None and profile.middle_name:
        parts.append(profile.middle_name)
    parts.append(user.last_name or "")
    return " ".join(p for p in parts if p).strip() or user.email


def _caps(c, x, y, text, font, size, color, spacing=0.8):
    """Letterspaced small caps via a text object, the only place this ReportLab version exposes character spacing."""
    obj = c.beginText(x, y)
    obj.setFont(font, size)
    obj.setFillColor(color)
    obj.setCharSpace(spacing)
    obj.textOut(text.upper())
    # Reset character spacing before emitting: it persists past ET and would shift every later right-aligned string.
    obj.setCharSpace(0)
    c.drawText(obj)



def _doc_control_box(c, right_x, top_y, fonts):
    """The form-control table from the real document's top corner. Returns the y of its bottom edge."""
    w, row1, row2 = 152.0, 12.0, 11.0
    h = row1 + row2 + 12
    x = right_x - w

    c.setStrokeColor(BLACK)
    c.setLineWidth(0.7)
    c.rect(x, top_y - h, w, h, stroke=1, fill=0)

    c.setFillColor(BLUE)
    c.rect(x, top_y - row1, w, row1, stroke=0, fill=1)
    _caps(c, x + 4, top_y - row1 + 3.5, "Document Code No.", fonts["sans_bold"], 5.8, colors.white, spacing=0.4)

    c.setFillColor(BLACK)
    c.setFont(fonts["sans_bold"], 9)
    c.drawCentredString(x + w / 2, top_y - row1 - 10, DOC_CODE)

    divider_y = top_y - row1 - 14
    c.setStrokeColor(BLACK)
    c.setLineWidth(0.5)
    c.line(x, divider_y, x + w, divider_y)

    thirds = w / 3
    for i in (1, 2):
        c.line(x + thirds * i, divider_y, x + thirds * i, top_y - h)

    labels = ("Rev. No.", "Effective Date", "Page No.")
    values = (DOC_REVISION, DOC_EFFECTIVE, "1 of 1")
    for i, (label, value) in enumerate(zip(labels, values)):
        cx = x + thirds * i + thirds / 2
        c.setFillColor(GREY)
        c.setFont(fonts["sans"], 5.4)
        c.drawCentredString(cx, divider_y - 7, label)
        c.setFillColor(BLACK)
        c.setFont(fonts["sans_bold"], 6.8)
        c.drawCentredString(cx, divider_y - 16, value)

    return top_y - h



def _field(c, x, y, width, label, value, fonts):
    """One label-over-value pair. Returns the y to draw the next one at."""
    _caps(c, x, y, label, fonts["sans"], 6.5, GREY, spacing=0.7)
    c.setFillColor(BLACK)
    c.setFont(fonts["sans_bold"], 9)
    c.drawString(x, y - 11.5, _fit(value or EM_DASH, fonts["sans_bold"], 9, width))
    return y - 25



CLAIM_STUB_INSTRUCTION = (
    "Present this stub with a valid ID to claim your document at Window 6. "
    "If someone else is claiming on your behalf, they must also bring a "
    "notarized authorization letter and both parties' valid IDs. "
    "If this stub is lost, a valid ID must be presented instead."
)


def build_claim_stub_pdf(form_request) -> bytes:
    """Render the claim stub as a card on an A4 page with a cut line. Callers own authorisation and the digital_stub_active check."""
    fonts = _fonts()
    user = form_request.user
    profile = getattr(user, "user_profile", None)

    buffer = io.BytesIO()
    c = pdfcanvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f"TrailSync Claim Stub {EM_DASH} {form_request.request_code}")
    c.setAuthor("USTP-CDO Office of the Registrar")
    c.setSubject("Claim Stub")

    y = PAGE_H - MARGIN

    # Header
    c.setFillColor(BLUE)
    c.rect(LEFT, y - 3.5, CONTENT_W, 3.5, stroke=0, fill=1)
    y -= 3.5 + 16

    if LOGO_PATH.exists():
        c.drawImage(
            ImageReader(str(LOGO_PATH)), LEFT, y - 24, width=24, height=24,
            mask="auto", preserveAspectRatio=True, anchor="sw",
        )
        wordmark_x = LEFT + 31
    else:
        wordmark_x = LEFT

    c.setFillColor(BLUE)
    c.setFont(fonts["serif_bold"], 17)
    c.drawString(wordmark_x, y - 17, "TrailSync")

    c.setFillColor(BLACK)
    c.setFont(fonts["sans_bold"], 7.6)
    c.drawString(wordmark_x, y - 28, "University of Science and Technology of Southern Philippines")
    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 6.8)
    c.drawString(wordmark_x, y - 37, f"Cagayan de Oro {MIDDOT} Office of the Registrar {MIDDOT} Window 6")

    _doc_control_box(c, RIGHT, y, fonts)

    y -= 50
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.1)
    c.line(LEFT, y, RIGHT, y)
    y -= 24

    # The stub card's height follows its wrapped instruction, so no empty band looks like an unfilled field.
    instruction_lines = _wrap(CLAIM_STUB_INSTRUCTION, fonts["sans"], 8, CONTENT_W - 40)
    # 255 = the fixed content above the instruction: label and code (106), four rows (100), divider (20) and notice (29).
    stub_h = 255.0 + len(instruction_lines) * 11 + 14
    stub_top = y
    c.setStrokeColor(BLACK)
    c.setLineWidth(1.4)
    c.rect(LEFT, stub_top - stub_h, CONTENT_W, stub_h, stroke=1, fill=0)
    c.setFillColor(BLUE)
    c.rect(LEFT, stub_top - 4, CONTENT_W, 4, stroke=0, fill=1)

    inner = LEFT + 20
    inner_w = CONTENT_W - 40
    cursor = stub_top - 26

    _caps(c, inner, cursor, "Claim Stub", fonts["sans_bold"], 8, BLUE)
    cursor -= 10

    _caps(c, inner, cursor - 8, "Tracking Number", fonts["sans"], 7, GREY)
    c.setFillColor(BLUE)
    c.setFont(fonts["serif_bold"], 26)
    c.drawString(inner, cursor - 36, form_request.request_code)
    cursor -= 52

    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(0.6)
    c.line(inner, cursor, RIGHT - 20, cursor)
    cursor -= 18

    # Two columns of identity/document facts.
    col_w = (inner_w - 24) / 2
    col2 = inner + col_w + 24
    left_y = right_y = cursor
    left_y = _field(c, inner, left_y, col_w, "Name", _student_name(user, profile), fonts)
    left_y = _field(
        c, inner, left_y, col_w, "Course",
        profile.course if profile else None, fonts,
    )
    left_y = _field(
        c, inner, left_y, col_w, "Date of Request",
        f"{_local(form_request.created_at):%B %d, %Y}", fonts,
    )
    right_y = _field(
        c, col2, right_y, col_w, "Credential Requested", form_request.transaction_type.name, fonts
    )

    scheduled = form_request.scheduled_release()
    if scheduled is not None:
        release_date, release_time = scheduled
        when = f"{release_date:%B %d, %Y}"
        if release_time is not None:
            when += f" {MIDDOT} {release_time:%I:%M %p}"
    else:
        # Never a blank field: say it isn't scheduled yet.
        when = f"To be scheduled {EM_DASH} check back soon"
    right_y = _field(c, col2, right_y, col_w, "Date of Release", when, fonts)

    # Known by the time the stub is downloadable, so printed as recorded rather than as blank rules.
    amount_text = format_money(form_request.amount_due) or EM_DASH
    right_y = _field(c, col2, right_y, col_w, "Amount Assessed", amount_text, fonts)
    right_y = _field(
        c, col2, right_y, col_w, "O.R. Number", form_request.or_number or EM_DASH, fonts
    )

    cursor = min(left_y, right_y) - 4

    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(0.6)
    c.line(inner, cursor, RIGHT - 20, cursor)
    cursor -= 16

    notice_h = 17.0
    c.setStrokeColor(BLACK)
    c.setLineWidth(1.0)
    c.rect(inner, cursor - notice_h + 5, inner_w, notice_h, stroke=1, fill=0)
    c.setFillColor(BLACK)
    c.setFont(fonts["sans_bold"], 8)
    c.drawCentredString(inner + inner_w / 2, cursor - 7, RELEASING_TIME_NOTICE)
    cursor -= notice_h + 12

    c.setFillColor(BLACK)
    c.setFont(fonts["sans"], 8)
    for line in instruction_lines:
        c.drawString(inner, cursor, line)
        cursor -= 11

    y = stub_top - stub_h - 20

    # Cut line
    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(0.8)
    c.setDash(3, 3)
    c.line(LEFT, y, RIGHT - 62, y)
    c.setDash()
    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 8)
    c.drawRightString(RIGHT, y - 3, f"{SCISSORS}  cut here")
    y -= 22

    issued = _local(form_request.claim_stub_issued_at) or _local(timezone.now())
    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 7)
    c.drawString(LEFT, y, f"Issued {issued:%B %d, %Y at %I:%M %p} {MIDDOT} Generated by TrailSync.")

    c.showPage()
    c.save()
    return buffer.getvalue()
