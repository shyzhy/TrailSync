import { useState } from 'react';
import { DownloadIcon, FONT_SERIF, HelpTip } from './trailsyncUI.jsx';
import { LIFECYCLE, STATUS, STEP_LABEL, studentStatusLabel } from '../lib/requestStatus.js';
import { authFetch } from '../lib/auth.js';

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : PESO.format(n);
}

// The progress line walks the shared lifecycle, so adding a stage on the
// backend shows up here without this file needing to know about it. Rejected
// is handled separately (a single red indicator, not a position on the line)
// since a rejected request didn't progress to a step, it exited.
const STEP_ORDER = LIFECYCLE;
const STEP_LABELS = STEP_LABEL;

/** "15:00" -> "3:00 PM". The API sends 24-hour clock times; most people read 12. */
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

// What each stage means for the student, in one short line. The dots alone
// told them nothing: their labels were hover-only tooltips, and phones have
// no hover.
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

/**
 * The perforated ticket-stub card used everywhere a FormRequest is listed —
 * Track Requests' list is the main consumer, but the visual identity (colored
 * stub + serif code + dashed seam + step dots) is meant to be TrailSync's one
 * way of showing a request, not a table-row alternative.
 */
export default function TicketCard({ request, expanded, onToggle }) {
  const isRejected = request.request_status === STATUS.REJECTED;
  // null | 'receipt' | 'claim-stub' while downloading, or 'error'.
  const [docState, setDocState] = useState(null);
  const amountDue = formatAmount(request.amount_due);

  /**
   * Pull one of this request's PDFs and hand it to the browser as a file.
   *
   * Fetched rather than linked because both endpoints are JWT-guarded, and a
   * plain href cannot carry an Authorization header. The blob is then
   * clicked through a throwaway anchor rather than window.open'd: opening a
   * tab after an await has already lost the user-gesture context, so popup
   * blockers swallow it silently in Safari and Firefox.
   */
  async function downloadDocument(kind, filename) {
    setDocState(kind);
    try {
      const res = await authFetch(`/api/form-requests/${request.id}/${kind}/`);
      if (!res.ok) throw new Error(String(res.status));

      const url = URL.createObjectURL(await res.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Held briefly rather than revoked inline: some browsers abort the
      // save if the object URL disappears before they have read the blob.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDocState(null);
    } catch {
      setDocState('error');
    }
  }

  return (
    <div className="ts-ticket">
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

          {isRejected ? (
            <div className="mt-3 flex items-center gap-2">
              <span className="ts-ticket-rejected-dot" aria-hidden="true" />
              <span className="text-xs font-medium" style={{ color: '#B91C1C' }}>
                Not approved
              </span>
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

          {/* Mirrors the server's own flag, set for alumni who graduated
              before 2018. Explains the wait up front instead of letting it
              read as the request being stuck. */}
          {request.requires_archive_retrieval && !isRejected && request.request_status !== STATUS.RELEASED && (
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
              <p className="ts-review-label">Latest semester</p>
              <p className="ts-review-value">{request.semester || '—'}</p>
            </div>
            {amountDue && (
              <div>
                <p className="ts-review-label">Amount to pay</p>
                <p className="ts-review-value">{amountDue}</p>
                <p className="ts-soft text-xs">Paid at the Cashier</p>
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

          {/* Exactly one of these is ever live: the print-and-pay form stops
              being generated the moment payment is logged, which is the same
              moment the claim stub switches on. */}
          {request.receipt_available && (
            <div className="ts-ticket-actions">
              <p className="ts-soft text-xs">
                Print this form, pay at the Cashier, then present it at Window 6.
              </p>
              <button
                type="button"
                onClick={() => downloadDocument('receipt', `TrailSync-${request.request_code}.pdf`)}
                disabled={docState === 'receipt'}
                className="ts-btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
              >
                <DownloadIcon />
                {/* It's the official request form (FM-USTP-RGTR-09) the student
                    prints and brings to the Cashier, not a proof of payment. */}
                {docState === 'receipt' ? 'Preparing…' : 'Download form'}
              </button>
            </div>
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

          {docState === 'error' && (
            <p className="mt-2 text-xs" style={{ color: '#B91C1C' }}>
              Couldn&rsquo;t generate that document just now. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
