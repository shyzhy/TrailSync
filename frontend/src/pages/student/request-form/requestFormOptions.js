import {
  BookIcon,
  DocumentIcon,
  GraduationCapIcon,
  GridTableIcon,
  KeyIcon,
  PaperPlaneIcon,
  ShieldIcon,
} from '../../../components/ui/index.js';

// Plain words for each step, not the database's vocabulary.
export const STEP_LABELS = ['Choose document', 'Your details', 'Who picks it up', 'Check & send'];
// Part 3 of FM-USTP-RGTR-09, verbatim and in the form's own order.
export const PURPOSE_OPTIONS = [
  'For Evaluation',
  'For Employment',
  'For Scholarship',
  'For Personal File',
  'For Passport',
  'For Advanced Studies',
  'For Board Exam',
  'For Ranking',
  'For Completion of INC',
  'Others',
];

// Sub-selections belonging to one document type each; `value` is stored exactly as printed, `label` explains it.
export const CAV_AGENCIES = [
  { value: 'DFA', label: 'Department of Foreign Affairs (DFA)', hint: 'Often needed to work or study abroad' },
  { value: 'CHED', label: 'Commission on Higher Education (CHED)' },
  { value: 'DEP-ED', label: 'Department of Education (DepEd)' },
  { value: 'PNP', label: 'Philippine National Police (PNP)' },
  {
    value: 'POEA',
    label: 'Philippine Overseas Employment Administration (POEA)',
    hint: 'For jobs abroad — now part of the Department of Migrant Workers',
  },
  { value: 'BFP', label: 'Bureau of Fire Protection (BFP)' },
  { value: 'BJMP', label: 'Bureau of Jail Management and Penology (BJMP)' },
  { value: 'Others', label: 'Another agency' },
];

// Descriptions only where the meaning is certain; guessing what a certification says would be worse than the name alone.
export const CERTIFICATION_SUBTYPES = [
  { value: 'CAR', hint: null },
  { value: 'GPA', hint: 'Your grade point average' },
  { value: 'Endorsement', hint: null },
  { value: 'Officially enrolled', hint: "That you're currently enrolled" },
  { value: 'Subjects enrolled', hint: "The subjects you're taking this term" },
  { value: 'USTP Conversion', hint: null },
  { value: 'English Medium of Instruction', hint: 'That your classes were taught in English — often asked for abroad' },
  { value: 'Authorization Letter', hint: null },
  { value: 'Letter of No Objection', hint: "That the university doesn't object to you studying elsewhere" },
  { value: 'Graduated', hint: 'That you graduated, and when' },
  { value: 'Earned units', hint: "The units you've completed so far" },
  { value: 'Grading System', hint: "How USTP's grading scale works" },
  { value: 'Subjects w/ grades', hint: 'Your subjects, together with your grades' },
  { value: 'Others', hint: 'Something not listed — describe it in Additional notes' },
];
export const RELATIONSHIP_OPTIONS = ['Parent', 'Sibling', 'Spouse', 'Friend', 'Other'];

// Matched by name, since the catalogue can hold documents beyond this set; unknown ones get the generic icon.
export function iconForTransactionType(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('transcript')) return GridTableIcon;
  if (n.includes('enrollment')) return GraduationCapIcon;
  if (n.includes('grades')) return BookIcon;
  if (n.includes('diploma')) return ShieldIcon;
  if (n.includes('transfer')) return PaperPlaneIcon;
  if (n.includes('authentication')) return KeyIcon;
  return DocumentIcon;
}

// Falls back to a trimmed requirements summary, so a card is never blank.
export function descriptionForTransactionType(t) {
  if (t.description) return t.description;
  if (t.required_documents) {
    const trimmed = t.required_documents.trim();
    return trimmed.length > 90 ? `${trimmed.slice(0, 87)}…` : trimmed;
  }
  // Only for a document added without a description.
  return 'Issued by the Office of the Registrar.';
}

export function formatFee(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? `₱${n.toFixed(2)}` : null;
}

// Recent semesters generated from today's date: the current term and the three before it, newest first.
export function getSemesterOptions() {
  const now = new Date();
  let year = now.getFullYear();
  let term = now.getMonth() + 1 >= 8 ? 1 : now.getMonth() + 1 <= 5 ? 2 : 3; // 1 = 1st sem, 2 = 2nd sem, 3 = summer
  const options = [];
  for (let i = 0; i < 4; i++) {
    if (term === 1) options.push(`1st Semester, SY ${year}-${year + 1}`);
    else if (term === 2) options.push(`2nd Semester, SY ${year - 1}-${year}`);
    else options.push(`Summer, SY ${year - 1}-${year}`);
    term -= 1;
    if (term === 0) {
      term = 3;
      year -= 1;
    }
  }
  return options;
}

// Mirrors the server's check_upload for the 2x2 photo, so a wrong file is caught when picked.
export const BOARD_EXAM_PHOTO_TYPES = ['image/jpeg', 'image/png'];
export const BOARD_EXAM_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// Which step asks for each answer the server can reject, so a refused submission opens where the fix is; anything else is Step 2.
const STEP_FOR_FIELD = { transaction_type: 1, proxy: 3, proxy_full_name: 3, relationship: 3, contact_number: 3 };
export const stepForField = (key) => STEP_FOR_FIELD[key] ?? 2;

// Answers that show their server message directly under their own field.
export const INLINE_FIELDS = new Set([
  'purpose',
  'purpose_other',
  'semester_taken',
  'subject_code',
  'board_exam_photo',
  'cav_agency',
  'certification_subtypes',
  'number_of_copies',
  'number_of_pages',
  'semester',
  'graduation_date',
  'proxy_full_name',
  'relationship',
  'contact_number',
]);
