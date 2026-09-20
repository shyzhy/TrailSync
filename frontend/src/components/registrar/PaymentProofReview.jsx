import { useState } from 'react';
import { errorFromResponse, formErrors, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';
import { FieldError } from '../ui/index.js';

const STAMP = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function when(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : STAMP.format(d);
}

const OUTCOME = {
  Accepted: { label: 'Accepted', className: 'ts-pill-ready' },
  Rejected: { label: 'Turned down', className: 'ts-pill-danger' },
  Superseded: { label: 'No longer needed', className: 'ts-pill-cancelled' },
};

function PastProof({ proof }) {
  const outcome = OUTCOME[proof.verification_status] || { label: proof.verification_status, className: 'ts-pill-released' };
  return (
    <li className="ts-well px-3.5 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`ts-pill ${outcome.className}`}>{outcome.label}</span>
        <span className="ts-soft text-xs">
          O.R. {proof.student_entered_or_number} &middot; sent {when(proof.uploaded_at)}
          {proof.reviewed_by ? ` · reviewed by ${proof.reviewed_by}` : ''}
        </span>
      </div>
      {proof.rejection_reason && <p className="ts-ink mt-1.5 text-sm">Reason: {proof.rejection_reason}</p>}
      {proof.receipt_image_url && (
        <a href={proof.receipt_image_url} target="_blank" rel="noreferrer" className="ts-soft mt-1.5 inline-block text-xs font-medium underline">
          View the photo that was reviewed
        </a>
      )}
    </li>
  );
}

/** The Registrar's review of a student's uploaded receipt: accept it (recording the payment) or turn it down with a reason. */
export default function PaymentProofReview({ request, onReviewed, busy }) {
  const proofs = request.payment_proofs || [];
  const pending = proofs.find((p) => p.verification_status === 'Pending') || null;
  const past = proofs.filter((p) => p.verification_status !== 'Pending');

  // Staff confirm the O.R. number against the photo rather than taking the student's typing on trust.
  const [orNumber, setOrNumber] = useState(pending ? pending.student_entered_or_number : '');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState(null); // 'accept' | 'reject' once the action is confirmed
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(null);

  const send = async (kind, body, fields) => {
    setSending(kind);
    setErrors({});
    try {
      const res = await authFetch(`/api/registrar/payment-proofs/${pending.id}/${kind}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await errorFromResponse(res);
      setMode(null);
      onReviewed(await res.json(), kind);
    } catch (error) {
      const apiError = toApiError(error);
      setErrors(formErrors(apiError, fields));
      setMode(null);
      if (apiError.kind === 'conflict') onReviewed(null);
    } finally {
      setSending(null);
    }
  };

  if (!pending && past.length === 0) return null;

  return (
    <div className="mb-5">
      {pending && (
        <div className="ts-info-note block px-4 py-4 text-sm">
          <p className="ts-ink text-base font-semibold">The student sent a photo of their receipt</p>
          <p className="ts-soft mt-1 text-xs">Uploaded {when(pending.uploaded_at)}. Check the O.R. number and amount against the photo.</p>

          {/* Stacked, not side by side: this panel lives in the page's narrow action column, and a fixed second
              column there would squeeze the photo down to a thumbnail. */}
          <div className="mt-3 space-y-3">
            {/* The link must be a block: inline, it collapses and the full-width image with it. */}
            <a href={pending.receipt_image_url} target="_blank" rel="noreferrer" title="Open the full-size photo" className="block">
              <img
                src={pending.receipt_image_url}
                alt="The receipt the student uploaded"
                className="ts-receipt-image w-full"
              />
            </a>
            <div className="ts-well px-3.5 py-2.5">
              <p className="ts-review-label">O.R. number the student typed</p>
              <p className="ts-ink text-lg font-semibold">{pending.student_entered_or_number}</p>

              <div className="mt-3">
                <label htmlFor="proofOrNumber" className="ts-ink mb-1.5 block text-sm font-medium">
                  O.R. number to record
                </label>
                <input
                  id="proofOrNumber"
                  type="text"
                  value={orNumber}
                  onChange={(e) => setOrNumber(e.target.value)}
                  aria-invalid={Boolean(errors.or_number)}
                  aria-describedby={errors.or_number ? 'proofOrNumber-error' : undefined}
                  className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.or_number ? 'ts-input-error' : ''}`}
                />
                <FieldError id="proofOrNumber">{errors.or_number}</FieldError>
                <p className="ts-soft mt-1 text-xs">Correct it here if the photo shows something else.</p>
              </div>

              <div className="mt-3">
                <label htmlFor="proofPaymentDate" className="ts-ink mb-1.5 block text-sm font-medium">
                  Date paid
                </label>
                <input
                  id="proofPaymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  aria-invalid={Boolean(errors.payment_date)}
                  aria-describedby={errors.payment_date ? 'proofPaymentDate-error' : undefined}
                  className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.payment_date ? 'ts-input-error' : ''}`}
                />
                <FieldError id="proofPaymentDate">{errors.payment_date}</FieldError>
              </div>
            </div>
          </div>

          {mode === 'reject' && (
            <div className="mt-4">
              <label htmlFor="proofReason" className="ts-ink mb-1.5 block text-sm font-medium">
                What should the student fix?
              </label>
              <textarea
                id="proofReason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Photo too blurry to read the O.R. number"
                aria-invalid={Boolean(errors.rejection_reason)}
                aria-describedby={errors.rejection_reason ? 'proofReason-error' : undefined}
                className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.rejection_reason ? 'ts-input-error' : ''}`}
              />
              <FieldError id="proofReason">{errors.rejection_reason}</FieldError>
              <p className="ts-soft mt-1 text-xs">They see this, so say what to do differently.</p>
            </div>
          )}

          {errors.general && (
            <div role="alert" className="ts-banner ts-banner-error mt-3 px-3.5 py-2.5 text-sm">
              {errors.general}
            </div>
          )}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {mode === 'reject' ? (
              <>
                <button type="button" onClick={() => setMode(null)} disabled={Boolean(sending)} className="ts-btn-glass px-5 py-2.5 text-sm font-medium">
                  Go back
                </button>
                <button
                  type="button"
                  disabled={Boolean(sending) || busy || !reason.trim()}
                  aria-busy={sending === 'reject'}
                  onClick={() => send('reject', { rejection_reason: reason.trim() }, ['rejection_reason'])}
                  className="ts-btn-outline-danger px-5 py-2.5 text-sm font-medium"
                >
                  {sending === 'reject' ? 'Sending…' : 'Send this back to the student'}
                </button>
              </>
            ) : mode === 'accept' ? (
              <>
                <button type="button" onClick={() => setMode(null)} disabled={Boolean(sending)} className="ts-btn-glass px-5 py-2.5 text-sm font-medium">
                  Go back
                </button>
                <button
                  type="button"
                  disabled={Boolean(sending) || busy}
                  aria-busy={sending === 'accept'}
                  onClick={() =>
                    send(
                      'accept',
                      { or_number: orNumber.trim(), payment_date: paymentDate, expected_amount_due: request.amount_due },
                      ['or_number', 'payment_date'],
                    )
                  }
                  className="ts-btn-primary px-5 py-2.5 text-sm font-medium"
                >
                  {sending === 'accept' ? 'Saving…' : `Yes, record O.R. ${orNumber.trim()}`}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={Boolean(sending) || busy}
                  onClick={() => setMode('reject')}
                  className="ts-btn-outline-danger px-5 py-2.5 text-sm font-medium"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={Boolean(sending) || busy || !orNumber.trim() || !paymentDate}
                  onClick={() => setMode('accept')}
                  className="ts-btn-primary px-5 py-2.5 text-sm font-medium"
                >
                  Accept
                </button>
              </>
            )}
          </div>
          {mode === 'accept' && (
            <p className="ts-soft mt-2 text-right text-xs">
              This records the payment, exactly as entering it from the printed receipt does.
            </p>
          )}
        </div>
      )}

      {past.length > 0 && (
        <div className={pending ? 'mt-4' : ''}>
          <p className="ts-review-label">Earlier uploads</p>
          <ul className="mt-2 space-y-2">
            {past.map((proof) => (
              <PastProof key={proof.id} proof={proof} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
