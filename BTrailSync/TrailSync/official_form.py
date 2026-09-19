"""The official FM-USTP-RGTR-09 form: a transparent overlay of the dynamic values merged onto the university's own PDF, with coordinates measured from that exact file."""

from __future__ import annotations

import hashlib
import io
from pathlib import Path

from django.utils import timezone
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas as pdfcanvas

from .academics import is_alumnus, is_student
from .models import COMPLETION_OF_INC_FEE, RUSH_FEE
from .receipts import EM_DASH, MIDDOT, _fit, _fonts, _local, _student_name, format_money

TEMPLATE_PATH = Path(__file__).resolve().parent / "assets" / "templates" / "FM-USTP-RGTR-09.pdf"
TEMPLATE_SHA256 = "3d21a47d645bde0d0be7b9036bdfb32f0615418cc90428f0d15f309ad4768320"

# The template is not A4: 595.32 x 864.00 pt.
PAGE_W = 595.32
PAGE_H = 864.00

INK = colors.HexColor("#101418")
TICK = "✓"

# Text blanks: (x, y) where each underscore run starts, and the width before the next printed element.
TEXT_FIELDS = {
    "printed_name": (175.1, 727.0, 170.0),
    "course": (391.0, 727.0, 54.0),
    "date_of_request": (534.7, 727.0, 42.0),
    "birth_date": (80.3, 708.0, 66.0),
    "contact_number": (349.3, 589.5, 79.0),
    "graduation_date": (217.2, 567.3, 98.0),
    "last_semester_attended": (285.0, 555.4, 108.0),
    "prior_document": (259.0, 533.2, 129.0),
    "prior_date_requested": (470.5, 533.2, 59.0),
    # Part 3 conditional answers
    "inc_semester_taken": (447.0, 322.8, 75.0),
    "inc_subject_code": (410.0, 310.9, 139.0),
    "purpose_other": (130.0, 287.2, 149.0),
    "cav_other": (289.0, 397.1, 49.0),
    "certification_other": (492.0, 373.7, 74.0),
    # Signature and cashier band
    "verified_by": (74.0, 237.3, 126.0),
    "amount": (75.0, 169.8, 49.0),
    # Claim stub
    "stub_name": (62.6, 83.2, 164.0),
    "stub_course": (291.8, 83.2, 59.0),
    "stub_date_requested": (481.7, 83.2, 89.0),
    "stub_credential": (152.8, 67.7, 144.0),
    "stub_assessed_by": (399.6, 43.9, 54.0),
}

# Checkbox squares and check-blanks, by the label printed beside them.
CLASSIFICATION_BOXES = {"Student": (153.0, 708.9), "Alumnus": (342.0, 708.9)}
PRIOR_REQUEST_BOXES = {"YES": (268.2, 543.9), "NO": (316.0, 543.9)}
CLEARED_BOXES = {"Yes": (76.6, 511.5), "No": (77.5, 499.7)}

# Part 2: the "____" before each document name.
DOCUMENT_BLANKS = {
    "Certification": (359.0, 469.0),
    "Diploma Replacement": (35.0, 455.7),
    "Form 137": (194.0, 455.7),
    "Evaluation": (35.0, 443.9),
    "Authentication": (194.0, 443.9),
    "Honorable Dismissal": (35.0, 432.3),
    "CAV Certification": (194.4, 432.3),
    "Correction of Name": (35.0, 420.5),
    "Transcript of Records": (35.0, 408.7),
    "Permit to Study": (35.0, 397.1),
    "Rush Fee": (35.0, 385.3),
}

CAV_AGENCY_BOXES = {
    "DFA": (196.6, 420.9),
    "CHED": (244.4, 420.9),
    "DEP-ED": (294.7, 420.9),
    "PNP": (195.6, 409.1),
    "POEA": (244.0, 409.1),
    "BFP": (293.8, 409.1),
    "BJMP": (196.1, 397.5),
    "Others": (244.9, 397.5),
}

CERTIFICATION_BOXES = {
    "CAR": (359.0, 456.1),
    "Letter of No Objection": (467.0, 456.1),
    "GPA": (359.0, 444.4),
    "Graduated": (467.0, 444.4),
    "Endorsement": (359.0, 432.7),
    "Earned units": (467.0, 432.7),
    "Officially enrolled": (359.0, 421.0),
    "Grading System": (467.0, 421.0),
    "Subjects enrolled": (359.0, 409.2),
    "Subjects w/ grades": (467.0, 409.2),
    "USTP Conversion": (359.0, 397.6),
    "English Medium of Instruction": (359.0, 385.8),
    "Others": (492.0, 385.8),
    "Authorization Letter": (359.0, 374.2),
}

# Part 3: the "____" before each purpose.
PURPOSE_BLANKS = {
    "For Evaluation": (40.0, 334.7),
    "For Employment": (179.0, 334.7),
    "For Completion of INC": (323.0, 334.7),
    "For Scholarship": (40.0, 322.8),
    "For Personal File": (179.0, 322.8),
    "For Passport": (40.0, 310.9),
    "For Advanced Studies": (179.0, 310.9),
    "For Board Exam": (40.0, 299.1),
    "For Ranking": (179.0, 299.1),
    "Others": (40.0, 287.2),
}

