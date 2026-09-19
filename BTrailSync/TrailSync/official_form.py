"""The official FM-USTP-RGTR-09 form: the university's own page with an AcroForm field over each blank, filled by name.

Which field holds which value lives here; where each field sits lives in the template
(assets/templates/Request_of_Credentials_Form_2023_fillable.pdf, built by `manage.py build_pdf_templates`).
"""

from __future__ import annotations

from decimal import Decimal

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from .academics import is_alumnus, is_student
from .models import COMPLETION_OF_INC_FEE, RUSH_FEE, FormSubmission, TransactionType
from .pdf_forms import abbreviate, fill_pdf, local, money, student_name

TEMPLATE = "Request_of_Credentials_Form_2023_fillable.pdf"

# Part 2's documents, by TransactionType.code: the tick before each line and the price after it. Matching on the code
# rather than the name keeps a reworded display name from silently dropping a tick or a price. A document the paper
# form doesn't list has no code here and gets neither.
PART2_CODES = (
    "certification", "diploma_replacement", "form_137", "evaluation", "authentication",
    "honorable_dismissal", "cav_certification", "correction_of_name", "transcript_of_records", "permit_to_study",
)
DOCUMENT_FIELDS = {code: f"doc_{code}" for code in PART2_CODES}
PRICE_FIELDS = {code: f"price_{code}" for code in PART2_CODES}
# Rush Fee is a line of Part 2 but an add-on, not a document: its price is RUSH_FEE.
RUSH_FIELD = "doc_rush_fee"
RUSH_PRICE_FIELD = "price_rush_fee"

CAV_AGENCY_FIELDS = {
    "DFA": "cav_dfa",
    "CHED": "cav_ched",
    "DEP-ED": "cav_dep_ed",
    "PNP": "cav_pnp",
    "POEA": "cav_poea",
    "BFP": "cav_bfp",
    "BJMP": "cav_bjmp",
    "Others": "cav_others",
}

CERTIFICATION_FIELDS = {
    "CAR": "cert_car",
    "Letter of No Objection": "cert_letter_of_no_objection",
    "GPA": "cert_gpa",
    "Graduated": "cert_graduated",
    "Endorsement": "cert_endorsement",
    "Earned units": "cert_earned_units",
    "Officially enrolled": "cert_officially_enrolled",
    "Grading System": "cert_grading_system",
    "Subjects enrolled": "cert_subjects_enrolled",
    "Subjects w/ grades": "cert_subjects_with_grades",
    "USTP Conversion": "cert_ustp_conversion",
    "English Medium of Instruction": "cert_english_medium_of_instruction",
    "Others": "cert_others",
    "Authorization Letter": "cert_authorization_letter",
}

PURPOSE_FIELDS = {
    "For Evaluation": "purpose_evaluation",
    "For Employment": "purpose_employment",
    "For Completion of INC": "purpose_completion_of_inc",
    "For Scholarship": "purpose_scholarship",
    "For Personal File": "purpose_personal_file",
    "For Passport": "purpose_passport",
    "For Advanced Studies": "purpose_advanced_studies",
    "For Board Exam": "purpose_board_exam",
    "For Ranking": "purpose_ranking",
    "Others": "purpose_others",
}

TEXT_FIELDS = frozenset({
    "signature_over_printed_name", "course", "date_of_request", "birth_date",
    "contact_no", "date_of_graduation", "last_semester_sy", "previously_requested_document", "previously_requested_date",
    "cav_others_specify", "cert_others_specify", "inc_semester_taken", "inc_subject_code", "purpose_others_specify",
    "verified_by", "approved_by_name", "amount", "or_number", "payment_date", "date_of_release",
    "stub_name", "stub_course", "stub_date_of_request", "stub_credential_requested", "stub_date_of_release",
    "stub_assessed_by", "stub_or_number", "footer_note",
    *PRICE_FIELDS.values(), RUSH_PRICE_FIELD,
})
CHECKBOX_FIELDS = frozenset({
    "classification_student", "classification_alumnus", "already_requested_yes", "already_requested_no",
    "cleared_yes", "cleared_no", RUSH_FIELD,
    *DOCUMENT_FIELDS.values(), *CAV_AGENCY_FIELDS.values(), *CERTIFICATION_FIELDS.values(), *PURPOSE_FIELDS.values(),
})
REQUIRED_FIELDS = TEXT_FIELDS | CHECKBOX_FIELDS


