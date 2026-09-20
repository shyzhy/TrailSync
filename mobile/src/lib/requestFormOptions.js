// The choices the request form offers, mirroring the web app's list so both ask for exactly the same things.
export const STEP_LABELS = ['Choose document', 'Your details', 'Who picks it up', 'Check & send'];

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

// Sub-selections belonging to one document type each; `value` is stored exactly as printed.
export const CAV_AGENCIES = [
  { value: 'DFA', label: 'Department of Foreign Affairs (DFA)', hint: 'Often needed to work or study abroad' },
  { value: 'CHED', label: 'Commission on Higher Education (CHED)' },
  { value: 'DEP-ED', label: 'Department of Education (DepEd)' },
  { value: 'PNP', label: 'Philippine National Police (PNP)' },
  { value: 'POEA', label: 'Philippine Overseas Employment Administration (POEA)', hint: 'For jobs abroad' },
  { value: 'BFP', label: 'Bureau of Fire Protection (BFP)' },
  { value: 'BJMP', label: 'Bureau of Jail Management and Penology (BJMP)' },
  { value: 'Others', label: 'Another agency' },
];

export const CERTIFICATION_SUBTYPES = [
  { value: 'CAR' },
  { value: 'GPA', hint: 'Your grade point average' },
  { value: 'Endorsement' },
  { value: 'Officially enrolled', hint: 'That you’re currently enrolled' },
  { value: 'Subjects enrolled', hint: 'The subjects you’re taking this term' },
  { value: 'USTP Conversion' },
  { value: 'English Medium of Instruction', hint: 'That your classes were taught in English' },
  { value: 'Authorization Letter' },
  { value: 'Letter of No Objection', hint: 'That the university doesn’t object to you studying elsewhere' },
  { value: 'Graduated', hint: 'That you graduated, and when' },
  { value: 'Earned units', hint: 'The units you’ve completed so far' },
  { value: 'Grading System', hint: 'How USTP’s grading scale works' },
  { value: 'Subjects w/ grades', hint: 'Your subjects, together with your grades' },
  { value: 'Others', hint: 'Something not listed — describe it in Additional notes' },
];

export const needsCavAgency = (name) => (name || '').toLowerCase().includes('cav');
export const needsCertificationSubtypes = (name) => (name || '').toLowerCase().startsWith('certification');
