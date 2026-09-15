import { useState } from 'react';
import { BusyLabel, Modal } from '../../components/ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';

// Confirm before suspending or reactivating, since suspending signs the person out everywhere.
export default function StatusChangeDialog({ account, onClose, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const suspending = account.status === 'Active';
  const who = account.name || account.email;

  const confirm = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await authFetch(`/api/admin/accounts/${account.id}/status/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: suspending ? 'Suspended' : 'Active' }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      onChanged(await res.json());
    } catch (err) {
      setError(toApiError(err).message);
      setSaving(false);
    }
  };

  return (
    <Modal label={suspending ? 'Suspend account' : 'Reactivate account'} onClose={onClose}>
      <h2 className="ts-ink pr-10 text-2xl font-semibold" style={FONT_SERIF}>
        {suspending ? `Suspend ${who}?` : `Reactivate ${who}?`}
      </h2>
      <div className="ts-soft mt-3 space-y-2 text-base leading-relaxed">
        {suspending ? (
          <>
            <p>They&rsquo;ll be signed out straight away and won&rsquo;t be able to log in until the account is reactivated.</p>
            <p>Nothing is deleted: their requests and records stay exactly as they are.</p>
          </>
        ) : (
          <p>They&rsquo;ll be able to log in again with their existing password.</p>
        )}
      </div>

      {error && (
        <div role="alert" className="ts-banner ts-banner-error mt-5 px-3.5 py-2.5 text-sm">
          {error}
        </div>
      )}

      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={saving} className="ts-btn-glass px-6 py-2.5 text-sm font-medium">
          Go back
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={saving}
          aria-busy={saving}
          className={`${suspending ? 'ts-btn-outline-danger' : 'ts-btn-primary'} flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium`}
        >
          <BusyLabel busy={saving} busyLabel={suspending ? 'Suspending…' : 'Reactivating…'}>
            {suspending ? 'Yes, suspend' : 'Yes, reactivate'}
          </BusyLabel>
        </button>
      </div>
    </Modal>
  );
}
