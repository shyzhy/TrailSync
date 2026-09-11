"""Server-side PDF generation for the printable Cashier / claim form.

Deliberately NOT WeasyPrint, despite it being the natural HTML/CSS-to-PDF
pick and the one the brief suggested: WeasyPrint renders through native GTK
libraries (libgobject, Pango, cairo) that pip cannot supply on Windows. It
pip-installs cleanly and then fails at import with "cannot load library
libgobject-2.0-0" unless a system-wide GTK runtime is present. It is not
present on this project's dev machine, and requiring one would have to be
reproduced on whatever host this eventually deploys to. ReportLab is pure
Python with no native dependencies, so `pip install` really is all it takes
on any platform.

Layout is drawn directly onto the canvas rather than flowed through
platypus. This document has a fixed, form-like structure that must always
land on exactly one page — it gets printed, written on by hand at the
Cashier, then torn along the stub line — so absolute positioning is the
right tool here. There is no variable-length content needing to reflow, and
the few fields that could overrun their column are truncated to fit rather
than allowed to push the claim stub onto a second page.

This is the one place in TrailSync that deliberately abandons the
skeuomorphic / liquid-glass design language. Backdrop blur, soft shadows and
translucent panels are screen-only affordances that either vanish or turn to
mud on paper, so this reads as an official printed document instead: black
text on white with ruled boxes, keeping institutional blue and muted gold
only as accent bars and rules so it stays recognisably TrailSync.
"""

from __future__ import annotations

import io
from decimal import Decimal
from pathlib import Path

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas

ASSET_DIR = Path(__file__).resolve().parent / "assets"
FONT_DIR = ASSET_DIR / "fonts"
LOGO_PATH = ASSET_DIR / "trailsync-logo.png"

# A4 rather than Letter. Philippine universities and government offices
# standardise on A4, and this form is handled at three separate desks
# (student, Cashier, Window 6), so it needs to match the paper already in
# their trays. Chosen once here and never mixed.
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

# Control block from the real USTP form this document stands in for
# (FM-USTP-RGTR-09). Printed so a member of staff can see at a glance that
# what the student handed them is the current revision of the official form
# and not a lookalike.
DOC_CODE = "FM-USTP-RGTR-09"
DOC_REVISION = "00"
DOC_EFFECTIVE = "10.01.21"

# Window 6 releases only in this band. It is on the printed stub because it
# is the single thing students most often get wrong, and the real form gives
# it its own boxed notice.
RELEASING_TIME_NOTICE = "RELEASING TIME is from 3:00 to 5:00 in the afternoon."

_FONTS_LOADED = False
_EMBEDDED_OK = False


def _load_fonts():
    """Register the bundled DejaVu faces, once per process.

    ReportLab's built-in Type1 faces (Helvetica et al.) use WinAnsiEncoding,
    which has no glyph for the Philippine peso sign — it would silently
    print as a black box on the single number the student has to hand money
    over for. DejaVu carries U+20B1 and is bundled into assets/fonts rather
    than read out of the Windows font directory, because that path does not
    exist on a Linux host and Arial/Calibri are not redistributable anyway.

    If registration fails for any reason the document still renders, using
    the built-in faces and spelling the currency "PHP" instead — a fallback
    that degrades the typography but never prints an unreadable amount.
    """
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
    """Render a peso amount, or None when there is nothing to render.

    Returns None rather than a zero for a missing amount so callers can draw
    a blank write-in rule instead — a document type with no published fee is
    a real case, and printing 0.00 would tell the student they owe nothing.
    """
    if value is None:
        return None
    _load_fonts()
    symbol = PESO if _EMBEDDED_OK else "PHP "
    return f"{symbol}{Decimal(value).quantize(Decimal('0.01')):,.2f}"


def _local(dt):
    """Project a stored datetime into local time, tolerating naive values
    (what comes back when a deployment runs with USE_TZ off)."""
    if dt is None:
        return None
    try:
        return timezone.localtime(dt)
    except (ValueError, TypeError):
        return dt