# Rush Fee is an add-on line on the form, not a document of its own.
_DOCUMENT_ALIASES = {"Rush Fee": None}


class TemplateChanged(RuntimeError):
    """The base PDF is not the file these coordinates were measured against."""


def _verify_template() -> bytes:
    if not TEMPLATE_PATH.exists():
        raise TemplateChanged(
            f"Official form template missing at {TEMPLATE_PATH}. "
            "It ships in the repo under TrailSync/assets/templates/."
        )
    raw = TEMPLATE_PATH.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != TEMPLATE_SHA256:
        raise TemplateChanged(
            "The official form template has changed since the overlay coordinates "
            f"were measured (expected {TEMPLATE_SHA256[:12]}..., found {digest[:12]}...). "
            "Re-measure the underscore runs and checkbox squares against the new "
            "revision and update TEXT_FIELDS / the checkbox maps, then update "
            "TEMPLATE_SHA256. Refusing to render rather than print values into the "
            "wrong boxes."
        )
    return raw


_CONNECTORS = {"of", "in", "and", "the", "for"}


def _abbreviate(text):
    """Course code from a degree title: "BS Information Technology" -> "BSIT"."""
    parts = []
    for word in str(text).split():
        cleaned = word.strip(".,()")
        if not cleaned:
            continue
        if cleaned.lower() in _CONNECTORS:
            continue
        parts.append(cleaned if cleaned.isupper() else cleaned[0].upper())
    return "".join(parts)


def _text(c, key, value, fonts, size=8.0, font_key="sans", abbreviate=False):
    """Draw one value into a named blank, shrunk to fit rather than overrun."""
    if value in (None, ""):
        return
    x, y, width = TEXT_FIELDS[key]
    font = fonts[font_key]
    text = str(value)
    # Prefer an honest abbreviation over a truncation where the form expects a code.
    if abbreviate and pdfmetrics.stringWidth(text, font, size) > width:
        short = _abbreviate(text)
        if short and pdfmetrics.stringWidth(short, font, size) <= width:
            text = short
    # Otherwise step the size down a little before truncating.
    while size > 5.5 and pdfmetrics.stringWidth(text, font, size) > width:
        size -= 0.25
    c.setFillColor(INK)
    c.setFont(font, size)
    c.drawString(x, y, _fit(text, font, size, width))


def _tick(c, pos, fonts, size=9.0):
    if pos is None:
        return
    x, y = pos
    c.setFillColor(INK)
    c.setFont(fonts["sans_bold"], size)
    c.drawString(x + 1.0, y + 1.0, TICK)


