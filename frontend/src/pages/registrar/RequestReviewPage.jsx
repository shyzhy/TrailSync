import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RegistrarMobileHeader, RegistrarSidebar } from '../../components/layout/RegistrarSidebar.jsx';
import {
  BusyLabel,
  DetailPageSkeleton,
  DocumentIcon,
  DownloadIcon,
  ErrorState,
  FieldError,
  Toast,
  WarningIcon,
} from '../../components/ui/index.js';
import { APP_CSS } from '../../styles/appCss.js';
import { FONT_SANS, FONT_SERIF } from '../../styles/fonts.js';
import { academicStatusLine } from '../../lib/academics.js';
import { errorFromResponse, formErrors, toApiError } from '../../lib/api.js';
import { authFetch, clearSession, getAccessToken, getStoredUser, STAFF_LOGIN_PATH } from '../../lib/auth.js';
import { STAFF_NEXT_STEP, STATUS, statusLabel, statusPillClass } from '../../lib/requestStatus.js';

const LOGIN_PATH = STAFF_LOGIN_PATH;
const QUEUE_PATH = '/registrar/queue';

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : PESO.format(n);
}

// The amount approval will assess, worked out as the server does: fee x pages x copies, plus rush/INC add-ons.
function previewFee(request, pageCount) {
  if (request.fee_amount == null) return { none: true };
  const perPage = request.pricing_unit === 'per_page';
  const pages = Number(pageCount);
  if (perPage && !(Number.isInteger(pages) && pages >= 1 && pages <= 999)) return { needsPages: true };
  const copies = Math.max(1, Number(request.number_of_copies) || 1);
  // In centavos, so floating-point dust never reaches an official amount.
  const feeCents = Math.round(Number(request.fee_amount) * 100);
  const addOnCents = Math.round(Number(request.fee_add_ons || 0) * 100);
  const total = (feeCents * (perPage ? pages : 1) * copies + addOnCents) / 100;
  const working = [
    `${formatAmount(request.fee_amount)}${perPage ? ' a page' : ''}`,
    perPage ? `${pages} page${pages === 1 ? '' : 's'}` : null,
    `${copies} cop${copies === 1 ? 'y' : 'ies'}`,
  ]
    .filter(Boolean)
    .join(' × ');
  return { total: formatAmount(total), working: addOnCents ? `${working} + ${formatAmount(addOnCents / 100)} add-ons` : working };
}

function formatFileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('en-PH', {
      month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatSlotTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

// Today in the browser's timezone: toISOString() would hand a Manila user yesterday's date.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="ts-review-label">{label}</p>
      <p className="ts-review-value">{children ?? '—'}</p>
    </div>
  );
}

