import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APP_CSS,
  ChevronIcon,
  DocumentIcon,
  DownloadIcon,
  FONT_SANS,
  FONT_SERIF,
  RegistrarMobileHeader,
  RegistrarSidebar,
  Spinner,
  Toast,
} from './trailsyncUI.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';
import { STATUS, statusLabel, statusPillClass } from '../lib/requestStatus.js';

const LOGIN_PATH = '/';
const QUEUE_PATH = '/registrar/queue';

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : PESO.format(n);
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

/** Today in the browser's own timezone — toISOString() would shift to UTC and
 *  hand a Manila user yesterday's date for most of the working day. */
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

function ActionCard({ title, description, children }) {
  return (
    <div className="ts-card p-5">
      <h2 className="ts-ink text-base font-semibold" style={FONT_SERIF}>{title}</h2>
      {description && <p className="ts-soft mt-1 text-sm leading-relaxed">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function RequestReviewPage({ requestId }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error' | 'notfound'
  const [me, setMe] = useState(() => getStoredUser());
  const [request, setRequest] = useState(null);

  const [remarks, setRemarks] = useState('');
  const [orNumber, setOrNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO);
  const [releaseDate, setReleaseDate] = useState('');
  const [releaseTime, setReleaseTime] = useState('');
  // '' means a freeform time not tied to any published window.
  const [releaseSlotId, setReleaseSlotId] = useState('');
  const [slotsForDate, setSlotsForDate] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [claimantName, setClaimantName] = useState('');
  const [proxyAcknowledged, setProxyAcknowledged] = useState(false);
  const [confirmingRelease, setConfirmingRelease] = useState(false);

  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [meRes, reqRes] = await Promise.all([
        authFetch('/api/me/'),
        authFetch(`/api/registrar/queue/${requestId}/`),
      ]);
      if ([meRes, reqRes].some((r) => r.status === 401)) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (reqRes.status === 404) {
        setStatus('notfound');
        return;
      }
      if ([meRes, reqRes].some((r) => r.status === 403)) throw new Error('forbidden');
      if (!meRes.ok || !reqRes.ok) throw new Error('failed');

      const [meData, reqData] = await Promise.all([meRes.json(), reqRes.json()]);
      setMe(meData);
      setRequest(reqData);
      // Pre-fill the claimant only when nobody else is authorised to collect.
      // With a proxy on file the field starts blank on purpose: pre-filling
      // the student's name there invites staff to release to whoever is at
      // the window without retyping, which is exactly what the proxy check
      // exists to prevent.
      setClaimantName((prev) => prev || (reqData.proxy ? '' : reqData.student_full_name || ''));

      // Pre-fill the release form from whatever is already booked, so staff
      // are confirming or adjusting an existing arrangement rather than
      // starting blank and silently overwriting one.
      const booked = reqData.release_schedule || null;
      setReleaseDate((prev) => prev || booked?.release_date || booked?.slot_date || todayISO());
      setReleaseTime((prev) => prev || booked?.release_time_start || booked?.start_time || '');
      setReleaseSlotId((prev) => prev || (booked?.release_slot_id ? String(booked.release_slot_id) : ''));
      setStatus('ready');
    } catch {
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

  /**
   * Load the published windows for whichever date is selected.
   *
   * Re-runs on every date change rather than once, because the point of the
   * dropdown is to show what is bookable on THAT day - a stale list from a
   * previously chosen date would offer windows that do not exist on this one.
   */
  useEffect(() => {
    if (!releaseDate || request?.request_status !== STATUS.PROCESSING) {
      setSlotsForDate([]);
      return undefined;
    }
    let cancelled = false;
    setSlotsLoading(true);
    authFetch(`/api/registrar/release-slots/?date=${releaseDate}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setSlotsForDate(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSlotsForDate([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Reads request?.request_status rather than the derived currentStatus
    // below: a dependency array is evaluated during render, so naming a
    // const declared further down the component throws before first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseDate, request?.request_status]);

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  /**
   * Run one lifecycle transition.
   *
   * A 409 means the request moved on underneath this page — another staff
   * member acted, or this tab sat open too long. The server hands back the
   * real stage, so the fix is to reload and re-render the correct actions
   * rather than leave stale buttons on screen.
   */
  const runTransition = useCallback(
    async (key, path, { method = 'PATCH', body, successMessage }) => {
      setActionLoading(key);
      setActionError('');
      try {
        const res = await authFetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        });
        if (res.status === 401) {
          clearSession();
          window.location.href = LOGIN_PATH;
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            data.detail ||
            data.or_number?.[0] ||
            data.payment_date?.[0] ||
            data.claimant_name?.[0] ||
            data.remarks?.[0] ||
            'Could not complete this action.';
          setActionError(message);
          if (res.status === 409) await load();
          return;
        }
        setRequest(data);
        setConfirmingRelease(false);
        setRemarks('');
        setToast({ message: successMessage, tone: 'success' });
      } catch {
        setActionError('Unable to reach the server. Please try again.');
      } finally {
        setActionLoading(null);
      }
    },
    [load],
  );

  const proxy = request?.proxy || null;
  const schedule = request?.release_schedule || null;
  const amountDue = formatAmount(request?.amount_due);
  const busy = Boolean(actionLoading);

  const scheduleLine = useMemo(() => {
    if (!schedule?.slot_date) return null;
    return `${formatDate(schedule.slot_date)} · ${formatSlotTime(schedule.start_time)} – ${formatSlotTime(schedule.end_time)}`;
  }, [schedule]);

  const currentStatus = request?.request_status;

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <RegistrarSidebar active="queue" onLogout={handleLogout} me={me} />
      <RegistrarMobileHeader onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <a href={QUEUE_PATH} className="ts-link inline-flex items-center gap-1.5 text-sm font-medium">
          <span aria-hidden="true">&larr;</span> Back to Queue
        </a>

        {status === 'loading' && (
          <div className="mt-6">
            <div className="ts-skeleton h-9 w-72" />
            <div className="ts-skeleton mt-3 h-4 w-56" />
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="ts-card h-80 lg:col-span-3" />
              <div className="ts-card h-60 lg:col-span-2" />
            </div>
          </div>
        )}

        {status === 'notfound' && (
          <div className="ts-card mt-6 px-6 py-14 text-center">
            <p className="ts-ink text-sm font-semibold">Request not found</p>
            <p className="ts-soft mt-1 text-sm">It may have been removed, or the link is wrong.</p>
            <a href={QUEUE_PATH} className="ts-btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium">
              Back to Queue
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mt-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>Something went wrong loading this request.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">Retry</button>
          </div>
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
                <p className="ts-soft mt-1.5 text-sm">
                  Submitted {formatDate(request.created_at)} · {request.transaction_type}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
              {/* ---------------- Left: the request itself ---------------- */}
              <div className="lg:col-span-3 space-y-6">
                <div className="ts-card p-6">
                  <h2 className="ts-ink text-base font-semibold" style={FONT_SERIF}>Student</h2>
                  <div className="mt-4">
                    <p className="ts-review-value text-base">{request.student_full_name}</p>
                    <p className="ts-soft mt-0.5 text-sm">
                      ID: {request.student_school_id_number || '—'}
                      {request.student_course ? ` · ${request.student_course}` : ''}
                      {request.student_year_level ? ` · ${request.student_year_level}` : ''}
                    </p>
                  </div>

                  <div className="ts-row-divider my-5" />

                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Transaction Type">{request.transaction_type}</Field>
                    <Field label="Number of Copies">{request.number_of_copies}</Field>
                    {request.number_of_pages != null && (
                      <Field label="Number of Pages">{request.number_of_pages}</Field>
                    )}
                    {(request.submission_extras || []).map((extra) => (
                      <Field key={extra.label} label={extra.label}>{extra.value}</Field>
                    ))}
                    <Field label="Purpose">
                      {request.purpose === 'Others' ? request.purpose_other || 'Others' : request.purpose}
                    </Field>
                    <Field label="Semester / Year">{request.semester}</Field>
                    {amountDue && <Field label="Amount Due">{amountDue}</Field>}
                    {request.or_number && <Field label="O.R. Number">{request.or_number}</Field>}
                    {request.payment_date && <Field label="Payment Date">{formatDate(request.payment_date)}</Field>}
                    {request.verified_by_name && (
                      <Field label="Verified By">
                        {request.verified_by_name}
                        <span className="ts-soft block text-xs font-normal">
                          Front Desk Personnel
                        </span>
                      </Field>
                    )}
                    {request.approved_by_name && (
                      <Field label="Approved By">
                        {request.approved_by_name}
                        <span className="ts-soft block text-xs font-normal">
                          {formatDateTime(request.registrar_approved_at)}
                        </span>
                      </Field>
                    )}
                    {request.additional_notes && (
                      <Field label="Additional Notes" className="sm:col-span-2">
                        <span className="font-normal">{request.additional_notes}</span>
                      </Field>
                    )}
                  </div>

                  {proxy && (
                    <>
                      <div className="ts-row-divider my-5" />
                      <p className="ts-review-label">Authorised Proxy</p>
                      <p className="ts-review-value">
                        {proxy.proxy_full_name} ({proxy.relationship})
                      </p>
                      <p className="ts-soft mt-0.5 text-xs">{proxy.contact_number}</p>
                    </>
                  )}

                  <div className="ts-row-divider my-5" />

                  <p className="ts-review-label">Uploaded Requirements</p>
                  {request.uploaded_files.length === 0 ? (
                    <p className="ts-soft mt-1.5 text-xs leading-relaxed">
                      No files tracked for this request. TRANSACTION_TYPES.required_documents lists what&rsquo;s
                      needed, but there is currently no table storing multiple student-uploaded files per
                      request — see the SUBMISSION_ATTACHMENTS note.
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

              {/* ---------------- Right: the actions for THIS stage ---------------- */}
              <div className="lg:col-span-2 space-y-6">
                {actionError && (
                  <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
                    {actionError}
                  </div>
                )}

                {/* Pending Verification -> Front Desk verification (first of the
                    form's two signatures). No fee is assessed here. */}
                {currentStatus === STATUS.SUBMITTED && (
                  <ActionCard
                    title="Front Desk Verification"
                    description="Check the requirements and clearance. The Registrar assesses the fee separately, after this."
                  >
                    <label htmlFor="reviewRemarks" className="ts-ink mb-1.5 block text-sm font-medium">
                      Review Remarks
                    </label>
                    <textarea
                      id="reviewRemarks"
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add review notes or a rejection reason..."
                      className="ts-input w-full px-3.5 py-2.5 text-sm"
                    />
                    <div className="mt-4 flex flex-col gap-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runTransition('verify', `/api/registrar/queue/${request.id}/verify/`, {
                            method: 'POST',
                            body: { remarks: remarks.trim() },
                            successMessage: 'Requirements verified — sent to the Registrar for approval.',
                          })
                        }
                        className="ts-btn-sage flex items-center justify-center gap-2 py-2.5 text-sm font-medium"
                      >
                        {actionLoading === 'verify' && <Spinner />}
                        Verify Requirements
                      </button>
                      <button
                        type="button"
                        disabled={busy || !remarks.trim()}
                        onClick={() =>
                          runTransition('reject', `/api/registrar/queue/${request.id}/reject/`, {
                            method: 'POST',
                            body: { remarks: remarks.trim() },
                            successMessage: 'Request rejected — the student has been notified.',
                          })
                        }
                        className="ts-btn-outline-danger flex items-center justify-center gap-2 py-2.5 text-sm font-medium"
                      >
                        {actionLoading === 'reject' && <Spinner />}
                        Reject with Remarks
                      </button>
                    </div>
                  </ActionCard>
                )}

                {/* Verified -> Registrar approval (the form's second signature).
                    This is where the fee is assessed. */}
                {currentStatus === STATUS.VERIFIED && (
                  <ActionCard
                    title="Registrar Approval"
                    description="Approving assesses the fee and lets the student print their Cashier form."
                  >
                    {request.verified_by_name && (
                      <div className="ts-well mb-4 px-3.5 py-2.5">
                        <p className="ts-review-label">Verified By</p>
                        <p className="ts-ink mt-0.5 text-sm font-semibold">{request.verified_by_name}</p>
                        <p className="ts-soft text-xs">Front Desk Personnel</p>
                      </div>
                    )}
                    <label htmlFor="approvalRemarks" className="ts-ink mb-1.5 block text-sm font-medium">
                      Remarks <span className="ts-soft font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="approvalRemarks"
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add a note, or a reason if declining..."
                      className="ts-input w-full px-3.5 py-2.5 text-sm"
                    />
                    <div className="mt-4 flex flex-col gap-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runTransition('approve', `/api/registrar/queue/${request.id}/approve/`, {
                            method: 'POST',
                            successMessage: 'Approved — the student can now print and pay.',
                          })
                        }
                        className="ts-btn-primary flex items-center justify-center gap-2 py-2.5 text-sm font-medium"
                      >
                        {actionLoading === 'approve' && <Spinner />}
                        Approve &amp; Assess Fee
                      </button>
                      <button
                        type="button"
                        disabled={busy || !remarks.trim()}
                        onClick={() =>
                          runTransition('reject', `/api/registrar/queue/${request.id}/reject/`, {
                            method: 'POST',
                            body: { remarks: remarks.trim() },
                            successMessage: 'Request rejected — the student has been notified.',
                          })
                        }
                        className="ts-btn-outline-danger flex items-center justify-center gap-2 py-2.5 text-sm font-medium"
                      >
                        {actionLoading === 'reject' && <Spinner />}
                        Reject with Remarks
                      </button>
                    </div>
                  </ActionCard>
                )}

                {/* Approved -> Approve & Log (Part 1) */}
                {currentStatus === STATUS.APPROVED && (
                  <ActionCard
                    title="Log Cashier Payment"
                    description="The student pays in person. Enter what was written on their printed form."
                  >
                    {amountDue && (
                      <div className="ts-well mb-4 px-3.5 py-2.5">
                        <p className="ts-review-label">Amount Due</p>
                        <p className="ts-ink text-lg font-semibold" style={FONT_SERIF}>{amountDue}</p>
                      </div>
                    )}
                    <div className="space-y-3.5">
                      <div>
                        <label htmlFor="orNumber" className="ts-ink mb-1.5 block text-sm font-medium">
                          O.R. Number
                        </label>
                        <input
                          id="orNumber"
                          type="text"
                          value={orNumber}
                          onChange={(e) => setOrNumber(e.target.value)}
                          placeholder="e.g. OR-104582"
                          className="ts-input w-full px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="paymentDate" className="ts-ink mb-1.5 block text-sm font-medium">
                          Payment Date
                        </label>
                        <input
                          id="paymentDate"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="ts-input w-full px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !orNumber.trim() || !paymentDate}
                      onClick={() =>
                        runTransition('approve-log', `/api/form-requests/${request.id}/approve-log/`, {
                          body: { or_number: orNumber.trim(), payment_date: paymentDate },
                          successMessage: 'Payment logged — request moved to Processing',
                        })
                      }
                      className="ts-btn-primary mt-4 flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium"
                    >
                      {actionLoading === 'approve-log' && <Spinner />}
                      Approve &amp; Log
                    </button>
                  </ActionCard>
                )}

                {/* Processing -> Mark Ready to Release (Part 3) */}
                {currentStatus === STATUS.PROCESSING && (
                  <ActionCard
                    title="Mark Ready to Release"
                    description="Set when the student can collect this, then notify them."
                  >
                    {scheduleLine && (
                      <p className="ts-soft mb-3 text-xs leading-relaxed">
                        Currently booked for <strong>{scheduleLine}</strong>. Adjust below if needed.
                      </p>
                    )}

                    <div className="space-y-3.5">
                      <div>
                        <label htmlFor="releaseDate" className="ts-ink mb-1.5 block text-sm font-medium">
                          Release Date
                        </label>
                        <input
                          id="releaseDate"
                          type="date"
                          value={releaseDate}
                          onChange={(e) => {
                            setReleaseDate(e.target.value);
                            // The chosen slot belongs to the old date, so it
                            // cannot carry over to a new one.
                            setReleaseSlotId('');
                          }}
                          className="ts-input w-full px-3.5 py-2.5 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="releaseSlot" className="ts-ink mb-1.5 block text-sm font-medium">
                          Release Window
                        </label>
                        <div className="relative">
                          <select
                            id="releaseSlot"
                            value={releaseSlotId}
                            onChange={(e) => setReleaseSlotId(e.target.value)}
                            disabled={slotsLoading}
                            className="ts-input ts-select w-full py-2.5 pl-3.5 pr-9 text-sm"
                          >
                            <option value="">Other time (not tied to a slot)</option>
                            {slotsForDate.map((slot) => (
                              <option key={slot.id} value={String(slot.id)}>
                                {formatSlotTime(slot.start_time)} to {formatSlotTime(slot.end_time)}
                                {slot.remaining != null ? ` (${slot.remaining} left)` : ''}
                              </option>
                            ))}
                          </select>
                          <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                            <ChevronIcon />
                          </span>
                        </div>
                        <p className="ts-soft mt-1.5 text-xs leading-relaxed">
                          {slotsLoading
                            ? 'Checking windows for this date...'
                            : slotsForDate.length === 0
                              ? 'No published windows on this date. Set a time below instead.'
                              : 'Picking a window counts this request against its capacity.'}
                        </p>
                      </div>

                      {/* Only meaningful on the freeform path: a chosen slot
                          supplies its own time, and the server overwrites
                          anything sent here so the two cannot disagree. */}
                      {!releaseSlotId && (
                        <div>
                          <label htmlFor="releaseTime" className="ts-ink mb-1.5 block text-sm font-medium">
                            Release Time <span className="ts-soft font-normal">(optional)</span>
                          </label>
                          <input
                            id="releaseTime"
                            type="time"
                            value={releaseTime}
                            onChange={(e) => setReleaseTime(e.target.value)}
                            className="ts-input w-full px-3.5 py-2.5 text-sm"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={busy || !releaseDate}
                      onClick={() =>
                        runTransition('mark-ready', `/api/form-requests/${request.id}/mark-ready/`, {
                          body: {
                            release_date: releaseDate,
                            release_time_start: releaseSlotId ? null : releaseTime || null,
                            release_slot: releaseSlotId ? Number(releaseSlotId) : null,
                          },
                          successMessage: 'Student notified — request is ready for pickup',
                        })
                      }
                      className="ts-btn-primary mt-4 flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium"
                    >
                      {actionLoading === 'mark-ready' && <Spinner />}
                      Mark Ready to Release
                    </button>
                  </ActionCard>
                )}

                {/* Ready for Pickup -> Release (Part 3, terminal) */}
                {currentStatus === STATUS.READY && (
                  <ActionCard
                    title="Release Document"
                    description="Final step. Record who physically collected the document."
                  >
                    {scheduleLine && (
                      <div className="ts-well mb-4 px-3.5 py-2.5">
                        <p className="ts-review-label">Release Window</p>
                        <p className="ts-ink mt-0.5 text-sm font-semibold">{scheduleLine}</p>
                      </div>
                    )}

                    {proxy && (
                      <div className="ts-banner ts-banner-pending mb-4 px-3.5 py-3 text-sm">
                        <p className="font-semibold">Proxy claim expected</p>
                        <p className="mt-1 leading-relaxed">
                          Verify the notarized authorization letter and both IDs before releasing.
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
                            I verified the authorization letter and the IDs of both{' '}
                            <strong>{request.student_full_name}</strong> and{' '}
                            <strong>{proxy.proxy_full_name}</strong>.
                          </span>
                        </label>
                      </div>
                    )}

                    <div>
                      <label htmlFor="claimantName" className="ts-ink mb-1.5 block text-sm font-medium">
                        Claimant Name
                      </label>
                      <input
                        id="claimantName"
                        type="text"
                        value={claimantName}
                        onChange={(e) => setClaimantName(e.target.value)}
                        placeholder={proxy ? `e.g. ${proxy.proxy_full_name}` : "Who is collecting this document?"}
                        className="ts-input w-full px-3.5 py-2.5 text-sm"
                      />
                      <p className="ts-soft mt-1.5 text-xs">
                        A typed name is recorded — signature capture is not yet available.
                      </p>
                    </div>

                    {!confirmingRelease ? (
                      <button
                        type="button"
                        disabled={busy || !claimantName.trim() || (proxy && !proxyAcknowledged)}
                        onClick={() => setConfirmingRelease(true)}
                        className="ts-btn-primary mt-4 flex w-full items-center justify-center py-2.5 text-sm font-medium"
                      >
                        Release Document
                      </button>
                    ) : (
                      <div className="ts-well mt-4 px-3.5 py-3.5">
                        <p className="ts-ink text-sm font-semibold">Confirm release?</p>
                        <p className="ts-soft mt-1 text-sm leading-relaxed">
                          This closes {request.request_code} and records{' '}
                          <strong>{claimantName.trim()}</strong> as the claimant. It cannot be undone.
                        </p>
                        <div className="mt-3.5 flex flex-col gap-2.5 sm:flex-row">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runTransition('release', `/api/form-requests/${request.id}/release/`, {
                                body: {
                                  claimant_name: claimantName.trim(),
                                  proxy_acknowledged: proxyAcknowledged,
                                },
                                successMessage: 'Document released — request closed',
                              })
                            }
                            className="ts-btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium"
                          >
                            {actionLoading === 'release' && <Spinner />}
                            Yes, release it
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmingRelease(false)}
                            className="ts-btn-glass flex-1 py-2.5 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </ActionCard>
                )}

                {/* Released -> read-only record of the claim */}
                {currentStatus === STATUS.RELEASED && (
                  <ActionCard title="Released" description="This request is complete. No further action is available.">
                    <div className="space-y-4">
                      <Field label="Claimed By">{schedule?.claimant_name}</Field>
                      <Field label="Claimed At">{formatDateTime(schedule?.claimed_at)}</Field>
                      {request.or_number && <Field label="O.R. Number">{request.or_number}</Field>}
                      {request.payment_date && <Field label="Payment Date">{formatDate(request.payment_date)}</Field>}
                    </div>
                    <a href={QUEUE_PATH} className="ts-btn-glass mt-5 flex w-full items-center justify-center py-2.5 text-sm font-medium">
                      Back to Queue
                    </a>
                  </ActionCard>
                )}

                {/* Rejected -> read-only, with the reason that was given */}
                {currentStatus === STATUS.REJECTED && (
                  <ActionCard title="Rejected" description="This request was not approved.">
                    <Field label="Reason Given">{request.verification_remarks}</Field>
                    <a href={QUEUE_PATH} className="ts-btn-glass mt-5 flex w-full items-center justify-center py-2.5 text-sm font-medium">
                      Back to Queue
                    </a>
                  </ActionCard>
                )}

                {/* Staff remarks from an earlier decision, shown alongside
                    whatever stage the request is at now. */}
                {request.verification_remarks && currentStatus !== STATUS.REJECTED && (
                  <div className="ts-card p-5">
                    <p className="ts-review-label">Latest Review Remarks</p>
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
