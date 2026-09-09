import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APP_CSS,
  AppMobileHeader,
  AppSidebar,
  BookIcon,
  CheckIcon,
  CheckSealIcon,
  ChevronIcon,
  DocumentIcon,
  FONT_SANS,
  FONT_SERIF,
  GraduationCapIcon,
  GridTableIcon,
  KeyIcon,
  PaperPlaneIcon,
  ShieldIcon,
  Spinner,
  UploadIcon,
  WarningIcon,
} from './trailsyncUI.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';
const DASHBOARD_PATH = '/portal';

const STEP_LABELS = ['Select Service', 'Form Details', 'Proxy Assignment', 'Review & Submit'];
const PURPOSE_OPTIONS = ['Employment', 'Further studies', 'Scholarship', 'Board Exam', 'Other'];
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
  return 'Registrar document request.';
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

// Backend replies with nested {"form_data": {"field": "message"}, "proxy": {...}}
// (see CreateFormRequestSerializer) — this is a safety-net path (the wizard's
// own per-step gating should prevent reaching submit with invalid data), so
// flattening into one general banner is an acceptable trade-off rather than
// re-implementing per-field mapping across three different form sections.
function flattenServerErrors(data) {
  if (!data || typeof data !== 'object') return 'Could not submit your request. Please try again.';
  const messages = [];
  Object.values(data).forEach((v) => {
    if (typeof v === 'string') messages.push(v);
    else if (Array.isArray(v)) messages.push(...v.filter((x) => typeof x === 'string'));
    else if (v && typeof v === 'object') messages.push(...Object.values(v).filter((x) => typeof x === 'string'));
  });
  return messages.length ? messages.join(' ') : 'Could not submit your request. Please try again.';
}

