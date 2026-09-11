import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookIcon,
  CheckIcon,
  CheckSealIcon,
  ChevronIcon,
  DocumentIcon,
  FONT_SERIF,
  GraduationCapIcon,
  GridTableIcon,
  HelpTip,
  KeyIcon,
  PaperPlaneIcon,
  ShieldIcon,
  Spinner,
  UploadIcon,
  WarningIcon,
} from './trailsyncUI.jsx';
import StudentShell from './StudentShell.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';
import { NETWORK_ERROR, friendlySummary } from '../lib/friendlyErrors.js';

const LOGIN_PATH = '/';
const DASHBOARD_PATH = '/portal';

// Plain words for each step. "Proxy Assignment" and "Select Service" were
// the database's vocabulary, not the student's.
const STEP_LABELS = ['Choose document', 'Your details', 'Who picks it up', 'Check & send'];
// Part 3 of FM-USTP-RGTR-09, verbatim and in the form's own order.
const PURPOSE_OPTIONS = [
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

// Sub-selections that belong to one document type each, from Part 2. They
// are submission detail rather than separate documents, so they ride along
// in form_data instead of being their own transaction types.
//
// `value` is what is stored and what the server validates against, so it stays
// exactly as printed on the paper form. `label` is what a first-time requester
// reads: an unexplained "BJMP" or "POEA" means nothing to most people.
const CAV_AGENCIES = [
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

// Descriptions only where the meaning is certain. The four without one (CAR,
// Endorsement, USTP Conversion, Authorization Letter) are printed on the form
// with no explanation, and guessing at what an official certification says
// would be worse than showing the name alone - see the chat note.
const CERTIFICATION_SUBTYPES = [
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
const RELATIONSHIP_OPTIONS = ['Parent', 'Sibling', 'Spouse', 'Friend', 'Other'];

// Pattern-matched rather than keyed by id, since TRANSACTION_TYPES is fetched
// from the backend and can contain document names beyond this starter set —
// anything unrecognized just falls back to the generic document icon.
function iconForTransactionType(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('transcript')) return GridTableIcon;
  if (n.includes('enrollment')) return GraduationCapIcon;
  if (n.includes('grades')) return BookIcon;
  if (n.includes('diploma')) return ShieldIcon;
  if (n.includes('transfer')) return PaperPlaneIcon;
  if (n.includes('authentication')) return KeyIcon;
  return DocumentIcon;
}

// "A short description" per document type, falling back to a trimmed
// required_documents summary when no description is set, so a card is never
// left blank just because that field wasn't filled in on the backend.
function descriptionForTransactionType(t) {
  if (t.description) return t.description;
  if (t.required_documents) {
    const trimmed = t.required_documents.trim();
    return trimmed.length > 90 ? `${trimmed.slice(0, 87)}…` : trimmed;
  }
  // Only reached for a document an admin adds without a description; the
  // catalogue ships with one for every type.
  return 'Issued by the Office of the Registrar.';
}

function formatFee(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? `₱${n.toFixed(2)}` : null;
}

// "Dropdown of recent semesters" — generated from today's date rather than
// fetched, since this is a UI convenience list, not master data. Covers the
// current term plus the three before it, newest first.
function getSemesterOptions() {
  const now = new Date();
  let year = now.getFullYear();
  let term = now.getMonth() + 1 >= 8 ? 1 : now.getMonth() + 1 <= 5 ? 2 : 3; // 1=1st sem, 2=2nd sem, 3=summer
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

/** "a", "a and b", "a, b and c" - for a sentence, not a bullet list. */
function joinList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Says why the Next button is greyed out. Shown only while something is
 * missing, and politely - it's guidance, not an error, since the student
 * hasn't done anything wrong by not having filled it in yet.
 */
function MissingHint({ items }) {
  if (!items.length) return null;
  const [first, ...rest] = items;
  const text = items.length === 1 && first.startsWith('choose') ? `${first[0].toUpperCase()}${first.slice(1)} to continue.` : `To continue, add ${joinList([first, ...rest])}.`;
  return (
    <p className="ts-soft text-right text-sm" aria-live="polite">
      {text}
    </p>
  );
}

function Stepper({ current }) {
  return (
    <div className="mb-9 flex items-start">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const state = num < current ? 'done' : num === current ? 'current' : 'upcoming';
        return (
          <div key={label} className={`flex items-center ${num < STEP_LABELS.length ? 'flex-1' : ''}`}>
            {/* Four fixed 84px columns plus connectors came to 384px, wider
                than a 375px phone once the page gutters were counted. */}
            <div className="flex w-[68px] flex-col items-center sm:w-[84px]">
              <span className={`ts-step-badge ts-step-badge-${state}`}>
                {state === 'done' ? <CheckIcon /> : num}
              </span>
              <span
                className={`mt-2 text-center text-xs leading-snug ${
                  state === 'current' ? 'ts-ink font-semibold' : 'ts-soft'
                }`}
              >
                {label}
              </span>
            </div>
            {num < STEP_LABELS.length && (
              <div className={`ts-step-connector mx-1 sm:mx-2 ${state === 'done' ? 'ts-step-connector-done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequiredMark() {
  return <span className="ts-error-text"> *</span>;
}

function Switch({ checked, onChange, id }) {
  return (
    <span className="ts-switch-wrap">
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="ts-switch-input" />
      <span className="ts-switch-track" aria-hidden="true" />
      <span className="ts-switch-thumb" aria-hidden="true" />
    </span>
  );
}

export default function RequestFormPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [step, setStep] = useState(1);

  // Step 1
  const [transactionTypeId, setTransactionTypeId] = useState('');
  // Open by default: "what you'll need" is exactly what a first-timer is
  // missing, and hiding it behind a collapse means they never see it.
  const [guideOpen, setGuideOpen] = useState(true);

  // Step 2
  const [purpose, setPurpose] = useState('');
  const [purposeOther, setPurposeOther] = useState('');
  const [numberOfCopies, setNumberOfCopies] = useState(1);
  const [numberOfPages, setNumberOfPages] = useState('');
  const [cavAgency, setCavAgency] = useState('');
  const [certificationSubtypes, setCertificationSubtypes] = useState([]);
  const [semesterTaken, setSemesterTaken] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [semester, setSemester] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [graduationDate, setGraduationDate] = useState('');
  const [boardExamPhoto, setBoardExamPhoto] = useState(null);

  // Step 3
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyFullName, setProxyFullName] = useState('');
  const [proxyRelationship, setProxyRelationship] = useState('');
  const [proxyContactNumber, setProxyContactNumber] = useState('');

  // Step 4
  const [confirmAccurate, setConfirmAccurate] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [result, setResult] = useState(null);

  const semesterOptions = useMemo(() => getSemesterOptions(), []);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [meRes, typesRes] = await Promise.all([authFetch('/api/me/'), authFetch('/api/transaction-types/')]);
      if ([meRes, typesRes].some((r) => r.status === 401)) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (!meRes.ok || !typesRes.ok) throw new Error('One or more requests failed.');

      const [meData, typesData] = await Promise.all([meRes.json(), typesRes.json()]);
      setMe(meData);
      setTransactionTypes(typesData);

      // Deep-link from the Credential Guide ("Request this document"):
      // ?transaction_type=<id> pre-selects Step 1's choice and skips
      // straight to Step 2, but only once that id is confirmed to exist in
      // what the backend actually returned — an invalid/stale id just
      // leaves the student on Step 1 with nothing pre-selected.
      const deepLinkId = new URLSearchParams(window.location.search).get('transaction_type');
      if (deepLinkId && typesData.some((t) => String(t.id) === deepLinkId)) {
        setTransactionTypeId(deepLinkId);
        setStep(2);
      }

      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    load();
  }, [load]);

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  const profile = me?.profile;
  const isAlumni = profile?.user_category === 'Alumni';
  const selectedType = transactionTypes.find((t) => String(t.id) === String(transactionTypeId));
  const requestingAsLine = [me?.first_name && me?.last_name ? `${me.first_name} ${me.last_name}` : null, profile?.course, profile?.user_category === 'Student' ? profile?.year_level : null]
    .filter(Boolean)
    .join(' · ');

  // Reactive per-step validity — this is what actually disables Next/Submit,
  // not just an error message shown after a blocked click.
  // What the chosen document implies: whether it is priced by the page, and
  // whether it carries its own sub-selection. selectedType is derived above.
  const isPerPage = selectedType?.pricing_unit === 'per_page';
  const needsCavAgency = selectedType?.name === 'CAV Certification';
  const needsCertificationSubtypes = selectedType?.name === 'Certification';
  const isIncCompletion = purpose === 'For Completion of INC';

  // What each step still needs, in words a student can act on. The Next
  // buttons are disabled from these SAME lists, so the reason shown under a
  // greyed-out button can never disagree with why it's greyed out - a
  // disabled button with no explanation is where first-time users get stuck.
  // Step 2 mirrors the server's rules, so Next can't walk a student into an
  // error they'd only discover after submitting.
  const step1Missing = transactionTypeId ? [] : ['choose a document'];
  const step2Missing = [
    !purpose && 'what you need it for',
    purpose === 'Others' && !purposeOther.trim() && 'your reason',
    // Listed in the order the fields appear on screen.
    needsCavAgency && !cavAgency && 'the agency',
    needsCertificationSubtypes && certificationSubtypes.length === 0 && 'what the certification should say',
    !(Number(numberOfCopies) >= 1) && 'how many copies',
    !semester && 'the semester',
    isAlumni && !graduationDate && 'your graduation date',
    purpose === 'For Board Exam' && !boardExamPhoto && 'your 2x2 photo',
    isPerPage && !(Number(numberOfPages) >= 1) && 'the number of pages',
    isIncCompletion && !semesterTaken.trim() && 'the semester you took the subject',
    isIncCompletion && !subjectCode.trim() && 'the subject code',
  ].filter(Boolean);
  const step3Missing = proxyEnabled
    ? [
        !proxyFullName.trim() && "the person's full name",
        !proxyRelationship && 'how they are related to you',
        !proxyContactNumber.trim() && 'their contact number',
      ].filter(Boolean)
    : [];

  const step1Valid = step1Missing.length === 0;
  const step2Valid = step2Missing.length === 0;
  const step3Valid = step3Missing.length === 0;
  const step4Valid = confirmAccurate;

  const goToStep = (n) => {
    setGeneralError('');
    setStep(n);
  };

  const handleSubmit = async () => {
    setGeneralError('');
    setSubmitting(true);
    try {
      const formData = {
        purpose,
        purpose_other: purpose === 'Others' ? purposeOther.trim() : '',
        number_of_copies: Number(numberOfCopies),
        semester,
        additional_notes: additionalNotes.trim(),
      };
      if (isAlumni) formData.graduation_date = graduationDate;
      // Only sent when the document or purpose actually asks for it, so a
      // submission never carries answers to questions it was not posed.
      if (isPerPage) formData.number_of_pages = Number(numberOfPages);
      if (needsCavAgency) formData.cav_agency = cavAgency;
      if (needsCertificationSubtypes) formData.certification_subtypes = certificationSubtypes;
      if (isIncCompletion) {
        formData.semester_taken = semesterTaken.trim();
        formData.subject_code = subjectCode.trim();
      }

      const fd = new FormData();
      fd.append('transaction_type', transactionTypeId);
      fd.append('form_data', JSON.stringify(formData));
      if (boardExamPhoto) fd.append('board_exam_photo', boardExamPhoto);
      if (proxyEnabled) {
        fd.append(
          'proxy',
          JSON.stringify({
            proxy_full_name: proxyFullName.trim(),
            relationship: proxyRelationship,
            contact_number: proxyContactNumber.trim(),
          })
        );
      }

      // No Content-Type header here on purpose — the browser sets the
      // multipart boundary itself when the body is a FormData instance.
      const response = await authFetch('/api/form-requests/', { method: 'POST', body: fd });
      if (response.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setGeneralError(friendlySummary(data, "We couldn't send your request. Please check your answers and try again."));
        return;
      }
      setResult(data);
    } catch {
      setGeneralError(NETWORK_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Success screen ----
  if (result) {
    return (
      <StudentShell active="request" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
          <div className="ts-card p-8 text-center sm:p-10">
            <div className="flex justify-center">
              <CheckSealIcon />
            </div>
            <h1 className="ts-ink mt-5 text-2xl font-semibold" style={FONT_SERIF}>
              Your request has been sent!
            </h1>
            <p className="ts-soft mt-3 text-base">
              {result.transaction_type} &middot; Tracking number{' '}
              <strong className="ts-ink">{result.request_code}</strong>
            </p>

            {/* Previously "Status: Submitted" - the raw database value, and no
                hint of what comes next. */}
            <div className="ts-well mx-auto mt-6 max-w-md px-5 py-4 text-left">
              <p className="ts-ink text-sm font-semibold">What happens next</p>
              <ol className="ts-soft mt-2 list-decimal space-y-1.5 pl-5 text-sm">
                <li>The Registrar&rsquo;s office checks your request.</li>
                <li>Once it&rsquo;s approved, you&rsquo;ll print your form and pay at the Cashier.</li>
                <li>We&rsquo;ll tell you when your document is ready to pick up at Window 6.</li>
              </ol>
              <p className="ts-soft mt-3 text-sm">
                Watch the bell at the top of the page &mdash; we&rsquo;ll notify you at every step.
              </p>
            </div>

            <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
              <a href={DASHBOARD_PATH} className="ts-btn-glass flex items-center justify-center px-6 py-2.5 text-sm font-medium">
                Back to home
              </a>
              <a
                href={`/track-requests?search=${encodeURIComponent(result.request_code)}`}
                className="ts-btn-primary flex items-center justify-center px-6 py-2.5 text-sm font-medium"
              >
                See my request
              </a>
            </div>
          </div>
        </main>
      </StudentShell>
    );
  }

  return (
    <StudentShell active="request" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
        <Stepper current={step} />

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mb-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>We couldn&rsquo;t load the form. Please check your internet connection.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Try again
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="ts-card space-y-4 p-6 sm:p-8">
            <div className="ts-skeleton h-6 w-64" />
            <div className="ts-skeleton h-4 w-96" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="ts-skeleton h-28 w-full" />
              <div className="ts-skeleton h-28 w-full" />
              <div className="ts-skeleton h-28 w-full" />
              <div className="ts-skeleton h-28 w-full" />
            </div>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* ============================ STEP 1 ============================ */}
            {step === 1 && (
              <div>
                <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
                  Which document do you need?
                </h1>
                <p className="ts-soft mt-1.5 text-base">
                  Pick one. You&rsquo;ll collect it at Window 6 once it&rsquo;s ready. Not sure which?{' '}
                  <a href="/credential-guide" className="ts-link font-medium">
                    See what each one is for
                  </a>
                  .
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {transactionTypes.map((t) => {
                    const Icon = iconForTransactionType(t.name);
                    const selected = String(t.id) === String(transactionTypeId);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTransactionTypeId(String(t.id))}
                        aria-pressed={selected}
                        className={`ts-select-card p-5 ${selected ? 'ts-select-card-selected' : ''}`}
                      >
                        {selected && (
                          <span className="ts-select-card-check">
                            <CheckIcon />
                          </span>
                        )}
                        <div className="ts-stat-icon ts-stat-icon-blue">
                          <Icon />
                        </div>
                        <p className="ts-ink mt-3 text-sm font-semibold">{t.name}</p>
                        <p className="ts-soft mt-1 text-xs leading-relaxed">{descriptionForTransactionType(t)}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex flex-col items-end gap-2">
                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => goToStep(2)}
                    className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
                  >
                    Next
                  </button>
                  <MissingHint items={step1Missing} />
                </div>
              </div>
            )}

            {/* ============================ STEP 2 ============================ */}
            {step === 2 && (
              <div>
                <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
                  A few details about your {selectedType?.name || 'document'}
                </h1>
                <p className="ts-soft mt-1.5 text-base">
                  Answer the questions below. Anything marked with <span className="ts-error-text">*</span> is required.
                </p>

                {requestingAsLine && (
                  <div className="ts-info-note mt-4 px-3.5 py-2.5 text-sm">
                    <span className="font-semibold">You&rsquo;re requesting as:</span> {requestingAsLine}
                  </div>
                )}

                {selectedType && (selectedType.required_documents || selectedType.processing_time || selectedType.fee_amount) && (
                  <div className="ts-card mt-4 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setGuideOpen((o) => !o)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="ts-ink text-sm font-semibold">Requirements &amp; Processing Time</span>
                      <span className={`ts-soft transition-transform ${guideOpen ? 'rotate-180' : ''}`}>
                        <ChevronIcon />
                      </span>
                    </button>
                    {guideOpen && (
                      <div className="border-t px-4 pb-4 pt-1 text-xs" style={{ borderColor: '#E3DFD2' }}>
                        {selectedType.required_documents && (
                          <p className="ts-soft mt-2">
                            <strong className="ts-ink">You'll need:</strong> {selectedType.required_documents}
                          </p>
                        )}
                        {(selectedType.processing_time || selectedType.fee_amount) && (
                          <p className="ts-soft mt-2">
                            {selectedType.processing_time && <>Processing time: {selectedType.processing_time}</>}
                            {selectedType.processing_time && selectedType.fee_amount ? ' · ' : ''}
                            {formatFee(selectedType.fee_amount) && (
                              <>
                                Fee (paid at the Cashier): {formatFee(selectedType.fee_amount)}{' '}
                                {selectedType.pricing_unit === 'per_page' ? 'per page' : 'per copy'}
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="ts-card mt-4 space-y-5 p-6 sm:p-8">
                  <div>
                    <div className="mb-1.5 flex items-center">
                      <label htmlFor="purpose" className="ts-ink text-sm font-medium">
                        What do you need it for?
                        <RequiredMark />
                      </label>
                      <HelpTip label="Why are we asking?">
                        The reason is printed on your official request form. A few reasons &mdash; like a Board Exam
                        or completing an INC &mdash; need an extra detail or fee, and we&rsquo;ll ask for it here.
                      </HelpTip>
                    </div>
                    <div className="relative">
                      <select
                        id="purpose"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm"
                      >
                        <option value="">Select a purpose</option>
                        {PURPOSE_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                        <ChevronIcon />
                      </span>
                    </div>

                    {purpose === 'Others' && (
                      <input
                        type="text"
                        value={purposeOther}
                        onChange={(e) => setPurposeOther(e.target.value)}
                        placeholder="Tell us what you need it for"
                        aria-label="What you need the document for"
                        className="ts-input mt-3 w-full px-3.5 py-2.5 text-sm"
                      />
                    )}

                    {/* The one purpose on the form that carries its own fee
                        and its own two questions. */}
                    {isIncCompletion && (
                      <div className="ts-well mt-3 space-y-3 px-3.5 py-3.5">
                        <p className="ts-soft text-xs leading-relaxed">
                          Completing an INC (incomplete grade) adds a ₱175.00 fee, paid at the Cashier. Tell us which
                          subject it&rsquo;s for.
                        </p>
                        <div>
                          <label htmlFor="semesterTaken" className="ts-ink mb-1.5 block text-sm font-medium">
                            Semester Taken &amp; S.Y.<RequiredMark />
                          </label>
                          <input
                            id="semesterTaken"
                            type="text"
                            value={semesterTaken}
                            onChange={(e) => setSemesterTaken(e.target.value)}
                            placeholder="e.g. 1st Semester, SY 2023-2024"
                            className="ts-input w-full px-3.5 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="subjectCode" className="ts-ink mb-1.5 block text-sm font-medium">
                            Subject Code<RequiredMark />
                          </label>
                          <input
                            id="subjectCode"
                            type="text"
                            value={subjectCode}
                            onChange={(e) => setSubjectCode(e.target.value)}
                            placeholder="e.g. IT321"
                            className="ts-input w-full px-3.5 py-2.5 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {purpose === 'For Board Exam' && (
                      <div className="mt-3">
                        <label
                          htmlFor="boardExamPhoto"
                          className={`ts-file-drop flex cursor-pointer items-center gap-3 px-4 py-3.5 ${
                            boardExamPhoto ? 'ts-file-drop-filled' : ''
                          }`}
                        >
                          <span className={boardExamPhoto ? 'ts-sage' : 'ts-soft'}>
                            {boardExamPhoto ? <CheckIcon /> : <UploadIcon />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="ts-ink block text-sm font-medium">
                              Upload white-background photo (2x2)
                              <RequiredMark />
                            </span>
                            <span className="ts-soft block truncate text-xs">
                              {boardExamPhoto ? boardExamPhoto.name : 'JPG or PNG, required for Board Exam requests'}
                            </span>
                          </span>
                        </label>
                        <input
                          id="boardExamPhoto"
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) => setBoardExamPhoto(e.target.files?.[0] || null)}
                          className="sr-only"
                        />
                      </div>
                    )}
                  </div>

                  {/* Sub-selections belonging to one document type each. The
                      form asks these as checkboxes within the document, not as
                      separate documents. */}
                  {needsCavAgency && (
                    <div>
                      <div className="mb-1.5 flex items-center">
                        <label htmlFor="cavAgency" className="ts-ink text-sm font-medium">
                          Which agency is this for?
                          <RequiredMark />
                        </label>
                        <HelpTip label="What is a CAV?">
                          CAV stands for Certification, Authentication and Verification. It confirms your school
                          records are genuine for the government office that asked for them &mdash; often needed to
                          work or study abroad.
                        </HelpTip>
                      </div>
                      <div className="relative">
                        <select
                          id="cavAgency"
                          value={cavAgency}
                          onChange={(e) => setCavAgency(e.target.value)}
                          className="ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm"
                        >
                          <option value="">Choose the office that asked for it</option>
                          {CAV_AGENCIES.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                        <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                          <ChevronIcon />
                        </span>
                      </div>
                      <p className="ts-soft mt-1.5 text-xs">
                        {CAV_AGENCIES.find((a) => a.value === cavAgency)?.hint ||
                          "Pick the office you'll be giving the document to. Not sure? Ask whoever requested it from you."}
                      </p>
                    </div>
                  )}

                  {needsCertificationSubtypes && (
                    <div>
                      <div className="mb-1.5 flex items-center">
                        <p className="ts-ink text-sm font-medium">
                          What should the certification say?
                          <RequiredMark />
                        </p>
                        <HelpTip label="What is a certification?">
                          A certification is a short official letter from the Registrar confirming something about your
                          records. Tick everything it needs to cover &mdash; one certification can cover several.
                        </HelpTip>
                      </div>
                      <div className="ts-well grid grid-cols-1 gap-x-4 gap-y-3 px-3.5 py-3.5 sm:grid-cols-2">
                        {CERTIFICATION_SUBTYPES.map(({ value: sub, hint }) => {
                          const checked = certificationSubtypes.includes(sub);
                          return (
                            <label key={sub} className="flex cursor-pointer select-none items-start gap-2.5 text-sm">
                              <span className="ts-checkbox-wrap mt-0.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setCertificationSubtypes((prev) =>
                                      checked ? prev.filter((x) => x !== sub) : [...prev, sub]
                                    )
                                  }
                                  className="ts-checkbox-input"
                                />
                                <span className="ts-checkbox-well" aria-hidden="true">
                                  <svg viewBox="0 0 12 10" fill="none" className="ts-checkbox-check">
                                    <path d="M1 5.2 4.3 8.5 11 1.5" stroke="#FAF8F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </span>
                              </span>
                              <span>
                                <span className="ts-ink block">{sub}</span>
                                {hint && <span className="ts-soft block text-xs">{hint}</span>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="ts-soft mt-1.5 text-xs">Tick at least one.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="numberOfCopies" className="ts-ink mb-1.5 block text-sm font-medium">
                        Number of copies
                        <RequiredMark />
                      </label>
                      <input
                        id="numberOfCopies"
                        type="number"
                        min="1"
                        value={numberOfCopies}
                        onChange={(e) => setNumberOfCopies(e.target.value)}
                        className="ts-input w-full px-3.5 py-2.5 text-sm"
                      />
                      <p className="ts-soft mt-1.5 text-xs">How many separate copies you need.</p>
                    </div>

                    {/* Only for documents the registrar charges by the page.
                        Pages and copies are different questions: two copies
                        of a ten-page transcript is charged for twenty pages. */}
                    {isPerPage && (
                      <div>
                        <label htmlFor="numberOfPages" className="ts-ink mb-1.5 block text-sm font-medium">
                          Number of pages
                          <RequiredMark />
                        </label>
                        <input
                          id="numberOfPages"
                          type="number"
                          min="1"
                          value={numberOfPages}
                          onChange={(e) => setNumberOfPages(e.target.value)}
                          placeholder="e.g. 4"
                          className="ts-input w-full px-3.5 py-2.5 text-sm"
                        />
                        <p className="ts-soft mt-1.5 text-xs">
                          {selectedType?.name} is charged per page
                          {selectedType?.fee_amount ? ` (₱${Number(selectedType.fee_amount).toFixed(2)} each)` : ''}.
                          Ask the registrar if you are unsure how many pages yours runs to.
                        </p>
                      </div>
                    )}

                    <div>
                      <div className="mb-1.5 flex items-center">
                        <label htmlFor="semester" className="ts-ink text-sm font-medium">
                          Your latest semester at USTP
                          <RequiredMark />
                        </label>
                        <HelpTip label="Which semester should I pick?">
                          The most recent semester you were enrolled in. It&rsquo;s printed on your official request
                          form.
                        </HelpTip>
                      </div>
                      <div className="relative">
                        <select
                          id="semester"
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          className="ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm"
                        >
                          <option value="">Choose a semester</option>
                          {semesterOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                          <ChevronIcon />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Alumni-only: current students haven't graduated yet. */}
                  {isAlumni && (
                    <div>
                      <label htmlFor="graduationDate" className="ts-ink mb-1.5 block text-sm font-medium">
                        When did you graduate?
                        <RequiredMark />
                      </label>
                      <input
                        id="graduationDate"
                        type="date"
                        value={graduationDate}
                        onChange={(e) => setGraduationDate(e.target.value)}
                        className="ts-input w-full px-3.5 py-2.5 text-sm"
                      />
                      {/* Mirrors the server's own rule (graduated before 2018 =
                          requires_archive_retrieval), so the student is warned at
                          the moment it applies rather than surprised by a wait. */}
                      {graduationDate && graduationDate < '2018-01-01' && (
                        <div className="ts-info-note mt-2 flex items-start px-3.5 py-2.5 text-sm">
                          <span>
                            Records from before 2018 are kept in the university archive, so this request may take a
                            little longer than usual.
                          </span>
                          <HelpTip label="Why does this take longer?">
                            Older records are stored separately and have to be retrieved by hand before the Registrar
                            can prepare your document.
                          </HelpTip>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="additionalNotes" className="ts-ink mb-1.5 block text-sm font-medium">
                      Additional notes <span className="ts-soft font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="additionalNotes"
                      rows={3}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Anything else Window 6 should know about this request"
                      className="ts-input w-full px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-between gap-3">
                  <button type="button" onClick={() => goToStep(1)} className="ts-btn-glass self-start px-6 py-2.5 text-sm font-medium">
                    Back
                  </button>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      disabled={!step2Valid}
                      onClick={() => goToStep(3)}
                      className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
                    >
                      Next
                    </button>
                    <MissingHint items={step2Missing} />
                  </div>
                </div>
              </div>
            )}

            {/* ============================ STEP 3 ============================ */}
            {step === 3 && (
              <div>
                <div className="flex items-center">
                  <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
                    Who will pick it up?
                  </h1>
                  <HelpTip label="What's a proxy?">
                    A proxy is someone you trust &mdash; like a parent or friend &mdash; who picks up the document for
                    you if you can&rsquo;t go to Window 6 yourself.
                  </HelpTip>
                </div>
                {/* Was "obtain transcripts directly on your behalf" - wrong for
                    every document that isn't a transcript. */}
                <p className="ts-soft mt-1.5 text-base">
                  Most people collect their own document. If someone else will collect it for you, tell us who.
                </p>

                <div className="ts-card mt-6 flex items-center justify-between gap-4 p-5">
                  <label htmlFor="proxyEnabled" className="cursor-pointer">
                    <p className="ts-ink text-sm font-semibold">Someone else will pick it up for me</p>
                    <p className="ts-soft mt-1 text-sm">
                      {proxyEnabled ? 'On — tell us about them below.' : 'Off — you will pick it up yourself.'}
                    </p>
                  </label>
                  <Switch id="proxyEnabled" checked={proxyEnabled} onChange={(e) => setProxyEnabled(e.target.checked)} />
                </div>

                {proxyEnabled && (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="ts-card p-6">
                      <h2 className="ts-ink text-sm font-semibold">About the person picking it up</h2>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="proxyFullName" className="ts-ink mb-1.5 block text-sm font-medium">
                            Their full name
                            <RequiredMark />
                          </label>
                          <input
                            id="proxyFullName"
                            type="text"
                            value={proxyFullName}
                            onChange={(e) => setProxyFullName(e.target.value)}
                            className="ts-input w-full px-3.5 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="proxyRelationship" className="ts-ink mb-1.5 block text-sm font-medium">
                            How are they related to you?
                            <RequiredMark />
                          </label>
                          <div className="relative">
                            <select
                              id="proxyRelationship"
                              value={proxyRelationship}
                              onChange={(e) => setProxyRelationship(e.target.value)}
                              className="ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm"
                            >
                              <option value="">Choose one</option>
                              {RELATIONSHIP_OPTIONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                            <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                              <ChevronIcon />
                            </span>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="proxyContactNumber" className="ts-ink mb-1.5 block text-sm font-medium">
                            Their mobile number
                            <RequiredMark />
                          </label>
                          <input
                            id="proxyContactNumber"
                            type="tel"
                            inputMode="tel"
                            placeholder="09XX XXX XXXX"
                            value={proxyContactNumber}
                            onChange={(e) => setProxyContactNumber(e.target.value)}
                            className="ts-input w-full px-3.5 py-2.5 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Word for word what the official form (FM-USTP-RGTR-09,
                        Reminder B) requires. This card previously asked for a
                        "student-signed" letter and "relationship proof": the
                        form requires a NOTARIZED letter and photocopies of BOTH
                        people's IDs, and no proof of relationship at all. A
                        first-timer following the old wording would have been
                        turned away at the window. */}
                    <div className="ts-warning-card p-6">
                      <div className="flex items-center gap-2">
                        <WarningIcon />
                        <h2 className="text-sm font-semibold">They must bring all three</h2>
                      </div>
                      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                        <li>
                          An authorization letter from you, <strong>notarized</strong> by a lawyer (a signed letter
                          alone won&rsquo;t be accepted)
                        </li>
                        <li>A photocopy of <strong>your</strong> valid ID</li>
                        <li>A photocopy of <strong>their own</strong> valid ID</li>
                      </ol>
                      <p className="mt-3 text-sm leading-relaxed">Without all three, Window 6 can&rsquo;t release your document to them.</p>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-between gap-3">
                  <button type="button" onClick={() => goToStep(2)} className="ts-btn-glass self-start px-6 py-2.5 text-sm font-medium">
                    Back
                  </button>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      disabled={!step3Valid}
                      onClick={() => goToStep(4)}
                      className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
                    >
                      Next
                    </button>
                    <MissingHint items={step3Missing} />
                  </div>
                </div>
              </div>
            )}

            {/* ============================ STEP 4 ============================ */}
            {step === 4 && (
              <div>
                <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
                  Check your request
                </h1>
                <p className="ts-soft mt-1.5 text-base">
                  Look over everything below. Tap <strong className="ts-ink">Edit</strong> to change anything, then send
                  it to the Registrar.
                </p>

                <div className="ts-card mt-6 p-6 sm:p-8">
                  <h2 className="ts-ink text-sm font-semibold">Your request</h2>

                  <div className="mt-2">
                    <div className="ts-review-row flex items-start justify-between gap-4">
                      <div>
                        <p className="ts-review-label">Document</p>
                        <p className="ts-review-value">{selectedType?.name}</p>
                      </div>
                      <button type="button" onClick={() => goToStep(1)} className="ts-link shrink-0 text-sm font-medium">
                        Edit
                      </button>
                    </div>

                    <div className="ts-review-row flex items-start justify-between gap-4">
                      <div>
                        <p className="ts-review-label">What it’s for</p>
                        <p className="ts-review-value">{purpose === 'Others' ? purposeOther : purpose}</p>
                      </div>
                      <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                        Edit
                      </button>
                    </div>

                    <div className="ts-review-row flex items-start justify-between gap-4">
                      <div>
                        <p className="ts-review-label">Number of copies</p>
                        <p className="ts-review-value">{numberOfCopies}</p>
                      </div>
                      <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                        Edit
                      </button>
                    </div>

                    {isPerPage && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div>
                          <p className="ts-review-label">Number of pages</p>
                          <p className="ts-review-value">{numberOfPages}</p>
                        </div>
                        <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    )}

                    {needsCavAgency && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div>
                          <p className="ts-review-label">Agency</p>
                          <p className="ts-review-value">{CAV_AGENCIES.find((a) => a.value === cavAgency)?.label || cavAgency}</p>
                        </div>
                        <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    )}

                    {needsCertificationSubtypes && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="ts-review-label">Certification should say</p>
                          <p className="ts-review-value">{certificationSubtypes.join(', ')}</p>
                        </div>
                        <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    )}

                    {isIncCompletion && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="ts-review-label">Completion of INC</p>
                          <p className="ts-review-value">
                            {semesterTaken} · {subjectCode}
                          </p>
                        </div>
                        <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    )}

                    <div className="ts-review-row flex items-start justify-between gap-4">
                      <div>
                        <p className="ts-review-label">Latest semester</p>
                        <p className="ts-review-value">{semester}</p>
                      </div>
                      <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                        Edit
                      </button>
                    </div>

                    {isAlumni && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div>
                          <p className="ts-review-label">Graduated</p>
                          <p className="ts-review-value">{graduationDate}</p>
                        </div>
                        <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    )}

                    {purpose === 'For Board Exam' && boardExamPhoto && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div>
                          <p className="ts-review-label">2x2 photo</p>
                          <p className="ts-review-value">{boardExamPhoto.name}</p>
                        </div>
                        <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    )}

                    {additionalNotes.trim() && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div>
                          <p className="ts-review-label">Additional notes</p>
                          <p className="ts-review-value font-normal">{additionalNotes}</p>
                        </div>
                        <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    )}

                    {proxyEnabled && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div>
                          <p className="ts-review-label">Picked up by</p>
                          <p className="ts-review-value">
                            {proxyFullName} ({proxyRelationship}) — {proxyContactNumber}
                          </p>
                        </div>
                        <button type="button" onClick={() => goToStep(3)} className="ts-link shrink-0 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {generalError && (
                  <div role="alert" className="ts-banner ts-banner-error mt-4 px-3.5 py-2.5 text-sm">
                    {generalError}
                  </div>
                )}

                <div className="mt-5">
                  <label htmlFor="confirmAccurate" className="flex cursor-pointer select-none items-start gap-2.5">
                    <span className="ts-checkbox-wrap mt-0.5">
                      <input
                        id="confirmAccurate"
                        type="checkbox"
                        checked={confirmAccurate}
                        onChange={(e) => setConfirmAccurate(e.target.checked)}
                        className="ts-checkbox-input"
                      />
                      <span className="ts-checkbox-well" aria-hidden="true">
                        <svg viewBox="0 0 12 10" fill="none" className="ts-checkbox-check">
                          <path
                            d="M1 5.2 4.3 8.5 11 1.5"
                            stroke="#FAF8F3"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </span>
                    <span className="ts-soft text-sm">I’ve checked everything above, and it’s correct.</span>
                  </label>
                </div>

                <div className="mt-8 flex justify-between">
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="ts-btn-glass px-6 py-2.5 text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!step4Valid || submitting}
                    onClick={handleSubmit}
                    className="ts-btn-primary flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium"
                  >
                    {submitting && <Spinner />}
                    {submitting ? 'Sending…' : 'Send request'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </StudentShell>
  );
}