def _fit(text, font, size, max_width):
    """Truncate to fit a fixed column, since nothing here may reflow onto a
    second page. The ellipsis signals the value was cut, not merely short."""
    text = "" if text is None else str(text)
    if pdfmetrics.stringWidth(text, font, size) <= max_width:
        return text
    ellipsis = "…"
    while text and pdfmetrics.stringWidth(text + ellipsis, font, size) > max_width:
        text = text[:-1]
    return text + ellipsis


def _wrap(text, font, size, max_width):
    """Greedy word wrap. The receipt had no multi-line prose so nothing
    needed this; the claim stub's instruction line is a real paragraph."""
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
    """Letterspaced small caps, used for every label on the form.

    Drawn through a text object rather than canvas.drawString because
    character spacing is only exposed on PDFTextObject in this ReportLab
    version — the canvas has no setCharSpace. Tracking matters here: at 6.5pt
    an unspaced uppercase label turns into a grey smear once it is printed
    and photocopied, which these forms will be.
    """
    obj = c.beginText(x, y)
    obj.setFont(font, size)
    obj.setFillColor(color)
    obj.setCharSpace(spacing)
    obj.textOut(text.upper())
    # Reset tracking back to zero BEFORE the object is emitted. Character
    # spacing is a PDF text-state parameter, so the Tc operator this text
    # object writes survives past its own ET and silently applies to every
    # later string on the page - while the canvas goes on believing spacing
    # is still 0. Left unreset it shifted each subsequent drawRightString by
    # (spacing x character count), pushing right-aligned text and truncated
    # column values out past the margin.
    obj.setCharSpace(0)
    c.drawText(obj)


def _caps_width(text, font, size, spacing=0.8):
    """Rendered width of a _caps() label.

    pdfmetrics.stringWidth measures glyph advances only and knows nothing
    about tracking, so anything sized against a letterspaced label has to add
    it back - PDF applies the spacing after every glyph, the last one
    included.
    """
    return pdfmetrics.stringWidth(text.upper(), font, size) + spacing * len(text)


def _doc_control_box(c, right_x, top_y, fonts):
    """The form-control table the real document carries in its top corner.

    Reproduced because this PDF is not merely a receipt - it stands in for
    FM-USTP-RGTR-09 itself, and a registrar's office identifies its forms by
    this block. Returns the y of its bottom edge.
    """
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


def _verifier_of(form_request):
    """The Front Desk staff member who signed this request off as verified.

    Read from RequirementVerification rather than FormRequest because that is
    where the verification EVENT is recorded, with its own author. The real
    form has two separate signatures - Front Desk verifies, the University
    Registrar approves - so the printed document needs both names, not one.
    """
    latest = form_request.verifications.filter(verification_status="Verified").first()
    return latest.verified_by if latest else None


def _signature_column(c, x, width, y, caption, name, subtitle, fonts):
    """One signature block: rendered name over a rule, captioned beneath."""
    if name:
        c.setFillColor(BLACK)
        c.setFont(fonts["serif"], 11)
        c.drawString(x + 4, y + 7, _fit(name, fonts["serif"], 11, width - 8))

    c.setStrokeColor(BLACK)
    c.setLineWidth(0.8)
    c.line(x, y, x + width, y)

    c.setFillColor(BLACK)
    c.setFont(fonts["sans_bold"], 7.8)
    c.drawString(x, y - 10, _fit(name or EM_DASH, fonts["sans_bold"], 7.8, width))
    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 6.6)
    c.drawString(x, y - 19, _fit(subtitle, fonts["sans"], 6.6, width))
    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 6.4)
    c.drawString(x, y - 28, caption)


def _section_bar(c, x, y, width, title, fonts, height=15.0):
    """A reversed-out blue header bar. Returns the y of its bottom edge."""
    c.setFillColor(BLUE)
    c.rect(x, y - height, width, height, stroke=0, fill=1)
    _caps(c, x + 7, y - height + 4.8, title, fonts["sans_bold"], 7.5, colors.white)
    return y - height


