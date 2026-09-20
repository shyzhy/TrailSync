import { useState } from 'react';
import { errorFromResponse, formErrors, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';
import { FieldError } from '../ui/index.js';

const DATE = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function when(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : DATE.format(d);
}

// Offered from the start, not kept back as the consolation prize after a failed upload: a student who already knows
// their camera is poor shouldn't have to fail first to find out they can simply walk in.
function WindowSixLine({ afterRejection = false }) {
  return (
    <p className="ts-soft mt-2 text-xs">
      {afterRejection
        ? 'Rather not try another photo? You can bring your printed receipt straight to Window 6 instead.'
        : 'Prefer not to upload a photo? You can also bring your printed receipt directly to Window 6.'}
    </p>
  );
}

/** The student's own way to have a Cashier payment recorded: the O.R. number and a photo of the receipt. */
export default function PaymentProofPanel({ request, onChanged }) {
  const proof = request.payment_proof;
  const pending = proof && proof.verification_status === 'Pending';
  const rejected = proof && proof.verification_status === 'Rejected';

  const [orNumber, setOrNumber] = useState('');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const body = new FormData();
      body.append('student_entered_or_number', orNumber.trim());
      if (file) body.append('receipt_image', file);
      // No Content-Type header: the browser sets multipart with its boundary.
      const res = await authFetch(`/api/form-requests/${request.id}/payment-proof/`, { method: 'POST', body });
      if (!res.ok) throw await errorFromResponse(res);
      setSent(true);
      setOrNumber('');
      setFile(null);
      onChanged?.(await res.json());
    } catch (error) {
      const apiError = toApiError(error);
      setErrors(formErrors(apiError, ['student_entered_or_number', 'receipt_image']));
      // The request moved on while this panel was open; the list reload shows where it is now.
      if (apiError.kind === 'conflict') onChanged?.(null);
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <div className="ts-ticket-actions ts-ticket-actions-stack">
        <div className="ts-info-note w-full px-3.5 py-2.5 text-sm">
          <p className="ts-ink font-semibold">Payment proof under review</p>
          <p className="mt-1 leading-relaxed">
            {sent ? 'Submitted — we’ll review your payment and notify you once it’s confirmed.' : 'We’ll notify you once it’s confirmed.'}{' '}
            You sent O.R. {proof.student_entered_or_number}
            {when(proof.uploaded_at) ? ` on ${when(proof.uploaded_at)}` : ''}.
          </p>
          <WindowSixLine />
        </div>
      </div>
    );
  }

  if (!request.can_upload_payment_proof) return null;

  return (
    <div className="ts-ticket-actions ts-ticket-actions-stack">
      {rejected && (
        <div className="ts-banner ts-banner-error mb-3 w-full px-3.5 py-2.5 text-sm">
          <p className="font-semibold">We couldn’t confirm your last payment proof</p>
          <p className="mt-1 leading-relaxed">{proof.rejection_reason}</p>
        </div>
      )}
      <form onSubmit={submit} noValidate className="w-full" aria-label="Upload proof of payment">
        <p className="ts-ink text-sm font-semibold">
          {rejected ? 'Upload a clearer photo' : 'Already paid at the Cashier?'}
        </p>
        <p className="ts-soft mt-1 text-xs">
          Send us your receipt and we’ll record your payment, so you don’t have to bring the printed form back to Window 6.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`or-${request.id}`} className="ts-ink mb-1.5 block text-sm font-medium">
              O.R. number
            </label>
            <input
              id={`or-${request.id}`}
              type="text"
              value={orNumber}
              onChange={(e) => setOrNumber(e.target.value)}
              placeholder="As printed on your receipt"
              aria-invalid={Boolean(errors.student_entered_or_number)}
              aria-describedby={errors.student_entered_or_number ? `or-${request.id}-error` : undefined}
              className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.student_entered_or_number ? 'ts-input-error' : ''}`}
            />
            <FieldError id={`or-${request.id}`}>{errors.student_entered_or_number}</FieldError>
          </div>
          <div>
            <label htmlFor={`receipt-${request.id}`} className="ts-ink mb-1.5 block text-sm font-medium">
              Photo of your receipt
            </label>
            <input
              id={`receipt-${request.id}`}
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              aria-invalid={Boolean(errors.receipt_image)}
              aria-describedby={errors.receipt_image ? `receipt-${request.id}-error` : undefined}
              className="ts-input w-full px-3.5 py-2 text-sm"
            />
            <FieldError id={`receipt-${request.id}`}>{errors.receipt_image}</FieldError>
          </div>
        </div>

        <p className="ts-soft mt-2 text-xs">
          Please make sure your photo is clear and readable &mdash; this helps us verify and process your request faster.
        </p>

        {errors.general && (
          <div role="alert" className="ts-banner ts-banner-error mt-3 px-3.5 py-2.5 text-sm">
            {errors.general}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !orNumber.trim() || !file}
          aria-busy={busy}
          className="ts-btn-primary mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
        >
          {busy ? 'Submitting…' : 'Submit Payment Proof'}
        </button>
        {(!orNumber.trim() || !file) && (
          <p className="ts-soft mt-2 text-xs">Enter the O.R. number and choose a photo to submit.</p>
        )}
        <WindowSixLine afterRejection={rejected} />
      </form>
    </div>
  );
}