def _date(value):
    return f"{value:%m/%d/%Y}" if value else None


def catalog_price(fee, pricing_unit) -> str:
    """A Part 2 price as the paper form writes them: "(₱100)", or "(₱150/pg)" for a per-page document."""
    if fee is None:
        return "(no set fee)"
    fee = Decimal(fee)
    number = f"{fee:,.0f}" if fee == fee.to_integral_value() else f"{fee:,.2f}"
    return f"(₱{number}{'/pg' if pricing_unit == 'per_page' else ''})"


def part2_prices() -> dict:
    """Today's fee for every line of Part 2, read fresh on every render, paid request or not.

    This is a price list, not what this request costs: that is the Amount field, which locks at payment. A document
    missing from the catalogue leaves its line without a price rather than showing a stale one.
    """
    documents = TransactionType.objects.filter(code__in=PART2_CODES).only("code", "fee_amount", "pricing_unit")
    prices = {PRICE_FIELDS[d.code]: catalog_price(d.fee_amount, d.pricing_unit) for d in documents}
    prices[RUSH_PRICE_FIELD] = catalog_price(RUSH_FEE, "flat")
    return prices


def official_form_values(form_request) -> tuple[dict, set[str]]:
    """What goes in each field: text by field name, and the names of the boxes to tick."""
    user = form_request.user
    profile = getattr(user, "user_profile", None)
    submission = getattr(form_request, "submission", None)
    data = (submission.form_data if submission else None) or {}
    text: dict = {}
    checked: set[str] = set()

    name = student_name(user, profile)
    course = profile.course if profile else None
    # A code the form expects: offer the abbreviation before shrinking a long degree title.
    course_choices = (course, abbreviate(course)) if course else None
    requested_on = _date(local(form_request.created_at))
    text.update({
        "signature_over_printed_name": name,
        "course": course_choices,
        "date_of_request": requested_on,
        "birth_date": _date(profile.birth_date) if profile else None,
        "contact_no": user.contact_number,
        "date_of_graduation": data.get("graduation_date"),
    })

    # The two lines are independent on the paper form too: an alumnus now in grad school ticks both.
    statuses = data.get("academic_status") or (profile.academic_status if profile else [])
    if is_student(statuses):
        checked.add("classification_student")
    if is_alumnus(statuses):
        checked.add("classification_alumnus")
    # Graduates give a graduation date; anyone still enrolled, or without one, also gives their last semester.
    if is_student(statuses) or not data.get("graduation_date"):
        text["last_semester_sy"] = data.get("semester")

    # Answered from the student's own history, deliberately not from duplicate_flag.
    prior = (
        type(form_request)
        .objects.filter(user=user, transaction_type=form_request.transaction_type)
        .exclude(pk=form_request.pk)
        .order_by("-created_at")
        .first()
    )
    checked.add("already_requested_yes" if prior else "already_requested_no")
    if prior is not None:
        text["previously_requested_document"] = form_request.transaction_type.name
        text["previously_requested_date"] = _date(local(prior.created_at))

    # Left blank unless Front Desk recorded a clearance: the form treats it as the student's own declaration.
    if form_request.clearance_check_result == "Cleared":
        checked.add("cleared_yes")
    elif form_request.clearance_check_result == "Not Cleared":
        checked.add("cleared_no")

    # Part 2
    document_name = form_request.transaction_type.name
    if form_request.transaction_type.code in DOCUMENT_FIELDS:
        checked.add(DOCUMENT_FIELDS[form_request.transaction_type.code])
    text.update(part2_prices())
    if form_request.is_rush:
        checked.add(RUSH_FIELD)
    agency = data.get("cav_agency")
    if agency in CAV_AGENCY_FIELDS:
        checked.add(CAV_AGENCY_FIELDS[agency])
        if agency == "Others":
            text["cav_others_specify"] = data.get("cav_agency_other")
    for subtype in data.get("certification_subtypes") or []:
        if subtype in CERTIFICATION_FIELDS:
            checked.add(CERTIFICATION_FIELDS[subtype])

    # Part 3
    purpose = data.get("purpose")
    if purpose in PURPOSE_FIELDS:
        checked.add(PURPOSE_FIELDS[purpose])
    if purpose == "Others":
        text["purpose_others_specify"] = data.get("purpose_other")
    if purpose == "For Completion of INC":
        text["inc_semester_taken"] = data.get("semester_taken")
        text["inc_subject_code"] = data.get("subject_code")

    # Verified stays blank for the Front Desk's own signature. Approved names the Registrar staff who approved it in
    # TrailSync, beside the University Registrar's name that the form itself prints.
    approver = form_request.registrar_approved_by
    approver_name = approver.user.get_full_name() if approver else None
    text["approved_by_name"] = approver_name

    # Today's fee until payment is logged; the locked amount on the archived copy made at payment.
    amount = form_request.current_amount_due()
    text["amount"] = money(amount)
    # Blank until the stage that fills them has happened.
    scheduled = form_request.scheduled_release()
    release_on = _date(scheduled[0]) if scheduled else None
    text.update({
        "or_number": form_request.or_number,
        "payment_date": _date(form_request.payment_date),
        "date_of_release": release_on,
    })

    # Claim stub
    text.update({
        "stub_name": name,
        "stub_course": course_choices,
        "stub_date_of_request": requested_on,
        "stub_credential_requested": document_name,
        "stub_date_of_release": release_on,
        "stub_assessed_by": approver_name,
        "stub_or_number": form_request.or_number,
    })

    text["footer_note"] = _footer(form_request, data, amount, approver)
    return text, checked