def _field(c, x, y, width, label, value, fonts):
    """One label-over-value pair. Returns the y to draw the next one at."""
    _caps(c, x, y, label, fonts["sans"], 6.5, GREY, spacing=0.7)
    c.setFillColor(BLACK)
    c.setFont(fonts["sans_bold"], 9)
    c.drawString(x, y - 11.5, _fit(value or EM_DASH, fonts["sans_bold"], 9, width))
    return y - 25


def _write_in_line(c, x, y, width, label, fonts, label_width=86.0):
    """A labelled blank rule, to be completed by hand at the Cashier."""
    c.setFillColor(BLACK)
    c.setFont(fonts["sans"], 8.5)
    c.drawString(x, y, label)
    c.setStrokeColor(BLACK)
    c.setLineWidth(0.6)
    c.line(x + label_width, y - 2.5, x + width, y - 2.5)


def build_receipt_pdf(form_request) -> bytes:
    """Render one FormRequest's Cashier form and claim stub to PDF bytes.

    Callers own authorisation and the FormRequest.receipt_available() check —
    this renders whatever it is handed and enforces neither.
    """
    fonts = _fonts()
    user = form_request.user
    profile = getattr(user, "user_profile", None)
    submission = getattr(form_request, "submission", None)
    form_data = (submission.form_data if submission else None) or {}

    purpose = form_data.get("purpose")
    if purpose == "Others":
        purpose = form_data.get("purpose_other") or "Others"

    buffer = io.BytesIO()
    c = pdfcanvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f"TrailSync Request Form {EM_DASH} {form_request.request_code}")
    c.setAuthor("USTP-CDO Office of the Registrar")
    c.setSubject("Request for Credentials - Official Form")

    y = PAGE_H - MARGIN

    # ---------------------------------------------------------------- header
    c.setFillColor(BLUE)
    c.rect(LEFT, y - 3.5, CONTENT_W, 3.5, stroke=0, fill=1)
    y -= 3.5 + 16

    if LOGO_PATH.exists():
        c.drawImage(
            ImageReader(str(LOGO_PATH)),
            LEFT,
            y - 24,
            width=24,
            height=24,
            mask="auto",
            preserveAspectRatio=True,
            anchor="sw",
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
    y -= 17

    c.setFillColor(BLACK)
    c.setFont(fonts["serif_bold"], 13.5)
    c.drawCentredString(PAGE_W / 2, y, "Request for Credential/s Form")
    y -= 12

    generated = _local(timezone.now())
    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 7.5)
    c.drawCentredString(PAGE_W / 2, y, f"Generated {generated.strftime('%B %d, %Y at %I:%M %p')}")
    y -= 18

    # -------------------------------------------------------------- tracking
    box_h = 52.0
    c.setStrokeColor(BLUE)
    c.setLineWidth(1.4)
    c.rect(LEFT, y - box_h, CONTENT_W, box_h, stroke=1, fill=0)

    _caps(c, LEFT + 12, y - 17, "Tracking Number", fonts["sans"], 7, GREY)
    c.setFillColor(BLUE)
    c.setFont(fonts["serif_bold"], 24)
    c.drawString(LEFT + 12, y - 41, form_request.request_code)

    if form_request.is_rush:
        # Gold rather than a red that is not in the palette; still the
        # loudest thing on the page, which is the point — it changes how the
        # Cashier and Window 6 prioritise the paper in front of them.
        label = "Rush Request"
        pad = 13.0
        # Sized from the measured label rather than a fixed width, so the
        # badge cannot clip its own text.
        badge_w = _caps_width(label, fonts["sans_bold"], 9, spacing=1.0) + pad * 2
        badge_h = 22.0
        badge_x = RIGHT - 12 - badge_w
        badge_y = y - 37
        c.setFillColor(GOLD)
        c.setStrokeColor(GOLD)
        c.roundRect(badge_x, badge_y, badge_w, badge_h, 3, stroke=1, fill=1)
        _caps(c, badge_x + pad, badge_y + 7.5, label, fonts["sans_bold"], 9, colors.white, spacing=1.0)
    y -= box_h + 15

    # ------------------------------------------- student info / request info
    gutter = 18.0
    col_w = (CONTENT_W - gutter) / 2
    col2_x = LEFT + col_w + gutter

    bar_y = _section_bar(c, LEFT, y, col_w, "Student Information", fonts)
    _section_bar(c, col2_x, y, col_w, "Request Details", fonts)

    left_y = bar_y - 15
    right_y = left_y

    left_y = _field(c, LEFT, left_y, col_w, "Full Name", _student_name(user, profile), fonts)
    left_y = _field(
        c, LEFT, left_y, col_w, "School ID Number",
        profile.school_id_number if profile else None, fonts,
    )
    left_y = _field(c, LEFT, left_y, col_w, "Course", profile.course if profile else None, fonts)
    left_y = _field(
        c, LEFT, left_y, col_w, "Year Level", profile.year_level if profile else None, fonts
    )
    # Both asked for by name on the real form's header block.
    left_y = _field(
        c, LEFT, left_y, col_w, "Birth Date",
        f"{profile.birth_date:%B %d, %Y}" if (profile and profile.birth_date) else None,
        fonts,
    )
    left_y = _field(
        c, LEFT, left_y, col_w, "Classification",
        # The form offers Student (Undergrad/Graduate) and Alumnus (High
        # School/Undergrad/Graduate). Only the top-level distinction is
        # captured today - see the note about the missing sub-level.
        profile.user_category if profile else None,
        fonts,
    )

    copies = form_data.get("number_of_copies")
    right_y = _field(
        c, col2_x, right_y, col_w, "Transaction Type", form_request.transaction_type.name, fonts
    )
    right_y = _field(
        c, col2_x, right_y, col_w, "Number of Copies",
        str(copies) if copies is not None else None, fonts,
    )
    right_y = _field(c, col2_x, right_y, col_w, "Purpose of Request", purpose, fonts)
    right_y = _field(
        c, col2_x, right_y, col_w, "Semester / Academic Year", form_data.get("semester"), fonts
    )
    right_y = _field(
        c, col2_x, right_y, col_w, "Date Requested",
        _local(form_request.created_at).strftime("%B %d, %Y"), fonts,
    )

    y = min(left_y, right_y) - 6

    # The student signs the printed form: the real document's very first
    # field is "Signature over Printed Name", and it is the only thing on
    # here the system cannot supply for them.
    c.setStrokeColor(BLACK)
    c.setLineWidth(0.8)
    sign_w = 250.0
    c.line(LEFT, y - 12, LEFT + sign_w, y - 12)
    c.setFillColor(BLACK)
    c.setFont(fonts["sans_bold"], 7.6)
    c.drawString(LEFT, y - 22, _student_name(user, profile).upper())
    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 6.4)
    c.drawString(LEFT, y - 31, "Signature over Printed Name")
    y -= 44

    # ------------------------------------------------------------ amount due
    amount_h = 50.0
    c.setStrokeColor(BLACK)
    c.setLineWidth(1.4)
    c.rect(LEFT, y - amount_h, CONTENT_W, amount_h, stroke=1, fill=0)
    c.setFillColor(GOLD)
    c.rect(LEFT, y - amount_h, 4, amount_h, stroke=0, fill=1)

    _caps(c, LEFT + 16, y - 18, "Amount Due", fonts["sans_bold"], 8, BLACK)

    fee = form_request.transaction_type.fee_amount
    if fee is not None and copies:
        c.setFillColor(GREY)
        c.setFont(fonts["sans"], 7.5)
        unit = "copy" if str(copies) == "1" else "copies"
        c.drawString(LEFT + 16, y - 32, f"{format_money(fee)} each {MIDDOT} {copies} {unit}")

    amount_text = format_money(form_request.amount_due)
    if amount_text:
        c.setFillColor(BLACK)
        c.setFont(fonts["sans_bold"], 20)
        c.drawRightString(RIGHT - 16, y - 34, amount_text)
    else:
        # No published fee for this document type: leave a rule for the
        # Cashier to write the figure on rather than assert a number.
        c.setFillColor(GREY)
        c.setFont(fonts["sans"], 8)
        c.drawRightString(RIGHT - 16, y - 20, "to be assessed at the Cashier")
        c.setStrokeColor(BLACK)
        c.setLineWidth(0.8)
        c.line(RIGHT - 150, y - 36, RIGHT - 16, y - 36)
    y -= amount_h + 16

    # -------------------------------------------------- signatures
    # Two separate sign-offs, mirroring the real form: Front Desk personnel
    # VERIFY the requirements, the University Registrar APPROVES the request.
    # In the current one-step workflow the same person does both, so both
    # lines often carry the same name - which is precisely the argument for
    # splitting Verified and Approved into distinct stages.
    y -= 6
    verifier = _verifier_of(form_request)
    approver = form_request.registrar_approved_by

    gutter = 26.0
    sig_w = (CONTENT_W - gutter) / 2
    _signature_column(
        c, LEFT, sig_w, y,
        "Name & Signature of Front Desk Personnel",
        verifier.user.get_full_name() if verifier else None,
        "Verified" if verifier else "Not yet verified",
        fonts,
    )
    _signature_column(
        c, LEFT + sig_w + gutter, sig_w, y,
        "Approved",
        approver.user.get_full_name() if approver else None,
        (
            f"University Registrar {MIDDOT} {approver.employee_id}"
            if approver
            else "University Registrar"
        ),
        fonts,
    )
    y -= 42

    approved_at = _local(form_request.registrar_approved_at)
    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 6.5)
    stamped = (
        f"Approved {approved_at:%B %d, %Y at %I:%M %p}. "
        if approved_at
        else ""
    )
    c.drawString(
        LEFT, y,
        f"{stamped}Electronically generated by TrailSync. Valid without a handwritten signature.",
    )
    y -= 16

    # ----------------------------------------------------------- cashier box
    cashier_h = 92.0
    c.setStrokeColor(BLACK)
    c.setLineWidth(1.6)
    c.rect(LEFT, y - cashier_h, CONTENT_W, cashier_h, stroke=1, fill=0)

    _section_bar(c, LEFT + 1.6, y - 1.6, CONTENT_W - 3.2, "For Cashier Use Only", fonts)

    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 6.5)
    c.drawString(
        LEFT + 12, y - 29,
        "To be completed by hand at the Cashier. Present this form at Window 6 once paid.",
    )

    line_y = y - 48
    half = (CONTENT_W - 24 - 26) / 2
    _write_in_line(c, LEFT + 12, line_y, half, "O.R. Number:", fonts, label_width=62)
    _write_in_line(c, LEFT + 12 + half + 26, line_y, half, "Payment Date:", fonts, label_width=68)
    _write_in_line(
        c, LEFT + 12, line_y - 28, CONTENT_W - 24, "Cashier Signature:", fonts, label_width=90
    )
    body_bottom = y - cashier_h

    # ------------------------------------------------- cut line + claim stub
    # Anchored to the foot of the page rather than flowed on directly below
    # the Cashier box. The stub is meant to be torn off, and a tear line
    # partway up a sheet leaves an awkward flap on a document that then has
    # to sit in a Cashier's tray; whatever vertical slack the body did not
    # use collects as white space above the cut instead. The min() keeps the
    # cut below the Cashier box if this form ever grows more fields.
    stub_h = 100.0
    y = min(MARGIN + stub_h + 20, body_bottom - 22)

    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(0.8)
    c.setDash(3, 3)
    c.line(LEFT, y, RIGHT - 62, y)
    c.setDash()
    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 8)
    c.drawRightString(RIGHT, y - 3, f"{SCISSORS}  cut here")
    y -= 20

    c.setStrokeColor(BLACK)
    c.setLineWidth(1.0)
    c.rect(LEFT, y - stub_h, CONTENT_W, stub_h, stroke=1, fill=0)
    c.setFillColor(BLUE)
    c.rect(LEFT, y - stub_h, CONTENT_W, 3, stroke=0, fill=1)

    _caps(c, LEFT + 12, y - 16, "Claim Stub", fonts["sans_bold"], 7.5, BLUE)
    c.setFillColor(BLACK)
    c.setFont(fonts["serif_bold"], 15)
    c.drawString(LEFT + 12, y - 35, form_request.request_code)

    scheduled = form_request.scheduled_release()
    release_text = f"{scheduled[0]:%B %d, %Y}" if scheduled else f"To be scheduled"

    col2 = LEFT + 196
    col3 = LEFT + 360
    stub_y = y - 50
    _field(c, LEFT + 12, stub_y, 170, "Name", _student_name(user, profile), fonts)
    _field(c, col2, stub_y, 150, "Course", profile.course if profile else None, fonts)
    _field(c, col3, stub_y, 140, "Date of Release", release_text, fonts)

    c.setFillColor(GREY)
    c.setFont(fonts["sans"], 6.6)
    c.drawString(
        LEFT + 12, y - 88,
        f"{RELEASING_TIME_NOTICE} Present this stub upon claiming. If lost, a valid ID must be presented.",
    )

    c.showPage()
    c.save()
    return buffer.getvalue()


