"""Academic status options and the "last semester attended" format, shared by onboarding, the profile and requests."""
import re
from datetime import date

# Mirrors the two lines of FM-USTP-RGTR-09 ("Student (Undergrad/Graduate)" and "Alumnus (High School/Undergrad/Graduate)"),
# split so someone can be several at once, e.g. an undergraduate alumnus now in a master's programme.
UNDERGRADUATE_STUDENT = "Undergraduate Student"
GRADUATE_STUDENT = "Graduate/Masteral Student"
ALUMNUS_HIGH_SCHOOL = "Alumnus — High School"
ALUMNUS_UNDERGRADUATE = "Alumnus — Undergraduate"
ALUMNUS_GRADUATE = "Alumnus — Graduate/Masteral"

ACADEMIC_STATUS_OPTIONS = (
    UNDERGRADUATE_STUDENT,
    GRADUATE_STUDENT,
    ALUMNUS_HIGH_SCHOOL,
    ALUMNUS_UNDERGRADUATE,
    ALUMNUS_GRADUATE,
)
STUDENT_STATUSES = frozenset({UNDERGRADUATE_STUDENT, GRADUATE_STUDENT})
ALUMNUS_STATUSES = frozenset({ALUMNUS_HIGH_SCHOOL, ALUMNUS_UNDERGRADUATE, ALUMNUS_GRADUATE})
# College graduates only: the pre-2018 archive holds college records, not high school ones.
ARCHIVE_STATUSES = frozenset({ALUMNUS_UNDERGRADUATE, ALUMNUS_GRADUATE})


def is_student(statuses):
    return any(s in STUDENT_STATUSES for s in statuses or ())


def is_alumnus(statuses):
    return any(s in ALUMNUS_STATUSES for s in statuses or ())


def ordered_statuses(statuses):
    """The chosen options in the form's own order, without duplicates."""
    chosen = set(statuses or ())
    return [s for s in ACADEMIC_STATUS_OPTIONS if s in chosen]


# "1st Semester, SY 2024-2025", "2nd Semester, SY 2024-2025" or "Summer, SY 2024-2025". Case, spacing, "Sem" and "S.Y."
# are forgiven, then the value is stored in that one canonical spelling.
SEMESTER_EXAMPLE = "2nd Semester, SY 2024-2025"
_SEMESTER_RE = re.compile(
    r"^\s*(?:(?P<first>1st|first)\s*sem(?:ester)?|(?P<second>2nd|second)\s*sem(?:ester)?|(?P<summer>summer))"
    r"\s*,?\s*(?:s\.?\s*y\.?|school\s+year)\s*(?P<start>\d{4})\s*[-–—]\s*(?P<end>\d{4})\s*$",
    re.IGNORECASE,
)
TERM_NAMES = ("1st Semester", "2nd Semester", "Summer")
# A plausibility floor, not a founding date: nobody requesting records today last attended before this.
EARLIEST_SCHOOL_YEAR = 1950


def current_term(today=None):
    """(school-year start, term index) for today: Aug-Dec is the 1st semester, Jan-May the 2nd, Jun-Jul summer."""
    today = today or date.today()
    if today.month >= 8:
        return today.year, 0
    if today.month <= 5:
        return today.year - 1, 1
    return today.year - 1, 2


def normalize_semester(text, today=None):
    """The canonical spelling of a last-semester answer, or ValueError with a message a student can act on."""
    match = _SEMESTER_RE.match(text or "")
    if not match:
        raise ValueError(
            f"Please write it like “{SEMESTER_EXAMPLE}”: the semester (1st Semester, 2nd Semester or Summer), "
            "then SY and the school year."
        )
    start, end = int(match["start"]), int(match["end"])
    if end != start + 1:
        raise ValueError(f"A school year runs over two years in a row, like SY {start}-{start + 1}.")
    term = 0 if match["first"] else 1 if match["second"] else 2
    if (start, term) > current_term(today):
        raise ValueError("That semester hasn’t happened yet. Enter the last one you actually attended.")
    if start < EARLIEST_SCHOOL_YEAR:
        raise ValueError(f"Please check the school year; it should be SY {EARLIEST_SCHOOL_YEAR}-{EARLIEST_SCHOOL_YEAR + 1} or later.")
    return f"{TERM_NAMES[term]}, SY {start}-{end}"