def build_official_form_pdf(form_request) -> bytes:
    """Render one FormRequest onto the real FM-USTP-RGTR-09 page. Callers own authorisation and the receipt_available() check."""
    template_bytes = _verify_template()
    fonts = _fonts()

    user = form_request.user
    profile = getattr(user, "user_profile", None)
    submission = getattr(form_request, "submission", None)
    data = (submission.form_data if submission else None) or {}

    buffer = io.BytesIO()
    c = pdfcanvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    # Header
    _text(c, "printed_name", _student_name(user, profile), fonts, size=9.0)
    _text(c, "course", profile.course if profile else None, fonts, abbreviate=True)
    _text(
        c, "date_of_request",
        f"{_local(form_request.created_at):%m/%d/%Y}", fonts, size=7.5,
    )
    _text(
        c, "birth_date",
        f"{profile.birth_date:%m/%d/%Y}" if (profile and profile.birth_date) else None,
        fonts,
    )

    # The two lines are independent on the paper form too: an alumnus now in grad school ticks both.
    statuses = data.get("academic_status") or (profile.academic_status if profile else [])
    if is_student(statuses):
        _tick(c, CLASSIFICATION_BOXES["Student"], fonts)
    if is_alumnus(statuses):
        _tick(c, CLASSIFICATION_BOXES["Alumnus"], fonts)

    # Part 1
    _text(c, "contact_number", user.contact_number, fonts)
    _text(c, "graduation_date", data.get("graduation_date"), fonts)
    # Graduates give a graduation date; anyone still enrolled, or without one, also gives their last semester.
    if is_student(statuses) or not data.get("graduation_date"):
        _text(c, "last_semester_attended", data.get("semester"), fonts)

    # Answered from the student's own history, deliberately not from duplicate_flag.
    prior = (
        type(form_request)
        .objects.filter(user=user, transaction_type=form_request.transaction_type)
        .exclude(pk=form_request.pk)
        .order_by("-created_at")
        .first()
    )
    _tick(c, PRIOR_REQUEST_BOXES["YES" if prior else "NO"], fonts)
    if prior is not None:
        _text(c, "prior_document", form_request.transaction_type.name, fonts, size=7.0)
        _text(c, "prior_date_requested", f"{_local(prior.created_at):%m/%d/%Y}", fonts, size=7.0)

    # Left blank unless Front Desk recorded a clearance: the form treats it as the student's own declaration.
    clearance = form_request.clearance_check_result
    if clearance == "Cleared":
        _tick(c, CLEARED_BOXES["Yes"], fonts)
    elif clearance == "Not Cleared":
        _tick(c, CLEARED_BOXES["No"], fonts)

    # Part 2
    document_name = form_request.transaction_type.name
    blank = DOCUMENT_BLANKS.get(_DOCUMENT_ALIASES.get(document_name, document_name))
    _tick(c, blank, fonts)
    if form_request.is_rush:
        _tick(c, DOCUMENT_BLANKS["Rush Fee"], fonts)

    agency = data.get("cav_agency")
    if agency:
        _tick(c, CAV_AGENCY_BOXES.get(agency), fonts)
        if agency == "Others":
            _text(c, "cav_other", data.get("cav_agency_other"), fonts, size=7.0)

    for subtype in data.get("certification_subtypes") or []:
        _tick(c, CERTIFICATION_BOXES.get(subtype), fonts)

    # Part 3
    purpose = data.get("purpose")
    _tick(c, PURPOSE_BLANKS.get(purpose), fonts)
    if purpose == "Others":
        _text(c, "purpose_other", data.get("purpose_other"), fonts)
    if purpose == "For Completion of INC":
        _text(c, "inc_semester_taken", data.get("semester_taken"), fonts, size=7.0)
        _text(c, "inc_subject_code", data.get("subject_code"), fonts)

    # Verified line from the verification event; the Registrar's name is pre-printed, so the Approved block is never written to.
    verification = form_request.verifications.filter(verification_status="Verified").first()
    if verification is not None and verification.verified_by is not None:
        _text(c, "verified_by", verification.verified_by.user.get_full_name(), fonts, size=8.5)

    # The assessed amount is filled in; the Cashier and release fields are handwritten.
    _text(c, "amount", format_money(form_request.amount_due), fonts, size=8.5)

    # Claim stub
    _text(c, "stub_name", _student_name(user, profile), fonts)
    _text(c, "stub_course", profile.course if profile else None, fonts, size=7.0, abbreviate=True)
    _text(c, "stub_date_requested", f"{_local(form_request.created_at):%m/%d/%Y}", fonts)
    _text(c, "stub_credential", document_name, fonts)
    approver = form_request.registrar_approved_by
    _text(
        c, "stub_assessed_by",
        approver.user.get_full_name() if approver else None, fonts, size=6.5,
    )

    # The tracking number goes in the bottom margin, since the paper form has no field for it.
    footer_bits = [f"TrailSync {form_request.request_code}"]
    if form_request.amount_due is not None:
        total = format_money(form_request.amount_due)
        extras = []
        # The paper form has no pages box, so the Registrar's count is shown with the amount it produced. The rate is
        # worked back from the stored amount, because the admin may have changed the fee since it was assessed.
        if form_request.page_count:
            try:
                copies = max(1, int(data.get("number_of_copies")))
            except (TypeError, ValueError):
                copies = 1
            rate = (form_request.amount_due - form_request.fee_add_ons()) / (form_request.page_count * copies)
            extras.append(
                f"{form_request.page_count} page{'s' if form_request.page_count != 1 else ''} x {copies} "
                f"cop{'ies' if copies != 1 else 'y'} at {format_money(rate)}/page"
            )
        if form_request.is_rush:
            extras.append(f"incl. rush {format_money(RUSH_FEE)}")
        if purpose == "For Completion of INC":
            extras.append(f"incl. INC {format_money(COMPLETION_OF_INC_FEE)}")
        footer_bits.append(f"Assessed {total}" + (f" ({', '.join(extras)})" if extras else ""))
    if approver is not None and form_request.registrar_approved_at:
        stamped = _local(form_request.registrar_approved_at)
        footer_bits.append(
            f"Approved by {approver.user.get_full_name()} on {stamped:%b %d, %Y %I:%M %p}"
        )
    footer_bits.append(f"Generated {_local(timezone.now()):%b %d, %Y %I:%M %p}")

    # Baseline at 14pt so the ascenders clear the claim stub's bottom border.
    c.setFillColor(colors.HexColor("#5B6474"))
    c.setFont(fonts["sans"], 5.8)
    c.drawString(27.0, 14.0, _fit(f"  {MIDDOT}  ".join(footer_bits), fonts["sans"], 5.8, PAGE_W - 54))

    c.showPage()
    c.save()

    # Merge
    overlay = PdfReader(io.BytesIO(buffer.getvalue())).pages[0]
    base = PdfReader(io.BytesIO(template_bytes))
    page = base.pages[0]
    page.merge_page(overlay)

    writer = PdfWriter()
    writer.add_page(page)
    writer.add_metadata(
        {
            "/Title": f"Request for Credential/s Form {EM_DASH} {form_request.request_code}",
            "/Author": "USTP-CDO Office of the Registrar",
            "/Subject": "FM-USTP-RGTR-09",
        }
    )
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