function ActionCard({ step, title, description, children }) {
  return (
    <div className="ts-card p-6">
      {step && (
        <p className="ts-soft text-xs font-semibold uppercase tracking-wide">Step {step} of 5</p>
      )}
      <h2 className="ts-ink mt-1 text-lg font-semibold" style={FONT_SERIF}>{title}</h2>
      {description && <p className="ts-soft mt-1.5 text-sm leading-relaxed">{description}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

// Confirmation shown in place of the action buttons, since none of these transitions can be undone from this page.
function ConfirmStep({ title, children, confirmLabel, busyLabel, loading, busy, onConfirm, onCancel, tone = 'primary' }) {
  return (
    <div role="group" aria-label={title} className="ts-well mt-4 px-4 py-4">
      <p className="ts-ink text-base font-semibold">{title}</p>
      <div className="ts-soft mt-1.5 space-y-1.5 text-sm leading-relaxed">{children}</div>
      <div className="mt-4 flex flex-col gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`${tone === 'danger' ? 'ts-btn-outline-danger' : 'ts-btn-primary'} flex items-center justify-center gap-2 py-3 text-sm font-medium`}
        >
          <BusyLabel busy={loading} busyLabel={busyLabel}>
            {confirmLabel}
          </BusyLabel>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="ts-btn-glass py-3 text-sm font-medium"
        >
          Go back
        </button>
      </div>
    </div>
  );
}

export default function RequestReviewPage({ requestId }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [request, setRequest] = useState(null);

  const [remarks, setRemarks] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [orNumber, setOrNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO);
  const [releaseDate, setReleaseDate] = useState('');
  const [claimantName, setClaimantName] = useState('');
  const [proxyAcknowledged, setProxyAcknowledged] = useState(false);
  // The proxy this page last showed; if the student changes it, the name typed and the papers ticked were for someone else.
  const seenProxyVersion = useRef(null);
  // Which action is waiting on a yes: 'verify' | 'reject' | 'approve' | 'approve-log' | 'mark-ready' | 'release'.
  const [confirming, setConfirming] = useState(null);

  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState('');
  // Server messages for one action's own inputs (O.R. number, dates, names).
  const [actionFieldErrors, setActionFieldErrors] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmingClearFlag, setConfirmingClearFlag] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [meRes, reqRes] = await Promise.all([
        authFetch('/api/me/'),
        authFetch(`/api/registrar/queue/${requestId}/`),
      ]);
      // The request's own answer first: a 404 there means "no such request".
      const failed = !reqRes.ok ? reqRes : !meRes.ok ? meRes : null;
      if (failed) throw await errorFromResponse(failed);

      const [meData, reqData] = await Promise.all([meRes.json(), reqRes.json()]);
      setMe(meData);
      setRequest(reqData);
      // With a proxy on file the claimant starts blank, so staff must type who is actually collecting.
      if (seenProxyVersion.current !== null && seenProxyVersion.current !== reqData.proxy_version) {
        setClaimantName(reqData.proxy ? '' : reqData.student_full_name || '');
        setProxyAcknowledged(false);
        setConfirming(null);
      } else {
        setClaimantName((prev) => prev || (reqData.proxy ? '' : reqData.student_full_name || ''));
      }
      seenProxyVersion.current = reqData.proxy_version;

      // Pre-fill the pickup date from any existing arrangement rather than silently overwriting it.
      const booked = reqData.release_schedule || null;
      setReleaseDate((prev) => prev || booked?.release_date || booked?.slot_date || todayISO());
      setStatus('ready');
    } catch (error) {
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, [requestId]);

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

  // Run one lifecycle transition; a 409 means the request moved on, so reload to show the real stage's actions.
  const runTransition = useCallback(
    async (key, path, { method = 'PATCH', body, successMessage }) => {
      setActionLoading(key);
      setActionError('');
      setActionFieldErrors({});
      try {
        const res = await authFetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        });
        if (!res.ok) throw await errorFromResponse(res);
        setRequest(await res.json());
        setConfirming(null);
        setRemarks('');
        setToast({ message: successMessage, tone: 'success' });
      } catch (error) {
        const apiError = toApiError(error);
        // Input-specific messages go under that input; the rest sit above the actions.
        const { general, ...fields } = formErrors(apiError, [
          'page_count',
          'or_number',
          'payment_date',
          'release_date',
          'claimant_name',
          'remarks',
        ]);
        setActionFieldErrors(fields);
        setActionError(general || '');
        if (Object.keys(fields).length) setConfirming(null);
        if (apiError.kind === 'conflict') await load();
      } finally {
        setActionLoading(null);
      }
    },
    [load],
  );

  // Not a lifecycle transition: the endpoint returns only {id, duplicate_flag} and never conflicts with the stage.
  const clearFlag = async () => {
    setActionLoading('clear-flag');
    setActionError('');
    try {
      const res = await authFetch(`/api/registrar/queue/${request.id}/clear-flag/`, { method: 'POST' });
      if (!res.ok) throw await errorFromResponse(res);
      setRequest((prev) => ({ ...prev, duplicate_flag: false }));
      setConfirmingClearFlag(false);
      setToast({ message: 'Flag cleared.', tone: 'success' });
    } catch (error) {
      setToast({ message: `The flag wasn’t cleared. ${toApiError(error).message}`, tone: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const proxy = request?.proxy || null;
  const schedule = request?.release_schedule || null;
  const amountDue = formatAmount(request?.amount_due);
  const busy = Boolean(actionLoading);

  // The schedule first and the old slot only as a fallback, since nothing books slots any more.
  const scheduleLine = useMemo(() => {
    const date = schedule?.release_date || schedule?.slot_date;
    if (!date) return null;
    const start = schedule?.release_time_start || schedule?.start_time;
    return start ? `${formatDate(date)}, from ${formatSlotTime(start)}` : formatDate(date);
  }, [schedule]);

  const currentStatus = request?.request_status;
  const perPage = request?.pricing_unit === 'per_page';
  const fee = request ? previewFee(request, pageCount) : null;

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <RegistrarSidebar active="queue" onLogout={handleLogout} me={me} />
      <RegistrarMobileHeader active="queue" onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <a href={QUEUE_PATH} className="ts-link inline-flex items-center gap-1.5 py-2 text-sm font-medium">
          <span aria-hidden="true">&larr;</span> Back to all requests
        </a>

        {status === 'loading' && <DetailPageSkeleton />}

        {status === 'error' && (
          <ErrorState
            className="mt-6"
            error={loadError}
            title="We couldn&rsquo;t load this request"
            message={loadError?.kind === 'not_found' ? 'It may have been removed, or the link may be wrong.' : undefined}
            onRetry={load}
            action={
              loadError?.kind === 'not_found' || loadError?.kind === 'forbidden' ? (
                <a href={QUEUE_PATH} className="ts-btn-primary inline-flex min-h-[44px] items-center px-6 text-sm font-medium">
                  Back to all requests
                </a>
              ) : null
            }
          />
        )}

        {status === 'ready' && request && (
          <>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
                    {request.request_code}
                  </h1>
                  <span className={`ts-pill ${statusPillClass(currentStatus)}`}>{statusLabel(currentStatus)}</span>
                  {request.is_rush && <span className="ts-tag ts-tag-gold">Rush</span>}
                </div>
                <p className="ts-soft mt-1.5 text-base">
                  {request.transaction_type} &middot; requested {formatDate(request.created_at)}
                </p>
                {/* What this stage means, before any buttons are read. */}
                {STAFF_NEXT_STEP[currentStatus] && (
                  <p className="ts-soft mt-1 text-sm">{STAFF_NEXT_STEP[currentStatus]}</p>
                )}
              </div>
            </div>

            {request.duplicate_flag && (
              <div role="alert" className="ts-warning-card mt-5 p-4">
                <div className="flex items-center gap-2">
                  <WarningIcon />
                  <span className="text-sm font-semibold">Flagged: possible duplicate</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed">
                  This request may reuse another request&rsquo;s tracking number. Check it against the original before
                  approving or releasing anything. The student can&rsquo;t see this flag.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {confirmingClearFlag ? (
                    <>
                      <span className="text-sm">Clear the flag? Only do this once you&rsquo;ve checked it.</span>
                      <button
                        type="button"
                        onClick={clearFlag}
                        disabled={busy}
                        className="ts-btn-primary px-4 py-1.5 text-sm font-medium"
                      >
                        {actionLoading === 'clear-flag' ? 'Clearing…' : 'Yes, clear flag'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingClearFlag(false)}
                        disabled={busy}
                        className="ts-link text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingClearFlag(true)}
                      className="ts-btn-glass px-4 py-1.5 text-sm font-medium"
                    >
                      Mark as reviewed
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
              {/* Left: the request itself */}
              <div className="lg:col-span-3 space-y-6">
                <div className="ts-card p-6">
                  <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>Student</h2>
                  <div className="mt-4">
                    <p className="ts-review-value text-base">{request.student_full_name}</p>
                    <p className="ts-soft mt-0.5 text-sm">
                      ID: {request.student_school_id_number || '—'}
                      {request.student_course ? ` · ${request.student_course}` : ''}
                      {request.student_academic_status?.length ? ` · ${academicStatusLine(request.student_academic_status)}` : ''}
                    </p>
                  </div>

                  <div className="ts-row-divider my-5" />

                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Document">{request.transaction_type}</Field>
                    <Field label="Copies">{request.number_of_copies}</Field>
                    {request.page_count != null && <Field label="Pages (per copy)">{request.page_count}</Field>}
                    {(request.submission_extras || []).map((extra) => (
                      <Field key={extra.label} label={extra.label}>{extra.value}</Field>
                    ))}
                    <Field label="Purpose">
                      {request.purpose === 'Others' ? request.purpose_other || 'Others' : request.purpose}
                    </Field>
                    <Field label="Last semester attended">{request.semester}</Field>
                    {request.graduation_date && <Field label="Graduated">{formatDate(request.graduation_date)}</Field>}
                    {amountDue && <Field label="Amount to pay">{amountDue}</Field>}
                    {request.or_number && <Field label="O.R. number">{request.or_number}</Field>}
                    {request.payment_date && <Field label="Date paid">{formatDate(request.payment_date)}</Field>}
                    {request.verified_by_name && (
                      <Field label="Requirements checked by">
                        {request.verified_by_name}
                        <span className="ts-soft block text-xs font-normal">
                          Front Desk
                        </span>
                      </Field>
                    )}
                    {request.approved_by_name && (
                      <Field label="Approved by">
                        {request.approved_by_name}
                        <span className="ts-soft block text-xs font-normal">
                          {formatDateTime(request.registrar_approved_at)}
                        </span>
                      </Field>
                    )}
                    {request.additional_notes && (
                      <Field label="Notes from the student" className="sm:col-span-2">
                        <span className="font-normal">{request.additional_notes}</span>
                      </Field>
                    )}
                  </div>

                  {proxy && (
                    <>
                      <div className="ts-row-divider my-5" />
                      <p className="ts-review-label">Someone else will collect this</p>
                      <p className="ts-review-value">
                        {proxy.proxy_full_name} ({proxy.relationship})
                      </p>
                      <p className="ts-soft mt-0.5 text-xs">{proxy.contact_number}</p>
                    </>
                  )}

                  <div className="ts-row-divider my-5" />

                  <p className="ts-review-label">Files the student uploaded</p>
                  {request.uploaded_files.length === 0 ? (
                    <p className="ts-soft mt-1.5 text-sm leading-relaxed">
                      No files were uploaded with this request. Check the paper requirements at the window.
                    </p>
                  ) : (
                    <ul className="mt-2.5 space-y-2">
                      {request.uploaded_files.map((f) => (
                        <li key={f.file_url} className="ts-slot-card flex items-center gap-3 px-3 py-2.5">
                          <span className="ts-soft shrink-0"><DocumentIcon /></span>
                          <div className="min-w-0 flex-1">
                            <p className="ts-ink truncate text-xs font-medium">{f.file_name}</p>
                            {f.file_size != null && <p className="ts-soft text-xs">{formatFileSize(f.file_size)}</p>}
                          </div>
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ts-icon-chip shrink-0"
                            aria-label={`Download ${f.file_name}`}
                          >
                            <DownloadIcon />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Right: the actions for this stage */}
              <div className="lg:col-span-2 space-y-6">
                {actionError && (
                  <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
                    {actionError}
                  </div>
                )}

                {/* Submitted -> Front Desk verification (the form's first signature). No fee yet. */}
                {currentStatus === STATUS.SUBMITTED && (
                  <ActionCard
                    step={1}
                    title="Check the requirements"
                    description="Confirm the student has brought what this document needs and is cleared. The Registrar works out the fee in the next step."
                  >
                    <label htmlFor="reviewRemarks" className="ts-ink mb-1.5 block text-sm font-medium">
                      Notes <span className="ts-soft font-normal">(needed only if you turn it down)</span>
                    </label>
                    <textarea
                      id="reviewRemarks"
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="What is missing, or anything worth recording"
                      aria-invalid={Boolean(actionFieldErrors.remarks)}
                      aria-describedby={actionFieldErrors.remarks ? 'reviewRemarks-error' : undefined}
                      className={`ts-input w-full px-3.5 py-2.5 text-sm ${actionFieldErrors.remarks ? 'ts-input-error' : ''}`}
                    />
                    <FieldError id="reviewRemarks">{actionFieldErrors.remarks}</FieldError>

                    {confirming === 'verify' ? (
                      <ConfirmStep
                        title="Confirm the requirements are complete?"
                        confirmLabel="Yes, send to the Registrar"
                        busyLabel="Sending…"
                        loading={actionLoading === 'verify'}
                        busy={busy}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() =>
                          runTransition('verify', `/api/registrar/queue/${request.id}/verify/`, {
                            method: 'POST',
                            body: { remarks: remarks.trim() },
                            successMessage: 'Sent to the Registrar for approval.',
                          })
                        }
                      >
                        <p>
                          {request.student_full_name}&rsquo;s request moves to the Registrar for approval. You
                          can&rsquo;t take this back yourself.
                        </p>
                      </ConfirmStep>
                    ) : confirming === 'reject' ? (
                      <ConfirmStep
                        title="Turn down this request?"
                        tone="danger"
                        confirmLabel="Yes, turn it down"
                        busyLabel="Sending…"
                        loading={actionLoading === 'reject'}
                        busy={busy}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() =>
                          runTransition('reject', `/api/registrar/queue/${request.id}/reject/`, {
                            method: 'POST',
                            body: { remarks: remarks.trim() },
                            successMessage: 'The student has been told.',
                          })
                        }
                      >
                        <p>The student will be told, and will have to send a new request. This can&rsquo;t be undone.</p>
                        <p className="ts-ink">They will see: &ldquo;{remarks.trim()}&rdquo;</p>
                      </ConfirmStep>
                    ) : (
                      <div className="mt-5 flex flex-col gap-2.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirming('verify')}
                          className="ts-btn-sage flex items-center justify-center gap-2 py-3 text-sm font-medium"
                        >
                          Requirements are complete
                        </button>
                        <button
                          type="button"
                          disabled={busy || !remarks.trim()}
                          onClick={() => setConfirming('reject')}
                          className="ts-btn-outline-danger flex items-center justify-center gap-2 py-3 text-sm font-medium"
                        >
                          Turn down this request
                        </button>
                        {!remarks.trim() && (
                          <p className="ts-soft text-center text-sm">
                            To turn a request down, write the reason above first.
                          </p>
                        )}
                      </div>
                    )}
                  </ActionCard>
                )}

                {/* Verified -> Registrar approval (the form's second signature), where the fee is assessed. */}
                {currentStatus === STATUS.VERIFIED && (
                  <ActionCard
                    step={2}
                    title="Registrar approval"
                    description={
                      perPage
                        ? 'Count the pages of the record, then approve: that sets the fee and lets the student print their form to pay at the Cashier.'
                        : 'Approving works out the fee and lets the student print their form to pay at the Cashier.'
                    }
                  >
                    {request.verified_by_name && (
                      <div className="ts-well mb-4 px-3.5 py-2.5">
                        <p className="ts-review-label">Requirements checked by</p>
                        <p className="ts-ink mt-0.5 text-sm font-semibold">{request.verified_by_name}</p>
                        <p className="ts-soft text-xs">Front Desk</p>
                      </div>
                    )}
                    {/* Per-page documents: only the Registrar, holding the record, can know how long it runs. */}
                    {perPage && (
                      <div className="mb-4">
                        <label htmlFor="pageCount" className="ts-ink mb-1.5 block text-sm font-medium">
                          Page count <span className="ts-soft font-normal">(pages per copy)</span>
                        </label>
                        <input
                          id="pageCount"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="999"
                          step="1"
                          value={pageCount}
                          onChange={(e) => {
                            setPageCount(e.target.value);
                            setActionFieldErrors((prev) => (prev.page_count ? { ...prev, page_count: undefined } : prev));
                          }}
                          placeholder="e.g. 4"
                          aria-invalid={Boolean(actionFieldErrors.page_count)}
                          aria-describedby={actionFieldErrors.page_count ? 'pageCount-error' : 'pageCount-hint'}
                          className={`ts-input w-full px-3.5 py-2.5 text-sm ${actionFieldErrors.page_count ? 'ts-input-error' : ''}`}
                        />
                        {actionFieldErrors.page_count ? (
                          <FieldError id="pageCount">{actionFieldErrors.page_count}</FieldError>
                        ) : (
                          <p id="pageCount-hint" className="ts-soft mt-1.5 text-xs">
                            {request.transaction_type} is charged per page. Count the pages of one copy of the record.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="ts-well mb-4 px-3.5 py-2.5">
                      <p className="ts-review-label">Fee to be assessed</p>
                      {fee.total ? (
                        <>
                          <p className="ts-ink mt-0.5 text-base font-semibold">{fee.total}</p>
                          <p className="ts-soft text-xs">{fee.working}</p>
                        </>
                      ) : (
                        <p className="ts-soft mt-0.5 text-sm">
                          {fee.none ? 'This document has no set fee.' : 'Enter the page count to see the fee.'}
                        </p>
                      )}
                    </div>

                    <label htmlFor="approvalRemarks" className="ts-ink mb-1.5 block text-sm font-medium">
                      Notes <span className="ts-soft font-normal">(needed only if you turn it down)</span>
                    </label>
                    <textarea
                      id="approvalRemarks"
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Anything worth recording, or the reason if you turn it down"
                      aria-invalid={Boolean(actionFieldErrors.remarks)}
                      aria-describedby={actionFieldErrors.remarks ? 'approvalRemarks-error' : undefined}
                      className={`ts-input w-full px-3.5 py-2.5 text-sm ${actionFieldErrors.remarks ? 'ts-input-error' : ''}`}
                    />
                    <FieldError id="approvalRemarks">{actionFieldErrors.remarks}</FieldError>

                    {confirming === 'approve' ? (
                      <ConfirmStep
                        title="Approve this request?"
                        confirmLabel="Yes, approve it"
                        busyLabel="Approving…"
                        loading={actionLoading === 'approve'}
                        busy={busy}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() =>
                          runTransition('approve', `/api/registrar/queue/${request.id}/approve/`, {
                            method: 'POST',
                            body: perPage ? { page_count: Number(pageCount) } : {},
                            successMessage: 'Approved. The student can now print and pay.',
                          })
                        }
                      >
                        <p>
                          {fee.total ? `The fee is set at ${fee.total}` : 'The fee is worked out'}
                          {perPage ? ` for ${pageCount} page${Number(pageCount) === 1 ? '' : 's'} per copy` : ''}, and{' '}
                          {request.student_full_name} can print their form and pay at the Cashier. This can&rsquo;t be
                          undone.
                        </p>
                      </ConfirmStep>
                    ) : confirming === 'reject' ? (
                      <ConfirmStep
                        title="Turn down this request?"
                        tone="danger"
                        confirmLabel="Yes, turn it down"
                        busyLabel="Sending…"
                        loading={actionLoading === 'reject'}
                        busy={busy}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() =>
                          runTransition('reject', `/api/registrar/queue/${request.id}/reject/`, {
                            method: 'POST',
                            body: { remarks: remarks.trim() },
                            successMessage: 'The student has been told.',
                          })
                        }
                      >
                        <p>The student will be told, and will have to send a new request. This can&rsquo;t be undone.</p>
                        <p className="ts-ink">They will see: &ldquo;{remarks.trim()}&rdquo;</p>
                      </ConfirmStep>
                    ) : (
                      <div className="mt-5 flex flex-col gap-2.5">
                        <button
                          type="button"
                          disabled={busy || Boolean(fee.needsPages)}
                          onClick={() => setConfirming('approve')}
                          className="ts-btn-primary flex items-center justify-center gap-2 py-3 text-sm font-medium"
                        >
                          Approve and set the fee
                        </button>
                        {fee.needsPages && (
                          <p className="ts-soft text-center text-sm">Enter the page count above to approve.</p>
                        )}
                        <button
                          type="button"
                          disabled={busy || !remarks.trim()}
                          onClick={() => setConfirming('reject')}
                          className="ts-btn-outline-danger flex items-center justify-center gap-2 py-3 text-sm font-medium"
                        >
                          Turn down this request
                        </button>
                        {!remarks.trim() && (
                          <p className="ts-soft text-center text-sm">
                            To turn a request down, write the reason above first.
                          </p>
                        )}
                      </div>
                    )}
                  </ActionCard>
                )}

                {/* Approved -> payment logged */}
                {currentStatus === STATUS.APPROVED && (
                  <ActionCard
                    step={3}
                    title="Record the payment"
                    description="The student pays at the Cashier and brings back their printed form. Copy the details from it."
                  >
                    {amountDue && (
                      <div className="ts-well mb-4 px-3.5 py-2.5">
                        <p className="ts-review-label">Amount to pay</p>
                        <p className="ts-ink text-lg font-semibold" style={FONT_SERIF}>{amountDue}</p>
                      </div>
                    )}
                    <div className="space-y-3.5">
                      <div>
                        <label htmlFor="orNumber" className="ts-ink mb-1.5 block text-sm font-medium">
                          O.R. number
                        </label>
                        <input
                          id="orNumber"
                          type="text"
                          value={orNumber}
                          onChange={(e) => setOrNumber(e.target.value)}
                          placeholder="e.g. OR-104582"
                          aria-invalid={Boolean(actionFieldErrors.or_number)}
                          aria-describedby={actionFieldErrors.or_number ? 'orNumber-error' : undefined}
                          className={`ts-input w-full px-3.5 py-2.5 text-sm ${actionFieldErrors.or_number ? 'ts-input-error' : ''}`}
                        />
                        <FieldError id="orNumber">{actionFieldErrors.or_number}</FieldError>
                      </div>
                      <div>
                        <label htmlFor="paymentDate" className="ts-ink mb-1.5 block text-sm font-medium">
                          Date paid
                        </label>
                        <input
                          id="paymentDate"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          aria-invalid={Boolean(actionFieldErrors.payment_date)}
                          aria-describedby={actionFieldErrors.payment_date ? 'paymentDate-error' : undefined}
                          className={`ts-input w-full px-3.5 py-2.5 text-sm ${actionFieldErrors.payment_date ? 'ts-input-error' : ''}`}
                        />
                        <FieldError id="paymentDate">{actionFieldErrors.payment_date}</FieldError>
                      </div>
                    </div>
                    {confirming === 'approve-log' ? (
                      <ConfirmStep
                        title="Save this payment?"
                        confirmLabel="Yes, save it"
                        busyLabel="Saving…"
                        loading={actionLoading === 'approve-log'}
                        busy={busy}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() =>
                          runTransition('approve-log', `/api/form-requests/${request.id}/approve-log/`, {
                            body: { or_number: orNumber.trim(), payment_date: paymentDate },
                            successMessage: 'Payment saved. The document can now be prepared.',
                          })
                        }
                      >
                        <p>
                          O.R. {orNumber.trim()}, paid {formatDate(paymentDate)}. The request moves on to being
                          prepared, and the student&rsquo;s claim stub becomes available.
                        </p>
                      </ConfirmStep>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy || !orNumber.trim() || !paymentDate}
                          onClick={() => setConfirming('approve-log')}
                          className="ts-btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3 text-sm font-medium"
                        >
                          Save payment details
                        </button>
                        {(!orNumber.trim() || !paymentDate) && (
                          <p className="ts-soft mt-2 text-center text-sm">
                            Fill in the O.R. number and the date paid to continue.
                          </p>
                        )}
                      </>
                    )}
                  </ActionCard>
                )}

                {/* Processing -> ready for pickup. Only a date: Window 6 releases everything from 3:00 to 5:00 PM. */}
                {currentStatus === STATUS.PROCESSING && (
                  <ActionCard
                    step={4}
                    title="Set the pickup date"
                    description="Once the document is printed and signed, choose the day the student can collect it. They are told straight away."
                  >
                    {scheduleLine && (
                      <p className="ts-soft mb-4 text-sm leading-relaxed">
                        Currently set for <strong className="ts-ink">{scheduleLine}</strong>. Change it below if you
                        need to.
                      </p>
                    )}

                    <div>
                      <label htmlFor="releaseDate" className="ts-ink mb-1.5 block text-sm font-medium">
                        Pickup date
                      </label>
                      <input
                        id="releaseDate"
                        type="date"
                        value={releaseDate}
                        onChange={(e) => setReleaseDate(e.target.value)}
                        aria-invalid={Boolean(actionFieldErrors.release_date)}
                        aria-describedby={actionFieldErrors.release_date ? 'releaseDate-error' : undefined}
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${actionFieldErrors.release_date ? 'ts-input-error' : ''}`}
                      />
                      <FieldError id="releaseDate">{actionFieldErrors.release_date}</FieldError>
                      <p className="ts-soft mt-2 text-sm">
                        Pickup is always between 3:00 and 5:00 PM at Window 6, so you only need the date.
                      </p>
                    </div>

                    {confirming === 'mark-ready' ? (
                      <ConfirmStep
                        title="Tell the student it&rsquo;s ready?"
                        confirmLabel="Yes, notify the student"
                        busyLabel="Sending…"
                        loading={actionLoading === 'mark-ready'}
                        busy={busy}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() =>
                          runTransition('mark-ready', `/api/form-requests/${request.id}/mark-ready/`, {
                            body: { release_date: releaseDate },
                            successMessage: 'The student has been told it is ready.',
                          })
                        }
                      >
                        <p>
                          {request.student_full_name} will be told to collect this on{' '}
                          <strong className="ts-ink">{formatDate(releaseDate)}</strong>, between 3:00 and 5:00 PM.
                        </p>
                      </ConfirmStep>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy || !releaseDate}
                          onClick={() => setConfirming('mark-ready')}
                          className="ts-btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3 text-sm font-medium"
                        >
                          Ready for pickup
                        </button>
                        {!releaseDate && (
                          <p className="ts-soft mt-2 text-center text-sm">Choose a pickup date to continue.</p>
                        )}
                      </>
                    )}
                  </ActionCard>
                )}

                {/* Ready for pickup -> released */}
                {currentStatus === STATUS.READY && (
                  <ActionCard
                    step={5}
                    title="Hand it over"
                    description="The last step. Record who actually collected the document."
                  >
                    {scheduleLine && (
                      <div className="ts-well mb-4 px-3.5 py-2.5">
                        <p className="ts-review-label">Due for pickup</p>
                        <p className="ts-ink mt-0.5 text-sm font-semibold">{scheduleLine}</p>
                      </div>
                    )}

                    {/* Always the proxy on file now: a student can change it at Ready for Pickup, and Release refuses an out-of-date screen. */}
                    {proxy && (
                      <div className="ts-banner ts-banner-pending mb-4 px-3.5 py-3 text-sm">
                        <p className="font-semibold">&#9888; Representative claim expected</p>
                        <p className="mt-1 leading-relaxed">
                          <strong>{proxy.proxy_full_name}</strong> ({proxy.relationship}) &middot; {proxy.contact_number}
                        </p>
                        {request.proxy_changed_at && (
                          <p className="mt-1 font-semibold">
                            Changed by the student on {formatDateTime(request.proxy_changed_at)}. This replaces anyone
                            named before.
                          </p>
                        )}
                        <p className="mt-1 leading-relaxed">
                          Check the notarized authorization letter and both IDs before handing it over.
                        </p>
                        <label className="mt-3 flex cursor-pointer select-none items-start gap-2.5 text-sm">
                          <span className="ts-checkbox-wrap mt-0.5">
                            <input
                              type="checkbox"
                              checked={proxyAcknowledged}
                              onChange={(e) => setProxyAcknowledged(e.target.checked)}
                              className="ts-checkbox-input"
                            />
                            <span className="ts-checkbox-well" aria-hidden="true">
                              <svg viewBox="0 0 12 10" fill="none" className="ts-checkbox-check">
                                <path d="M1 5.2 4.3 8.5 11 1.5" stroke="#FAF8F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </span>
                          <span>
                            I checked the authorization letter and the IDs of both{' '}
                            <strong>{request.student_full_name}</strong> and{' '}
                            <strong>{proxy.proxy_full_name}</strong>.
                          </span>
                        </label>
                      </div>
                    )}

                    <div>
                      <label htmlFor="claimantName" className="ts-ink mb-1.5 block text-sm font-medium">
                        Who is collecting it?
                      </label>
                      <input
                        id="claimantName"
                        type="text"
                        value={claimantName}
                        onChange={(e) => setClaimantName(e.target.value)}
                        placeholder={proxy ? `e.g. ${proxy.proxy_full_name}` : 'Full name of the person at the window'}
                        aria-invalid={Boolean(actionFieldErrors.claimant_name)}
                        aria-describedby={actionFieldErrors.claimant_name ? 'claimantName-error' : undefined}
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${actionFieldErrors.claimant_name ? 'ts-input-error' : ''}`}
                      />
                      <FieldError id="claimantName">{actionFieldErrors.claimant_name}</FieldError>
                      <p className="ts-soft mt-2 text-sm">
                        Type their name as written on their ID. This is kept as the record of the handover.
                      </p>
                    </div>

                    {confirming === 'release' ? (
                      <ConfirmStep
                        title="Mark this request as released?"
                        confirmLabel="Yes, it has been collected"
                        busyLabel="Saving…"
                        loading={actionLoading === 'release'}
                        busy={busy}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() =>
                          runTransition('release', `/api/form-requests/${request.id}/release/`, {
                            body: {
                              claimant_name: claimantName.trim(),
                              proxy_acknowledged: proxyAcknowledged,
                              proxy_version: request.proxy_version,
                            },
                            successMessage: 'Recorded. This request is finished.',
                          })
                        }
                      >
                        {proxy && (
                          <p className="ts-ink font-semibold">
                            &#9888; Representative claim expected: {proxy.proxy_full_name} ({proxy.relationship})
                          </p>
                        )}
                        <p>
                          This finishes {request.request_code} and records{' '}
                          <strong className="ts-ink">{claimantName.trim()}</strong> as the person who collected it.
                          It can&rsquo;t be undone.
                        </p>
                      </ConfirmStep>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy || !claimantName.trim() || (proxy && !proxyAcknowledged)}
                          onClick={() => setConfirming('release')}
                          className="ts-btn-primary mt-5 flex w-full items-center justify-center py-3 text-sm font-medium"
                        >
                          Record the handover
                        </button>
                        {(!claimantName.trim() || (proxy && !proxyAcknowledged)) && (
                          <p className="ts-soft mt-2 text-center text-sm">
                            {!claimantName.trim()
                              ? 'Type who is collecting it to continue.'
                              : 'Tick the box above to confirm you checked the letter and IDs.'}
                          </p>
                        )}
                      </>
                    )}
                  </ActionCard>
                )}

                {/* Released: read-only record of the claim */}
                {currentStatus === STATUS.RELEASED && (
                  <ActionCard title="Finished" description="This document was collected. There is nothing left to do.">
                    <div className="space-y-4">
                      <Field label="Collected by">{schedule?.claimant_name}</Field>
                      <Field label="Collected on">{formatDateTime(schedule?.claimed_at)}</Field>
                      {request.or_number && <Field label="O.R. number">{request.or_number}</Field>}
                      {request.payment_date && <Field label="Date paid">{formatDate(request.payment_date)}</Field>}
                    </div>
                    <a href="/registrar/released" className="ts-btn-glass mt-6 flex w-full items-center justify-center py-3 text-sm font-medium">
                      See all released documents
                    </a>
                  </ActionCard>
                )}

                {/* Rejected: read-only, with the reason given */}
                {currentStatus === STATUS.REJECTED && (
                  <ActionCard title="Not approved" description="This request was turned down, and the student was told why.">
                    <Field label="Reason given">{request.verification_remarks}</Field>
                    <a href={QUEUE_PATH} className="ts-btn-glass mt-6 flex w-full items-center justify-center py-3 text-sm font-medium">
                      Back to all requests
                    </a>
                  </ActionCard>
                )}

                {/* Cancelled: the student ended it before paying; nothing for staff to do. */}
                {currentStatus === STATUS.CANCELLED && (
                  <ActionCard
                    title="Cancelled by the student"
                    description="The student cancelled this request before any payment was logged. There is nothing left to do."
                  >
                    <Field label="Cancelled on">{formatDateTime(request.cancelled_at)}</Field>
                    <a href={QUEUE_PATH} className="ts-btn-glass mt-6 flex w-full items-center justify-center py-3 text-sm font-medium">
                      Back to all requests
                    </a>
                  </ActionCard>
                )}

                {/* Remarks from an earlier decision, shown at whatever stage the request is now. */}
                {request.verification_remarks && currentStatus !== STATUS.REJECTED && (
                  <div className="ts-card p-5">
                    <p className="ts-review-label">Notes from an earlier step</p>
                    <p className="ts-soft mt-1.5 text-sm leading-relaxed">{request.verification_remarks}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <Toast message={toast?.message} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