def _footer(form_request, data, amount, approver) -> str:
    """The tracking number, and the working behind the amount, which the paper form has no boxes for."""
    bits = [f"TrailSync {form_request.request_code}"]
    if amount is not None:
        extras = []
        # The rate is worked back from the amount rather than read from the fee, so it always matches the total.
        if form_request.page_count:
            try:
                copies = max(1, int(data.get("number_of_copies")))
            except (TypeError, ValueError):
                copies = 1
            rate = (amount - form_request.fee_add_ons()) / (form_request.page_count * copies)
            extras.append(
                f"{form_request.page_count} page{'s' if form_request.page_count != 1 else ''} x {copies} "
                f"cop{'ies' if copies != 1 else 'y'} at {money(rate)}/page"
            )
        if form_request.is_rush:
            extras.append(f"incl. rush {money(RUSH_FEE)}")
        if data.get("purpose") == "For Completion of INC":
            extras.append(f"incl. INC {money(COMPLETION_OF_INC_FEE)}")
        bits.append(f"Assessed {money(amount)}" + (f" ({', '.join(extras)})" if extras else ""))
    if approver is not None and form_request.registrar_approved_at:
        bits.append(f"Approved by {approver.user.get_full_name()} on {local(form_request.registrar_approved_at):%b %d, %Y %I:%M %p}")
    bits.append(f"Generated {local(timezone.now()):%b %d, %Y %I:%M %p}")
    return "  ·  ".join(bits)


def build_official_form_pdf(form_request) -> bytes:
    """The filled, flattened form for one FormRequest. Callers own authorisation and the receipt_available() check."""
    text, checked = official_form_values(form_request)
    return fill_pdf(
        TEMPLATE,
        text,
        checked,
        required=REQUIRED_FIELDS,
        metadata={
            "/Title": f"Request for Credential/s Form — {form_request.request_code}",
            "/Author": "USTP-CDO Office of the Registrar",
            "/Subject": "FM-USTP-RGTR-09",
        },
    )


def archive_official_form(form_request) -> None:
    """Keep the form as it stood when the payment was logged: a record, written once.

    Downloads never serve it. They are drawn fresh every time, because Part 2's price list must always be today's; the
    amount on them stays the locked one regardless, since that comes from amount_due.
    """
    with transaction.atomic():
        # Row-locked so two payments can't both write a record.
        submission = FormSubmission.objects.select_for_update().filter(form_request_id=form_request.pk).first()
        if submission is None or submission.generated_pdf_path:
            return
        submission.generated_pdf_path.save(
            f"{form_request.request_code}.pdf", ContentFile(build_official_form_pdf(form_request)), save=False
        )
        submission.save(update_fields=["generated_pdf_path"])
