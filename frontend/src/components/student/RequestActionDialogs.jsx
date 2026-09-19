import { useState } from 'react';
import { BusyLabel, Modal } from '../ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, formErrors, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';
import { ProxyFields, ProxyPolicyNotice } from './ProxyFields.jsx';

// The two things a student can still do to a filed request: cancel it before paying, or name who collects it once ready.
// Both endpoints re-check the stage themselves; a 409 here means the request moved on while the ticket was open.

export function CancelRequestDialog({ request, onClose, onCancelled, onStale }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(`/api/form-requests/${request.id}/cancel/`, { method: 'POST' });
      if (!res.ok) throw await errorFromResponse(res);
      onCancelled(await res.json());
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError.message);
      if (apiError.kind === 'conflict') onStale();
      setBusy(false);
    }
  };

  return (
    <Modal label="Cancel this request" onClose={onClose}>
      <h2 className="ts-ink pr-10 text-2xl font-semibold" style={FONT_SERIF}>
        Cancel this request?
      </h2>
      <p className="ts-soft mt-1 text-sm">
        {request.transaction_type} · {request.request_code}
      </p>
      <p className="ts-ink mt-4 text-base leading-relaxed">
        This can&rsquo;t be undone, and you&rsquo;ll need to submit a new request if you change your mind.
      </p>

      {error && (
        <div role="alert" className="ts-banner ts-banner-error mt-5 px-3.5 py-2.5 text-sm">
          {error}
        </div>
      )}

      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={busy} className="ts-btn-glass px-6 py-2.5 text-sm font-medium">
          Keep my request
        </button>
        {!error && (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            aria-busy={busy}
            className="ts-btn-outline-danger flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium"
          >
            <BusyLabel busy={busy} busyLabel="Cancelling…">
              Yes, cancel request
            </BusyLabel>
          </button>
        )}
      </div>
    </Modal>
  );
}

export function ProxyDialog({ request, onClose, onSaved, onStale }) {
  const current = request.proxy;
  const [fullName, setFullName] = useState(current?.proxy_full_name || '');
  const [relationship, setRelationship] = useState(current?.relationship || '');
  const [contactNumber, setContactNumber] = useState(current?.contact_number || '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  // Typing into a field retires its message and the "please add" summary, so nothing stale stays on screen.
  const edit = (setter, key) => (value) => {
    setter(value);
    setErrors((prev) => (prev[key] || prev.general ? { ...prev, [key]: undefined, general: undefined } : prev));
  };

  const missing = [
    !fullName.trim() && 'their full name',
    !relationship && 'how they are related to you',
    !contactNumber.trim() && 'their mobile number',
  ].filter(Boolean);

  const save = async (e) => {
    e.preventDefault();
    if (missing.length) {
      setErrors({ general: `Please add ${missing.join(', ')}.` });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const res = await authFetch(`/api/form-requests/${request.id}/proxy/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy_full_name: fullName.trim(), relationship, contact_number: contactNumber.trim() }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      onSaved(await res.json());
    } catch (err) {
      const apiError = toApiError(err);
      setErrors(formErrors(apiError, ['proxy_full_name', 'relationship', 'contact_number']));
      if (apiError.kind === 'conflict') onStale();
      setBusy(false);
    }
  };

  return (
    <Modal label={current ? 'Change who collects it' : 'Assign a proxy'} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <h2 className="ts-ink pr-10 text-2xl font-semibold" style={FONT_SERIF}>
          {current ? 'Change who collects it' : 'Assign a proxy'}
        </h2>
        <p className="ts-soft mt-1.5 text-sm leading-relaxed">
          Someone else can collect your {request.transaction_type} ({request.request_code}). Window 6 sees the change
          straight away.
        </p>

        <ProxyPolicyNotice className="mt-5" />

        <div className="mt-5">
          <ProxyFields
            fullName={fullName}
            setFullName={edit(setFullName, 'proxy_full_name')}
            relationship={relationship}
            setRelationship={edit(setRelationship, 'relationship')}
            contactNumber={contactNumber}
            setContactNumber={edit(setContactNumber, 'contact_number')}
            errorFor={(key) => errors[key]}
            idPrefix="lateProxy"
          />
        </div>

        {errors.general && (
          <div role="alert" className="ts-banner ts-banner-error mt-5 px-3.5 py-2.5 text-sm">
            {errors.general}
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="ts-btn-glass px-6 py-2.5 text-sm font-medium">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="ts-btn-primary flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium"
          >
            <BusyLabel busy={busy} busyLabel="Saving…">
              {current ? 'Save the new proxy' : 'Save proxy'}
            </BusyLabel>
          </button>
        </div>
      </form>
    </Modal>
  );
}
