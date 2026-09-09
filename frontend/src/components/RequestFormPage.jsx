import { useCallback, useEffect, useState } from 'react';
import {
  API_BASE_URL,
  APP_CSS,
  AppMobileHeader,
  AppSidebar,
  CheckSealIcon,
  ChevronIcon,
  FONT_SANS,
  FONT_SERIF,
  Spinner,
} from './trailsyncUI.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';
const DASHBOARD_PATH = '/portal';

const PURPOSE_OPTIONS = ['Employment', 'Further studies', 'Scholarship', 'Other'];

// DRF replies {"<field>": ["message"]}; map those onto this form's state keys
// so each message lands on its own field instead of a generic alert.
const SERVER_FIELD_MAP = {
  transaction_type: 'transactionType',
  release_slot: 'releaseSlot',
  number_of_copies: 'numberOfCopies',
  purpose: 'purpose',
  purpose_other: 'purposeOther',
};

function mapServerErrors(data) {
  const fallback = { general: 'Could not submit your request. Please try again.' };
  if (!data || typeof data !== 'object') return fallback;

  const mapped = {};
  const unattached = [];
  Object.entries(data).forEach(([key, value]) => {
    const message = Array.isArray(value) ? value.filter(Boolean).join(' ') : typeof value === 'string' ? value : null;
    if (!message) return;
    const target = SERVER_FIELD_MAP[key];
    if (target) mapped[target] = message;
    else unattached.push(message);
  });
  if (unattached.length) mapped.general = unattached.join(' ');
  return Object.keys(mapped).length ? mapped : fallback;
}