function Stepper({ current }) {
  return (
    <div className="mb-9 flex items-start">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const state = num < current ? 'done' : num === current ? 'current' : 'upcoming';
        return (
          <div key={label} className={`flex items-center ${num < STEP_LABELS.length ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center" style={{ width: '84px' }}>
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
  const [guideOpen, setGuideOpen] = useState(false);

  // Step 2
  const [purpose, setPurpose] = useState('');
  const [purposeOther, setPurposeOther] = useState('');
  const [numberOfCopies, setNumberOfCopies] = useState(1);
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
  const step1Valid = Boolean(transactionTypeId);
  const step2Valid =
    Boolean(purpose) &&
    (purpose !== 'Other' || purposeOther.trim().length > 0) &&
    Number(numberOfCopies) >= 1 &&
    Boolean(semester) &&
    (!isAlumni || Boolean(graduationDate)) &&
    (purpose !== 'Board Exam' || Boolean(boardExamPhoto));
  const step3Valid =
    !proxyEnabled || (proxyFullName.trim().length > 0 && Boolean(proxyRelationship) && proxyContactNumber.trim().length > 0);
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
        purpose_other: purpose === 'Other' ? purposeOther.trim() : '',
        number_of_copies: Number(numberOfCopies),
        semester,
        additional_notes: additionalNotes.trim(),
      };
      if (isAlumni) formData.graduation_date = graduationDate;

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
        setGeneralError(flattenServerErrors(data));
        return;
      }
      setResult(data);
    } catch {
      setGeneralError('Unable to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Success screen ----
  if (result) {
    return (
      <div className="ts-app-shell lg:flex" style={FONT_SANS}>
        <style>{APP_CSS}</style>
        <AppSidebar active="request" onLogout={handleLogout} me={me} />
        <AppMobileHeader onLogout={handleLogout} />

        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 sm:py-10 lg:px-10">
          <div className="ts-card p-8 text-center sm:p-10">
            <div className="flex justify-center">
              <CheckSealIcon />
            </div>
            <h1 className="ts-ink mt-5 text-2xl font-semibold" style={FONT_SERIF}>
              Your request {result.request_code} has been submitted!
            </h1>
            <p className="ts-soft mt-3 text-sm">
              {result.transaction_type} · Status: {result.request_status}
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={DASHBOARD_PATH}
                className="ts-btn-primary flex items-center justify-center px-6 py-2.5 text-sm font-medium"
              >
                Back to dashboard
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <AppSidebar active="request" onLogout={handleLogout} me={me} />
      <AppMobileHeader onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 sm:py-10 lg:px-10">
        <Stepper current={step} />

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mb-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>Something went wrong loading this form.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Retry
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
                  Choose a Transaction Type
                </h1>
                <p className="ts-soft mt-1.5 text-sm">
                  Select the specific document registrar service you wish to request for collection from Window 6.
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

                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => goToStep(2)}
                    className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* ============================ STEP 2 ============================ */}
            {step === 2 && (
              <div>
                <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
                  Document Request Details
                </h1>
                <p className="ts-soft mt-1.5 text-sm">
                  Provide details concerning your {selectedType?.name || 'document'} request.
                </p>

                {requestingAsLine && (
                  <div className="ts-info-note mt-4 px-3.5 py-2.5 text-xs">
                    <span className="font-semibold">Requesting as:</span> {requestingAsLine}
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
                            {formatFee(selectedType.fee_amount) && <>Fee (payable at the Cashier): {formatFee(selectedType.fee_amount)}</>}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="ts-card mt-4 space-y-5 p-6 sm:p-8">
                  <div>
                    <label htmlFor="purpose" className="ts-ink mb-1.5 block text-sm font-medium">
                      Purpose of Request
                      <RequiredMark />
                    </label>
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

                    {purpose === 'Other' && (
                      <input
                        type="text"
                        value={purposeOther}
                        onChange={(e) => setPurposeOther(e.target.value)}
                        placeholder="Please specify"
                        className="ts-input mt-3 w-full px-3.5 py-2.5 text-sm"
                      />
                    )}

                    {purpose === 'Board Exam' && (
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

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="numberOfCopies" className="ts-ink mb-1.5 block text-sm font-medium">
                        Number of Copies
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
                    </div>

                    <div>
                      <label htmlFor="semester" className="ts-ink mb-1.5 block text-sm font-medium">
                        Specific Semester / Academic Year
                        <RequiredMark />
                      </label>
                      <div className="relative">
                        <select
                          id="semester"
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          className="ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm"
                        >
                          <option value="">Select semester</option>
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
                        Graduation Date
                        <RequiredMark />
                      </label>
                      <input
                        id="graduationDate"
                        type="date"
                        value={graduationDate}
                        onChange={(e) => setGraduationDate(e.target.value)}
                        className="ts-input w-full px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="additionalNotes" className="ts-ink mb-1.5 block text-sm font-medium">
                      Additional Notes <span className="ts-soft font-normal">(optional)</span>
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

                <div className="mt-8 flex justify-between">
                  <button type="button" onClick={() => goToStep(1)} className="ts-btn-glass px-6 py-2.5 text-sm font-medium">
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!step2Valid}
                    onClick={() => goToStep(3)}
                    className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* ============================ STEP 3 ============================ */}
            {step === 3 && (
              <div>
                <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
                  Proxy Assignment Configuration
                </h1>
                <p className="ts-soft mt-1.5 text-sm">
                  Configure whether an authorized proxy is allowed to obtain transcripts directly on your behalf.
                </p>

                <div className="ts-card mt-6 flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="ts-ink text-sm font-semibold">Will someone else claim this document on your behalf?</p>
                    <p className="ts-soft mt-1 text-xs">Enable this configuration to nominate a designated claimant proxy.</p>
                  </div>
                  <Switch id="proxyEnabled" checked={proxyEnabled} onChange={(e) => setProxyEnabled(e.target.checked)} />
                </div>

                {proxyEnabled && (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="ts-card p-6">
                      <h2 className="ts-ink text-sm font-semibold">Nominated Claimant Proxy Information</h2>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="proxyFullName" className="ts-ink mb-1.5 block text-sm font-medium">
                            Proxy Full Name
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
                            Relationship to Student
                            <RequiredMark />
                          </label>
                          <div className="relative">
                            <select
                              id="proxyRelationship"
                              value={proxyRelationship}
                              onChange={(e) => setProxyRelationship(e.target.value)}
                              className="ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm"
                            >
                              <option value="">Select relationship</option>
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
                            Contact Number
                            <RequiredMark />
                          </label>
                          <input
                            id="proxyContactNumber"
                            type="tel"
                            value={proxyContactNumber}
                            onChange={(e) => setProxyContactNumber(e.target.value)}
                            className="ts-input w-full px-3.5 py-2.5 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="ts-warning-card p-6">
                      <div className="flex items-center gap-2">
                        <WarningIcon />
                        <h2 className="text-sm font-semibold">Proxy Claimant Policy</h2>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed">
                        Your nominated proxy claimant must present a valid government-issued photo identification card,
                        relationship proof, and student-signed authorization letter at Window 6 to claim files.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-between">
                  <button type="button" onClick={() => goToStep(2)} className="ts-btn-glass px-6 py-2.5 text-sm font-medium">
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!step3Valid}
                    onClick={() => goToStep(4)}
                    className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* ============================ STEP 4 ============================ */}
            {step === 4 && (
              <div>
                <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
                  Review and Submit Request
                </h1>
                <p className="ts-soft mt-1.5 text-sm">
                  Double check all request details prior to routing to Registrar Window 6.
                </p>

                <div className="ts-card mt-6 p-6 sm:p-8">
                  <h2 className="ts-ink text-sm font-semibold">Request Confirmation Summary</h2>

                  <div className="mt-2">
                    <div className="ts-review-row flex items-start justify-between gap-4">
                      <div>
                        <p className="ts-review-label">Transaction Type</p>
                        <p className="ts-review-value">{selectedType?.name}</p>
                      </div>
                      <button type="button" onClick={() => goToStep(1)} className="ts-link shrink-0 text-sm font-medium">
                        Edit
                      </button>
                    </div>

                    <div className="ts-review-row flex items-start justify-between gap-4">
                      <div>
                        <p className="ts-review-label">Purpose of Request</p>
                        <p className="ts-review-value">{purpose === 'Other' ? purposeOther : purpose}</p>
                      </div>
                      <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                        Edit
                      </button>
                    </div>

                    <div className="ts-review-row flex items-start justify-between gap-4">
                      <div>
                        <p className="ts-review-label">Number of Copies</p>
                        <p className="ts-review-value">{numberOfCopies}</p>
                      </div>
                      <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                        Edit
                      </button>
                    </div>

                    <div className="ts-review-row flex items-start justify-between gap-4">
                      <div>
                        <p className="ts-review-label">Semester / Year</p>
                        <p className="ts-review-value">{semester}</p>
                      </div>
                      <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                        Edit
                      </button>
                    </div>

                    {isAlumni && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div>
                          <p className="ts-review-label">Graduation Date</p>
                          <p className="ts-review-value">{graduationDate}</p>
                        </div>
                        <button type="button" onClick={() => goToStep(2)} className="ts-link shrink-0 text-sm font-medium">
                          Edit
                        </button>
                      </div>
                    )}

                    {purpose === 'Board Exam' && boardExamPhoto && (
                      <div className="ts-review-row flex items-start justify-between gap-4">
                        <div>
                          <p className="ts-review-label">Board Exam Photo</p>
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
                          <p className="ts-review-label">Additional Notes</p>
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
                          <p className="ts-review-label">Claimant Proxy Assignment</p>
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
                    <span className="ts-soft text-sm">I confirm that all information provided is accurate.</span>
                  </label>
                </div>

                <div className="mt-8 flex justify-between">
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="ts-btn-glass px-6 py-2.5 text-sm font-medium"
                  >
                    Back to Proxy
                  </button>
                  <button
                    type="button"
                    disabled={!step4Valid || submitting}
                    onClick={handleSubmit}
                    className="ts-btn-primary flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium"
                  >
                    {submitting && <Spinner />}
                    {submitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
