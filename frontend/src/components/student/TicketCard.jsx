import { useState } from 'react';
import { DownloadIcon, HelpTip } from '../ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';
import { LIFECYCLE, STATUS, STEP_LABEL, studentStatusLabel } from '../../lib/requestStatus.js';
import { useStudentShell } from '../layout/StudentShell.jsx';
import { CancelRequestDialog, ProxyDialog } from './RequestActionDialogs.jsx';
import PaymentProofPanel from './PaymentProofPanel.jsx';
import PickupActions from './PickupActions.jsx';

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : PESO.format(n);
}

// The progress line walks the shared lifecycle; Rejected is shown separately, since a rejected request exited rather than progressed.
const STEP_ORDER = LIFECYCLE;
const STEP_LABELS = STEP_LABEL;

// "15:00" -> "3:00 PM".
function formatClock(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function formatShortDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

// What each stage means for the student, in one short line.
const NEXT_STEP = {
  [STATUS.SUBMITTED]: "The Registrar's office is checking it.",
  [STATUS.VERIFIED]: "Waiting for the Registrar's approval.",
  [STATUS.APPROVED]: 'Download your form, then pay at the Cashier.',
  [STATUS.PROCESSING]: 'Payment received. Your document is being prepared.',
  [STATUS.READY]: 'Ready! Pick it up at Window 6.',
  [STATUS.RELEASED]: 'Picked up. All done.',
};

function StepProgress({ status }) {
  const currentIndex = STEP_ORDER.indexOf(status);
  return (
    <div className="ts-ticket-steps">
      {STEP_ORDER.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <span
              title={STEP_LABELS[step]}
              className={`ts-ticket-step-dot ${done ? 'ts-ticket-step-dot-done' : ''} ${
                current ? 'ts-ticket-step-dot-current' : ''
              }`}
            />
            {i < STEP_ORDER.length - 1 && (
              <span className={`ts-ticket-step-line ${i < currentIndex ? 'ts-ticket-step-line-done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// The ticket-stub card: TrailSync's one way of showing a request in a list.
// onChanged(request) hands back the updated request after a cancel or proxy change; onChanged(null) asks for a reload.
export default function TicketCard({ request, expanded, onToggle, onChanged }) {
  const isRejected = request.request_status === STATUS.REJECTED;
  const isCancelled = request.request_status === STATUS.CANCELLED;
  const { notify } = useStudentShell();
  const [docState, setDocState] = useState(null); // Which document is being prepared.
  const [docError, setDocError] = useState('');
  const [dialog, setDialog] = useState(null); // 'cancel' | 'proxy'
  // A 409 from either dialog means the request moved on; the list reloads once the dialog is closed.
  const [stale, setStale] = useState(false);
  const closeDialog = () => {
    setDialog(null);
    if (stale) {
      setStale(false);
      onChanged(null);
    }
  };
  // Until payment is logged this is today's price, so a fee change shows here at the next load; after, it's what was paid.
  const amountDue = formatAmount(request.amount_due);
  const amountLocked = Boolean(request.amount_locked);
  // A per-page document has no price until the Registrar counts the pages at approval.
  const amountPending =
    !amountDue && request.pricing_unit === 'per_page' && [STATUS.SUBMITTED, STATUS.VERIFIED].includes(request.request_status);

  // Fetched rather than linked (the endpoints need the Authorization header), then saved through a throwaway anchor so no popup blocker interferes.
  async function downloadDocument(kind, filename) {
    setDocState(kind);
    setDocError('');
    try {
      const res = await authFetch(`/api/form-requests/${request.id}/${kind}/`);
      if (!res.ok) throw await errorFromResponse(res);

      const url = URL.createObjectURL(await res.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoked later: some browsers abort the save if the object URL disappears first.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDocState(null);
      setDocError('');
    } catch (error) {
      setDocState(null);
      setDocError(`That document didn’t download. ${toApiError(error).message}`);
    }
  }

  return (
    <>
      <div className={`ts-ticket ${isCancelled ? 'ts-ticket-cancelled' : ''}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="ts-ticket-clickable flex flex-1 items-stretch text-left"
        >
          <div className="ts-ticket-stub">
            <span className="ts-ticket-stub-code" style={FONT_SERIF}>
              {request.request_code}
            </span>
            <span className="ts-ticket-stub-label">Window 6</span>
          </div>

          <div className="ts-ticket-body">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="ts-ink truncate text-sm font-semibold">{request.transaction_type}</p>
                <p className="ts-soft mt-0.5 text-xs">
                  {request.number_of_copies ? `${request.number_of_copies} ${request.number_of_copies === 1 ? 'copy' : 'copies'} · ` : ''}
                  {formatShortDate(request.created_at)}
                </p>
              </div>
              <span className="ts-soft shrink-0 text-xs font-medium">{expanded ? 'Hide details' : 'View details'}</span>
            </div>

            {isCancelled ? (
              // Not the progress line: a cancelled request ended on purpose, it isn't stuck at a stage.
              <div className="mt-3 flex items-center gap-2">
                <span className="ts-ticket-cancelled-dot" aria-hidden="true" />
                <span className="ts-soft text-xs font-medium">
                  Cancelled{request.cancelled_at ? ` on ${formatShortDate(request.cancelled_at)}` : ''}
                </span>
              </div>
            ) : isRejected ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="ts-ticket-rejected-dot" aria-hidden="true" />
                <span className="ts-error-text text-xs font-medium">Not approved</span>
                {request.verification_remarks && (
                  <span className="ts-soft text-xs">— {request.verification_remarks}</span>
                )}
              </div>
            ) : (
              <>
                <StepProgress status={request.request_status} />
                <p className="mt-2 text-xs">
                  <span className="ts-ink font-semibold">{studentStatusLabel(request.request_status)}</span>
                  {NEXT_STEP[request.request_status] && (
                    <span className="ts-soft"> &middot; {NEXT_STEP[request.request_status]}</span>
                  )}
                </p>
              </>
            )}
          </div>
        </button>

        {expanded && (
          <div className="ts-ticket-detail w-full">
            {request.request_status === STATUS.READY && (
              <div className="ts-banner ts-banner-pending mb-3 px-3.5 py-2.5 text-sm">
                {request.release_schedule?.release_date ? (
                  <>
                    <span className="font-semibold">Ready to pick up:</span>{' '}
                    {formatShortDate(request.release_schedule.release_date)}
                    {request.release_schedule.release_time_start &&
                      ` at ${formatClock(request.release_schedule.release_time_start)}`}
                    , at Window 6. Bring your claim stub and a valid ID.
                  </>
                ) : (
                  'Your document is ready! Window 6 releases documents from 3:00 to 5:00 PM. Bring your claim stub and a valid ID.'
                )}
              </div>
            )}

            {isCancelled && (
              <div className="ts-info-note mb-3 px-3.5 py-2.5 text-sm">
                You cancelled this request{request.cancelled_at ? ` on ${formatShortDate(request.cancelled_at)}` : ''}.
                Nothing more will happen with it. If you still need the document,{' '}
                <a href="/request-form" className="font-semibold underline">
                  send a new request
                </a>
                .
              </div>
            )}

            {isRejected && (
              <div className="ts-banner ts-banner-error mb-3 px-3.5 py-2.5 text-sm">
                This request wasn&rsquo;t approved
                {request.verification_remarks ? <> &mdash; the Registrar&rsquo;s note is below</> : ''}. You can fix
                what&rsquo;s needed and{' '}
                <a href="/request-form" className="font-semibold underline">
                  send a new request
                </a>
                .
              </div>
            )}

            {/* Mirrors the server's flag for alumni who graduated before 2018, so the wait doesn't read as the request being stuck. */}
            {request.requires_archive_retrieval && !isRejected && !isCancelled && request.request_status !== STATUS.RELEASED && (
              <div className="ts-info-note mb-3 flex items-start px-3.5 py-2.5 text-sm">
                <span>Your records are in the university archive, so this may take a little longer than usual.</span>
                <HelpTip label="Why does this take longer?">
                  Records from before 2018 are stored separately and have to be retrieved by hand before the Registrar
                  can prepare your document.
                </HelpTip>
              </div>
            )}

            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <p className="ts-review-label">Document</p>
                <p className="ts-review-value">{request.transaction_type}</p>
              </div>
              <div>
                <p className="ts-review-label">What it&rsquo;s for</p>
                <p className="ts-review-value">
                  {request.purpose === 'Others' ? request.purpose_other || 'Others' : request.purpose || '—'}
                </p>
              </div>
              <div>
                <p className="ts-review-label">Copies</p>
                <p className="ts-review-value">{request.number_of_copies ?? '—'}</p>
              </div>
              <div>
                <p className="ts-review-label">Last semester attended</p>
                <p className="ts-review-value">{request.semester || '—'}</p>
              </div>
              {request.page_count && (
                <div>
                  <p className="ts-review-label">Pages</p>
                  <p className="ts-review-value">{request.page_count} per copy</p>
                  <p className="ts-soft text-xs">Counted by the Registrar</p>
                </div>
              )}
              {amountDue && (
                <div>
                  <p className="ts-review-label">{amountLocked ? 'Amount paid' : 'Amount to pay'}</p>
                  <p className="ts-review-value">{amountDue}</p>
                  <p className="ts-soft text-xs">
                    {amountLocked ? 'Paid at the Cashier' : 'At the current fee, paid at the Cashier'}
                  </p>
                </div>
              )}
              {amountPending && (
                <div>
                  <p className="ts-review-label">Amount to pay</p>
                  <p className="ts-review-value">Pending</p>
                  <p className="ts-soft text-xs">Set when the Registrar approves and counts the pages</p>
                </div>
              )}
              {request.graduation_date && (
                <div>
                  <p className="ts-review-label">Graduated</p>
                  <p className="ts-review-value">{formatShortDate(request.graduation_date)}</p>
                </div>
              )}
              {request.additional_notes && (
                <div className="sm:col-span-2">
                  <p className="ts-review-label">Your notes</p>
                  <p className="ts-review-value font-normal">{request.additional_notes}</p>
                </div>
              )}
              {request.proxy && (
                <div className="sm:col-span-2">
                  <p className="ts-review-label">Picked up by</p>
                  <p className="ts-review-value">
                    {request.proxy.proxy_full_name} ({request.proxy.relationship}) — {request.proxy.contact_number}
                  </p>
                </div>
              )}
              {request.verification_remarks && (
                <div className="sm:col-span-2">
                  <p className="ts-review-label">Note from the Registrar</p>
                  <p className="ts-review-value font-normal">{request.verification_remarks}</p>
                </div>
              )}
            </div>

            {/* Before payment this is the print-and-pay form, drawn at today's fee. After, it's the paid copy kept on
                record, and the claim stub below is what the student brings, so the form steps back to a secondary button. */}
            {request.receipt_available && (
              <div className="ts-ticket-actions">
                <p className="ts-soft text-xs">
                  {amountLocked
                    ? 'Your request form as it stood when your payment was logged, for your records.'
                    : 'Print this form, pay at the Cashier, then present it at Window 6.'}
                </p>
                <button
                  type="button"
                  onClick={() => downloadDocument('receipt', `TrailSync-${request.request_code}.pdf`)}
                  disabled={docState === 'receipt'}
                  className={`${amountLocked ? 'ts-btn-glass' : 'ts-btn-primary'} inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-medium`}
                >
                  <DownloadIcon />
                  {/* The official request form (FM-USTP-RGTR-09) the student brings to the Cashier, not a proof of payment. */}
                  {docState === 'receipt' ? 'Preparing…' : 'Download form'}
                </button>
              </div>
            )}

            {/* A second way to the same place as Window 6's counter: send the receipt instead of carrying it in. */}
            {request.receipt_available && !amountLocked && (
              <PaymentProofPanel request={request} onChanged={onChanged} />
            )}

            {request.digital_stub_active && (
              <div className="ts-ticket-actions">
                <p className="ts-soft text-xs">
                  Your payment is logged. Bring this stub and a valid ID to Window 6.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    downloadDocument('claim-stub', `TrailSync-ClaimStub-${request.request_code}.pdf`)
                  }
                  disabled={docState === 'claim-stub'}
                  className="ts-btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
                >
                  <DownloadIcon />
                  {docState === 'claim-stub' ? 'Preparing…' : 'Download claim stub'}
                </button>
              </div>
            )}

            {/* The pickup moment itself: "I'm here", and a new date when one was missed. */}
            <PickupActions request={request} onChanged={onChanged} />

            {/* At Ready for Pickup plans can change: name someone else, or replace the person already named. */}
            {request.can_change_proxy && (
              <div className="ts-ticket-actions">
                <p className="ts-soft text-xs">
                  {request.proxy
                    ? 'Plans changed? Name someone else to collect it instead.'
                    : 'Can’t come yourself? Name someone to collect it for you.'}
                </p>
                <button
                  type="button"
                  onClick={() => setDialog('proxy')}
                  className="ts-btn-glass inline-flex shrink-0 items-center justify-center px-4 py-2 text-sm font-medium"
                >
                  {request.proxy ? 'Change Proxy' : 'Assign a Proxy'}
                </button>
              </div>
            )}

            {docError && (
              <p role="alert" className="ts-field-error">
                {docError}
              </p>
            )}

            {/* Only before payment is logged; the server re-checks, in case it was logged since this page loaded. */}
            {request.can_cancel && (
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => setDialog('cancel')} className="ts-tap ts-error-text text-sm font-semibold">
                  Cancel request
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Outside the ticket: its backdrop-filter and overflow would trap a fixed-position dialog inside the card. */}
      {dialog === 'cancel' && (
        <CancelRequestDialog
          request={request}
          onClose={closeDialog}
          onStale={() => setStale(true)}
          onCancelled={(updated) => {
            setDialog(null);
            onChanged(updated);
            notify(`${updated.request_code} is cancelled.`);
          }}
        />
      )}
      {dialog === 'proxy' && (
        <ProxyDialog
          request={request}
          onClose={closeDialog}
          onStale={() => setStale(true)}
          onSaved={(updated) => {
            setDialog(null);
            onChanged(updated);
            notify(`${updated.proxy.proxy_full_name} can now collect ${updated.request_code}. Window 6 can see the change.`);
          }}
        />
      )}
    </>
  );
}