function formatTime12h(hhmmss) {
  const [h, m] = hhmmss.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatSlotDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatFee(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? `₱${n.toFixed(2)}` : null;
}

function FieldSkeleton() {
  return (
    <div>
      <div className="ts-skeleton h-4 w-32" />
      <div className="ts-skeleton mt-2 h-10 w-full" />
    </div>
  );
}

export default function RequestFormPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [releaseSlots, setReleaseSlots] = useState([]);

  const [transactionTypeId, setTransactionTypeId] = useState('');
  const [numberOfCopies, setNumberOfCopies] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [purposeOther, setPurposeOther] = useState('');
  const [releaseSlotId, setReleaseSlotId] = useState('');
  const [requiresArchiveRetrieval, setRequiresArchiveRetrieval] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [meRes, typesRes, slotsRes] = await Promise.all([
        authFetch('/api/me/'),
        authFetch('/api/transaction-types/'),
        authFetch('/api/release-slots/'),
      ]);

      if ([meRes, typesRes, slotsRes].some((r) => r.status === 401)) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (!meRes.ok || !typesRes.ok || !slotsRes.ok) {
        throw new Error('One or more requests failed.');
      }

      const [meData, typesData, slotsData] = await Promise.all([meRes.json(), typesRes.json(), slotsRes.json()]);
      setMe(meData);
      setTransactionTypes(typesData);
      setReleaseSlots(slotsData);
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

  const isAlumni = me?.profile?.user_category === 'Alumni';
  const selectedType = transactionTypes.find((t) => String(t.id) === String(transactionTypeId));

  // Drop a field's error as soon as the user edits it — otherwise a stale
  // error can linger even after the field is fixed.
  const clearError = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const validate = () => {
    const next = {};
    if (!transactionTypeId) next.transactionType = 'Please select a document type.';
    if (!numberOfCopies || Number(numberOfCopies) < 1) next.numberOfCopies = 'Enter at least 1 copy.';
    if (!purpose) next.purpose = 'Please select a purpose.';
    if (purpose === 'Other' && !purposeOther.trim()) next.purposeOther = 'Please specify your purpose.';
    if (!releaseSlotId) next.releaseSlot = 'Please choose a release slot.';
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const response = await authFetch('/api/form-requests/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: Number(transactionTypeId),
          release_slot: Number(releaseSlotId),
          number_of_copies: Number(numberOfCopies),
          purpose,
          purpose_other: purpose === 'Other' ? purposeOther.trim() : '',
          requires_archive_retrieval: isAlumni ? requiresArchiveRetrieval : false,
        }),
      });

      if (response.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrors(mapServerErrors(data));
        return;
      }

      setResult(data);
    } catch {
      setErrors({ general: 'Unable to reach the server. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Success screen ----
  if (result) {
    return (
      <div className="ts-app-shell lg:flex" style={FONT_SANS}>
        <style>{APP_CSS}</style>
        <AppSidebar active="request" onLogout={handleLogout} />
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
            <a
              href={DASHBOARD_PATH}
              className="ts-btn-primary mt-7 inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium"
            >
              Back to dashboard
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <AppSidebar active="request" onLogout={handleLogout} />
      <AppMobileHeader onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 sm:py-10 lg:px-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Request a form
            </h1>
            <p className="ts-soft mt-1.5 text-sm">Submit a new document request for Window 6.</p>
          </div>
          <a href={DASHBOARD_PATH} className="ts-link shrink-0 text-sm font-medium">
            Cancel
          </a>
        </div>

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mb-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>Something went wrong loading this form.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Retry
            </button>
          </div>
        )}

        <div className="ts-card p-6 sm:p-8">
          {status === 'loading' ? (
            <div className="space-y-5">
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
              <div className="ts-skeleton h-10 w-full" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="transactionType" className="ts-ink mb-1.5 block text-sm font-medium">
                  Document Type
                </label>
                <div className="relative">
                  <select
                    id="transactionType"
                    value={transactionTypeId}
                    onChange={(e) => {
                      setTransactionTypeId(e.target.value);
                      clearError('transactionType');
                    }}
                    aria-invalid={Boolean(errors.transactionType)}
                    className={`ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm ${
                      errors.transactionType ? 'ts-input-error' : ''
                    }`}
                  >
                    <option value="">Select a document</option>
                    {transactionTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <ChevronIcon />
                  </span>
                </div>
                {errors.transactionType && <p className="ts-error-text mt-1.5 text-sm">{errors.transactionType}</p>}

                {selectedType && (
                  <div className="ts-info-note mt-3 px-3.5 py-2.5 text-xs leading-relaxed">
                    {selectedType.required_documents && (
                      <p>
                        <strong>You'll need:</strong> {selectedType.required_documents}
                      </p>
                    )}
                    {(selectedType.processing_time || selectedType.fee_amount) && (
                      <p className={selectedType.required_documents ? 'mt-1' : ''}>
                        {selectedType.processing_time && <>Processing time: {selectedType.processing_time}</>}
                        {selectedType.processing_time && selectedType.fee_amount ? ' · ' : ''}
                        {selectedType.fee_amount && formatFee(selectedType.fee_amount) && (
                          <>Fee: {formatFee(selectedType.fee_amount)}</>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="numberOfCopies" className="ts-ink mb-1.5 block text-sm font-medium">
                  Number of Copies
                </label>
                <input
                  id="numberOfCopies"
                  type="number"
                  min="1"
                  value={numberOfCopies}
                  onChange={(e) => {
                    setNumberOfCopies(e.target.value);
                    clearError('numberOfCopies');
                  }}
                  aria-invalid={Boolean(errors.numberOfCopies)}
                  className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.numberOfCopies ? 'ts-input-error' : ''}`}
                />
                {errors.numberOfCopies && <p className="ts-error-text mt-1.5 text-sm">{errors.numberOfCopies}</p>}
              </div>

              <div>
                <label htmlFor="purpose" className="ts-ink mb-1.5 block text-sm font-medium">
                  Purpose
                </label>
                <div className="relative">
                  <select
                    id="purpose"
                    value={purpose}
                    onChange={(e) => {
                      setPurpose(e.target.value);
                      clearError('purpose');
                    }}
                    aria-invalid={Boolean(errors.purpose)}
                    className={`ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm ${
                      errors.purpose ? 'ts-input-error' : ''
                    }`}
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
                {errors.purpose && <p className="ts-error-text mt-1.5 text-sm">{errors.purpose}</p>}

                {purpose === 'Other' && (
                  <div className="mt-3">
                    <label htmlFor="purposeOther" className="ts-ink mb-1.5 block text-sm font-medium">
                      Please specify
                    </label>
                    <input
                      id="purposeOther"
                      type="text"
                      value={purposeOther}
                      onChange={(e) => {
                        setPurposeOther(e.target.value);
                        clearError('purposeOther');
                      }}
                      aria-invalid={Boolean(errors.purposeOther)}
                      placeholder="e.g. Visa application"
                      className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.purposeOther ? 'ts-input-error' : ''}`}
                    />
                    {errors.purposeOther && <p className="ts-error-text mt-1.5 text-sm">{errors.purposeOther}</p>}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="releaseSlot" className="ts-ink mb-1.5 block text-sm font-medium">
                  Preferred Release Slot
                </label>
                <div className="relative">
                  <select
                    id="releaseSlot"
                    value={releaseSlotId}
                    onChange={(e) => {
                      setReleaseSlotId(e.target.value);
                      clearError('releaseSlot');
                    }}
                    aria-invalid={Boolean(errors.releaseSlot)}
                    className={`ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm ${
                      errors.releaseSlot ? 'ts-input-error' : ''
                    }`}
                  >
                    <option value="">Select a release slot</option>
                    {releaseSlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatSlotDate(s.slot_date)} · {formatTime12h(s.start_time)}–{formatTime12h(s.end_time)} (
                        {s.available_slots} left)
                      </option>
                    ))}
                  </select>
                  <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <ChevronIcon />
                  </span>
                </div>
                {errors.releaseSlot && <p className="ts-error-text mt-1.5 text-sm">{errors.releaseSlot}</p>}
                {releaseSlots.length === 0 && (
                  <p className="ts-soft mt-1.5 text-sm">No release slots are currently available. Please check back later.</p>
                )}
              </div>

              {/* Alumni-only: current students can't have graduated yet. */}
              {isAlumni && (
                <div>
                  <label htmlFor="requiresArchiveRetrieval" className="flex cursor-pointer select-none items-start gap-2.5">
                    <span className="ts-checkbox-wrap mt-0.5">
                      <input
                        id="requiresArchiveRetrieval"
                        type="checkbox"
                        checked={requiresArchiveRetrieval}
                        onChange={(e) => setRequiresArchiveRetrieval(e.target.checked)}
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
                    <span className="ts-soft text-sm leading-relaxed">
                      Did you graduate before 2018? Older records may need to be retrieved from the archive, which can
                      add to processing time.
                    </span>
                  </label>
                </div>
              )}

              {errors.general && (
                <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
                  {errors.general}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="ts-btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium"
              >
                {submitting && <Spinner />}
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
