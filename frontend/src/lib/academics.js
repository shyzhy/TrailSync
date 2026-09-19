// Choice lists for a student's academic profile. COURSES is still a placeholder awaiting USTP–CDO's real programmes.

export const COURSES = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Computer Engineering',
  'BS Civil Engineering',
  'BS Electrical Engineering',
  'BS Electronics Engineering',
  'BS Mechanical Engineering',
  'BS Chemical Engineering',
  'BS Architecture',
  'BS Accountancy',
  'BS Business Administration',
  'BS Food Technology',
  'BS Environmental Science',
  'BS Secondary Education',
];

// Mirrors the server (TrailSync/academics.py) and the two lines of the printed form; any number can be ticked at once.
export const ACADEMIC_STATUS_OPTIONS = [
  { value: 'Undergraduate Student', hint: 'Taking a bachelor’s degree now' },
  { value: 'Graduate/Masteral Student', hint: 'Taking a master’s or doctorate now' },
  { value: 'Alumnus — High School', hint: 'Finished high school at USTP' },
  { value: 'Alumnus — Undergraduate', hint: 'Finished a bachelor’s degree at USTP' },
  { value: 'Alumnus — Graduate/Masteral', hint: 'Finished a master’s or doctorate at USTP' },
];

export const isAlumnus = (statuses) => (statuses || []).some((s) => s.startsWith('Alumnus'));
// College alumni only: pre-2018 college records are in the archive, high school ones aren't.
export const hasCollegeAlumnus = (statuses) =>
  (statuses || []).some((s) => s === 'Alumnus — Undergraduate' || s === 'Alumnus — Graduate/Masteral');

// The ticked options in the form's order, for one line of text.
export function academicStatusLine(statuses) {
  const chosen = new Set(statuses || []);
  return ACADEMIC_STATUS_OPTIONS.filter((o) => chosen.has(o.value))
    .map((o) => o.value)
    .join(', ');
}

// "Last semester attended": the same format and plausibility rules the server applies, so mistakes show before saving.
export const SEMESTER_EXAMPLE = '2nd Semester, SY 2024-2025';
const SEMESTER_RE =
  /^\s*(?:(1st|first)\s*sem(?:ester)?|(2nd|second)\s*sem(?:ester)?|(summer))\s*,?\s*(?:s\.?\s*y\.?|school\s+year)\s*(\d{4})\s*[-–—]\s*(\d{4})\s*$/i;
const TERM_NAMES = ['1st Semester', '2nd Semester', 'Summer'];
const EARLIEST_SCHOOL_YEAR = 1950;

// Aug–Dec is the 1st semester, Jan–May the 2nd, Jun–Jul summer.
function currentTerm(today = new Date()) {
  const month = today.getMonth() + 1;
  if (month >= 8) return [today.getFullYear(), 0];
  if (month <= 5) return [today.getFullYear() - 1, 1];
  return [today.getFullYear() - 1, 2];
}

// { value } in the canonical spelling, or { error } in words a student can act on.
export function checkSemester(text) {
  if (!(text || '').trim()) return { error: 'Please enter the last semester you attended.' };
  const m = SEMESTER_RE.exec(text);
  if (!m) {
    return {
      error: `Please write it like “${SEMESTER_EXAMPLE}”: the semester (1st Semester, 2nd Semester or Summer), then SY and the school year.`,
    };
  }
  const start = Number(m[4]);
  const end = Number(m[5]);
  if (end !== start + 1) return { error: `A school year runs over two years in a row, like SY ${start}-${start + 1}.` };
  const term = m[1] ? 0 : m[2] ? 1 : 2;
  const [nowStart, nowTerm] = currentTerm();
  if (start > nowStart || (start === nowStart && term > nowTerm)) {
    return { error: 'That semester hasn’t happened yet. Enter the last one you actually attended.' };
  }
  if (start < EARLIEST_SCHOOL_YEAR) {
    return { error: `Please check the school year; it should be SY ${EARLIEST_SCHOOL_YEAR}-${EARLIEST_SCHOOL_YEAR + 1} or later.` };
  }
  return { value: `${TERM_NAMES[term]}, SY ${start}-${end}` };
}