CLAIM_STUB_INSTRUCTION = (
    "Present this stub with a valid ID to claim your document at Window 6. "
    "If someone else is claiming on your behalf, they must also bring a "
    "notarized authorization letter and both parties' valid IDs. "
    "If this stub is lost, a valid ID must be presented instead."
)


def build_claim_stub_pdf(form_request) -> bytes:
    """Render the student's claim stub as a standalone PDF.

    Shares this module's whole setup with the receipt - page geometry, the
    embedded DejaVu faces carrying the peso glyph, the colour constants and
    the small-caps/label helpers - rather than standing up a second pipeline.
    What differs is the shape: the receipt is a full-page form with a stub
    attached, this is the stub on its own.

    Laid out as a card in the upper third of an A4 page with a cut line under
    it. A custom small page size would print unpredictably on the A4 paper
    these offices stock, so the page stays A4 and the part worth keeping is
    made obvious and separable instead.

    Callers own authorisation and the digital_stub_active check.
    """
    fonts = _fonts()
    user = form_request.user
    profile = getattr(user, "user_profile", None)

    buffer = io.BytesIO()
    c = pdfcanvas.Canvas(buffer, pagesize=A4)
    c.setTitle(f"TrailSync Claim Stub {EM_DASH} {form_request.request_code}")
    c.setAuthor("USTP-CDO Office of the Registrar")
    c.setSubject("Claim Stub")

    y = PAGE_H - MARGIN

    # ---------------------------------------------------------------- header
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

    # ------------------------------------------------------------- the stub
    # Height derived from the wrapped instruction rather than fixed, so the
    # card closes just under its own content. A fixed height left a band of
    # empty space that reads as a form field someone forgot to fill in.
    instruction_lines = _wrap(CLAIM_STUB_INSTRUCTION, fonts["sans"], 8, CONTENT_W - 40)
    # 255 = fixed content above the instruction: header label and tracking
    # number (106), four field rows (100), the divider (20) and the boxed
    # releasing-time notice (29). Getting this wrong does not reflow
    # anything, it just prints the last line outside the card border.
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
        # Never a blank field: an empty line reads as an error, where saying
        # it is not scheduled yet tells the student what to do about it.
        when = f"To be scheduled {EM_DASH} check back soon"
    right_y = _field(c, col2, right_y, col_w, "Date of Release", when, fonts)

    # Assessed amount and O.R. number: on the real stub these are written in
    # by the Cashier. Here they are already known by the time the stub is
    # downloadable, so they print as recorded rather than as blank rules.
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

    # ------------------------------------------------------------- cut line
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
