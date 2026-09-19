"""The Released Documents master sheet as .xlsx, built server-side because it has columns the screen doesn't show."""
from datetime import date, datetime

from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# (header, width), in the order of the office's sheet.
COLUMNS = [
    ("No.", 6),
    ("Name", 26),
    ("Course", 26),
    ("Graduated 2018 onwards", 14),
    ("Credential Requested", 24),
    ("Qty", 6),
    ("Purpose", 22),
    ("Date Requested", 14),
    ("Processing Time", 14),
    ("Eligibility Check Result", 20),
    ("Date Claimed", 14),
    ("Printed Name", 24),
]

HEADER_FILL = PatternFill("solid", fgColor="1F2937")
HEADER_FONT = Font(bold=True, color="FAF8F3", size=11)
TITLE_FONT = Font(bold=True, size=14)
THIN = Side(style="thin", color="D9D4C7")
CELL_BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def _form_data(form_request):
    submission = getattr(form_request, "submission", None)
    return (submission.form_data if submission else None) or {}


def _graduated_2018_onwards(form_data):
    """Yes / No / Not a graduate, from the date itself: the archive flag is false for a high school alumnus of any year."""
    raw = form_data.get("graduation_date")
    try:
        graduated = date.fromisoformat(raw) if raw else None
    except (TypeError, ValueError):
        graduated = None
    if graduated is None:
        return "Not a graduate"
    return "Yes" if graduated >= date(2018, 1, 1) else "No"


def _processing_time(form_request, claimed_at):
    """Calendar days from submission to collection, measured from the two timestamps that are always set."""
    if claimed_at is None:
        return "—"
    days = (timezone.localtime(claimed_at).date() - timezone.localtime(form_request.created_at).date()).days
    if days <= 0:
        return "Same day"
    return f"{days} day" if days == 1 else f"{days} days"


def _purpose(form_data):
    purpose = form_data.get("purpose")
    if purpose == "Others":
        return form_data.get("purpose_other") or "Others"
    return purpose or "—"


def _local_date(value):
    """A date openpyxl can write as a real date cell, not a string."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return timezone.localtime(value).date()
    return value if isinstance(value, date) else None


def released_rows(form_requests):
    """One list-of-values row per request, in COLUMNS order."""
    rows = []
    for index, fr in enumerate(form_requests, start=1):
        form_data = _form_data(fr)
        profile = getattr(fr.user, "user_profile", None)
        schedule = getattr(fr, "release_schedule", None)
        claimed_at = schedule.claimed_at if schedule else None
        rows.append(
            [
                index,
                fr.user.get_full_name() or fr.user.email,
                (profile.course if profile else None) or "—",
                _graduated_2018_onwards(form_data),
                fr.transaction_type.name,
                form_data.get("number_of_copies") or 1,
                _purpose(form_data),
                _local_date(fr.created_at),
                _processing_time(fr, claimed_at),
                fr.clearance_check_result or "—",
                _local_date(claimed_at),
                (schedule.claimant_name if schedule else None) or "—",
            ]
        )
    return rows


def build_released_workbook(form_requests, date_from=None, date_to=None):
    """An HttpResponse carrying the .xlsx, ready to return from a view."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Released Documents"

    span = "All dates"
    if date_from or date_to:
        span = f"{date_from or 'start'} to {date_to or 'today'}"

    ws["A1"] = "Released Documents — USTP-CDO Registrar, Window 6"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = f"{span} · {len(form_requests)} document(s) · generated {timezone.localtime():%B %d, %Y %I:%M %p}"
    ws["A2"].font = Font(size=10, color="5B6474")

    header_row = 4
    for col, (header, width) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=header_row, column=col, value=header)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = CELL_BORDER
        ws.column_dimensions[get_column_letter(col)].width = width
    ws.row_dimensions[header_row].height = 30

    for r, values in enumerate(released_rows(form_requests), start=header_row + 1):
        for c, value in enumerate(values, start=1):
            cell = ws.cell(row=r, column=c, value=value)
            cell.border = CELL_BORDER
            cell.alignment = Alignment(
                horizontal="center" if c in (1, 4, 6, 9) else "left",
                vertical="center",
                wrap_text=c in (2, 3, 5, 7, 12),
            )
            if isinstance(value, date):
                cell.number_format = "mmm d, yyyy"

    # Keeps the headers visible while scrolling a long record.
    ws.freeze_panes = ws.cell(row=header_row + 1, column=1)
    ws.auto_filter.ref = (
        f"A{header_row}:{get_column_letter(len(COLUMNS))}{header_row + len(form_requests)}"
    )

    filename = f"Released-Documents-{timezone.localdate():%Y-%m-%d}.xlsx"
    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response
