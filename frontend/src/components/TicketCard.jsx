import { useState } from 'react';
import { DownloadIcon, FONT_SERIF } from './trailsyncUI.jsx';
import { authFetch } from '../lib/auth.js';

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : PESO.format(n);
}

// Index into the 4-stage progress: Submitted -> Verified -> Ready -> Released.
// Rejected is handled separately (a single red indicator, not a position on
// this line) since a rejected request didn't "progress" to a step, it exited.
const STEP_ORDER = ['Submitted', 'Verified', 'Ready', 'Released'];
const STEP_LABELS = { Submitted: 'Submitted', Verified: 'Verified', Ready: 'Ready', Released: 'Released' };

export function formatShortDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

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
  const isRejected = request.request_status === 'Rejected';
  const [receiptState, setReceiptState] = useState('idle'); // 'idle' | 'loading' | 'error'
  const amountDue = formatAmount(request.amount_due);

  /**
   * Pull the printable form and hand it to the browser as a file.
   *
   * Fetched rather than linked because the endpoint is JWT-guarded, and a
   * plain href cannot carry an Authorization header. The blob is then
   * clicked through a throwaway anchor rather than window.open'd: opening a
   * tab after an await has already lost the user-gesture context, so popup
   * blockers swallow it silently in Safari and Firefox.
   */
  async function downloadReceipt() {
    setReceiptState('loading');
    try {
      const res = await authFetch(`/api/form-requests/${request.id}/receipt/`);
      if (!res.ok) throw new Error(String(res.status));

      const url = URL.createObjectURL(await res.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `TrailSync-${request.request_code}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Held briefly rather than revoked inline: some browsers abort the
      // save if the object URL disappears before they have read the blob.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setReceiptState('idle');
    } catch {
      setReceiptState('error');
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
                Rejected
              </span>
              {request.verification_remarks && (
                <span className="ts-soft text-xs">— {request.verification_remarks}</span>
              )}
            </div>
          ) : (
            <StepProgress status={request.request_status} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="ts-ticket-detail w-full">
          {request.request_status === 'Ready' && (
            <div className="ts-banner ts-banner-pending mb-3 px-3.5 py-2.5 text-sm">
              {request.release_schedule ? (
                <>
                  <span className="font-semibold">Ready for release:</span>{' '}
                  {formatShortDate(request.release_schedule.slot_date)} · {request.release_schedule.start_time}–
                  {request.release_schedule.end_time}
                </>
              ) : (
                'Your document is ready. Window 6 will confirm your release date and time soon.'
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <p className="ts-review-label">Transaction Type</p>
              <p className="ts-review-value">{request.transaction_type}</p>
            </div>
            <div>
              <p className="ts-review-label">Purpose</p>
              <p className="ts-review-value">
                {request.purpose === 'Other' ? request.purpose_other || 'Other' : request.purpose || '—'}
              </p>
            </div>
            <div>
              <p className="ts-review-label">Number of Copies</p>
              <p className="ts-review-value">{request.number_of_copies ?? '—'}</p>
            </div>
            <div>
              <p className="ts-review-label">Semester / Year</p>
              <p className="ts-review-value">{request.semester || '—'}</p>
            </div>
            {amountDue && (
              <div>
                <p className="ts-review-label">Amount Due</p>
                <p className="ts-review-value">{amountDue}</p>
              </div>
            )}
            {request.graduation_date && (
              <div>
                <p className="ts-review-label">Graduation Date</p>
                <p className="ts-review-value">{request.graduation_date}</p>
              </div>
            )}
            {request.additional_notes && (
              <div className="sm:col-span-2">
                <p className="ts-review-label">Additional Notes</p>
                <p className="ts-review-value font-normal">{request.additional_notes}</p>
              </div>
            )}
            {request.proxy && (
              <div className="sm:col-span-2">
                <p className="ts-review-label">Claimant Proxy Assignment</p>
                <p className="ts-review-value">
                  {request.proxy.proxy_full_name} ({request.proxy.relationship}) — {request.proxy.contact_number}
                </p>
              </div>
            )}
            {!isRejected && request.verification_remarks && (
              <div className="sm:col-span-2">
                <p className="ts-review-label">Staff Remarks</p>
                <p className="ts-review-value font-normal">{request.verification_remarks}</p>
              </div>
            )}
          </div>

          {request.receipt_available && (
            <div className="ts-ticket-actions">
              <p className="ts-soft text-xs">
                Print this form, pay at the Cashier, then present it at Window 6.
              </p>
              <button
                type="button"
                onClick={downloadReceipt}
                disabled={receiptState === 'loading'}
                className="ts-btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
              >
                <DownloadIcon />
                {receiptState === 'loading' ? 'Preparing…' : 'Download Receipt'}
              </button>
            </div>
          )}

          {receiptState === 'error' && (
            <p className="mt-2 text-xs" style={{ color: '#B91C1C' }}>
              Couldn&rsquo;t generate the form just now. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
