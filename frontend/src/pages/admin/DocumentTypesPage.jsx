import { useCallback, useEffect, useState } from 'react';
import AdminShell from '../../components/layout/AdminShell.jsx';
import {
  BusyLabel,
  DocumentIcon,
  EmptyState,
  ErrorState,
  FieldError,
  SkeletonGroup,
  TableRowSkeleton,
} from '../../components/ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, formErrors, toApiError } from '../../lib/api.js';
import { ADMIN_LOGIN_PATH, authFetch, clearSession, getAccessToken, getStoredUser } from '../../lib/auth.js';

const COLUMNS = ['Document', 'Fee', 'Pricing unit', 'Processing time', 'Available', ''];
const UNIT_LABEL = { flat: 'Flat', per_page: 'Per page' };
const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function feeLine(doc) {
  if (doc.fee_amount == null) return 'No set fee';
  return `${PESO.format(Number(doc.fee_amount))} ${doc.pricing_unit === 'per_page' ? 'a page' : 'a copy'}`;
}

// Inline editor for one document's fee, unit and processing time: quick to change when Window 6 announces a new fee.
function EditFields({ doc, layout, onSaved, onCancel }) {
  const [fee, setFee] = useState(doc.fee_amount ?? '');
  const [unit, setUnit] = useState(doc.pricing_unit);
  const [time, setTime] = useState(doc.processing_time ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Both layouts are in the page at once (one hidden), so ids carry the layout to stay unique.
  const ids = (name) => `${layout}-${name}-${doc.id}`;

  const save = async (e) => {
    e.preventDefault();
    const trimmed = String(fee).trim();
    if (trimmed && !(Number(trimmed) >= 0)) {
      setErrors({ fee_amount: 'Enter the fee as an amount, like 125.00.' });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const res = await authFetch(`/api/admin/document-types/${doc.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // An empty fee means "no published fee"; it is saved as none, not as zero.
        body: JSON.stringify({ fee_amount: trimmed === '' ? null : trimmed, pricing_unit: unit, processing_time: time }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      onSaved(await res.json());
    } catch (error) {
      setErrors(formErrors(error, ['fee_amount', 'pricing_unit', 'processing_time']));
    } finally {
      setSaving(false);
    }
  };

  const invalid = (key, id) => (errors[key] ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {});

  return (
    <form onSubmit={save} noValidate className="space-y-4" aria-label={`Edit ${doc.name}`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={ids('fee')} className="ts-ink mb-1.5 block text-sm font-medium">
            Fee (₱)
          </label>
          <input
            id={ids('fee')}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="No set fee"
            {...invalid('fee_amount', ids('fee'))}
            className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.fee_amount ? 'ts-input-error' : ''}`}
          />
          <FieldError id={ids('fee')}>{errors.fee_amount}</FieldError>
        </div>
        <div>
          <label htmlFor={ids('unit')} className="ts-ink mb-1.5 block text-sm font-medium">
            Pricing unit
          </label>
          <select
            id={ids('unit')}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            {...invalid('pricing_unit', ids('unit'))}
            className={`ts-input ts-select w-full px-3.5 py-2.5 text-sm ${errors.pricing_unit ? 'ts-input-error' : ''}`}
          >
            <option value="flat">Flat (one fee a copy)</option>
            <option value="per_page">Per page (Registrar counts pages)</option>
          </select>
          <FieldError id={ids('unit')}>{errors.pricing_unit}</FieldError>
        </div>
        <div>
          <label htmlFor={ids('time')} className="ts-ink mb-1.5 block text-sm font-medium">
            Processing time
          </label>
          <input
            id={ids('time')}
            type="text"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g. 3–5 working days"
            {...invalid('processing_time', ids('time'))}
            className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.processing_time ? 'ts-input-error' : ''}`}
          />
          <FieldError id={ids('time')}>{errors.processing_time}</FieldError>
        </div>
      </div>

      <p className="ts-soft text-sm">
        {doc.awaiting_assessment > 0
          ? `${doc.awaiting_assessment} request${doc.awaiting_assessment === 1 ? '' : 's'} not yet approved will be charged the new fee. `
          : ''}
        Requests already approved keep the fee they were given.
      </p>
      {errors.general && (
        <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
          {errors.general}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={saving} className="ts-btn-glass px-5 py-2.5 text-sm font-medium">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="ts-btn-primary flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium"
        >
          <BusyLabel busy={saving} busyLabel="Saving…">
            Save changes
          </BusyLabel>
        </button>
      </div>
    </form>
  );
}

function AvailabilitySwitch({ doc, busy, onToggle }) {
  return (
    <span className="ts-switch-wrap">
      <input
        type="checkbox"
        role="switch"
        checked={doc.is_available}
        disabled={busy}
        onChange={() => onToggle(doc)}
        aria-label={`${doc.name} can be requested`}
        className="ts-switch-input"
      />
      <span className="ts-switch-track" aria-hidden="true" />
      <span className="ts-switch-thumb" aria-hidden="true" />
    </span>
  );
}

// /admin/document-types: the fees, pricing units, turnaround and availability Window 6 asks the admin to keep current.
export default function DocumentTypesPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [docs, setDocs] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [meRes, listRes] = await Promise.all([authFetch('/api/me/'), authFetch('/api/admin/document-types/')]);
      const failed = [meRes, listRes].find((r) => !r.ok);
      if (failed) throw await errorFromResponse(failed);
      const [meData, listData] = await Promise.all([meRes.json(), listRes.json()]);
      setMe(meData);
      setDocs(listData);
      setStatus('ready');
    } catch (error) {
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = ADMIN_LOGIN_PATH;
      return;
    }
    load();
  }, [load]);

  const handleLogout = () => {
    clearSession();
    window.location.href = ADMIN_LOGIN_PATH;
  };

  const replace = (doc) => setDocs((list) => list.map((d) => (d.id === doc.id ? doc : d)));

  const saved = (doc) => {
    replace(doc);
    setEditingId(null);
    setToast({ message: `${doc.name} updated: ${feeLine(doc)}.`, tone: 'success' });
  };

  // Saved the moment it's flipped: pausing a document is the one change that can't wait for a form.
  const toggleAvailable = async (doc) => {
    setToggling(doc.id);
    try {
      const res = await authFetch(`/api/admin/document-types/${doc.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !doc.is_available }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      const updated = await res.json();
      replace(updated);
      setToast({
        message: updated.is_available
          ? `${updated.name} can be requested again.`
          : `${updated.name} is paused: students can't request it until you switch it back on.`,
        tone: 'success',
      });
    } catch (error) {
      setToast({ message: `That didn’t save. ${toApiError(error).message}`, tone: 'error' });
    } finally {
      setToggling(null);
    }
  };

  return (
    <AdminShell active="documents" me={me} onLogout={handleLogout} toast={toast} onToastDismiss={() => setToast(null)}>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Manage Document Types
        </h1>
        <p className="ts-soft mt-1.5 max-w-3xl text-base">
          Keep fees and processing times in line with Window 6. A new fee applies to requests the Registrar approves from
          now on; requests already approved keep the fee they were given.
        </p>

        {status === 'error' && (
          <ErrorState className="mt-6" error={loadError} title="We couldn&rsquo;t load the document types" onRetry={load} />
        )}

        {status === 'loading' && (
          <SkeletonGroup label="Loading document types" className="ts-card mt-6 overflow-hidden">
            <TableRowSkeleton widths={[4, 2, 2, 3, 1, 1]} />
            <div className="ts-row-divider" />
            <TableRowSkeleton widths={[4, 2, 2, 3, 1, 1]} />
            <div className="ts-row-divider" />
            <TableRowSkeleton widths={[4, 2, 2, 3, 1, 1]} />
          </SkeletonGroup>
        )}

        {status === 'ready' && docs.length === 0 && (
          <EmptyState
            className="mt-6"
            icon={DocumentIcon}
            title="No document types yet"
            message="Documents students can request appear here once they're added."
          />
        )}

        {status === 'ready' && docs.length > 0 && (
          <>
            {/* A table on wide screens; the same rows as cards on a phone. */}
            <div className="ts-card mt-6 hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    {COLUMNS.map((c, i) => (
                      <th
                        key={c || i}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: '#5B6474', borderBottom: '1px solid #E3DFD2' }}
                      >
                        {c || <span className="sr-only">Actions</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) =>
                    editingId === d.id ? (
                      <tr key={d.id} style={{ borderBottom: '1px solid rgba(227,223,210,0.6)', background: 'rgba(123,85,160,0.04)' }}>
                        <td className="ts-ink px-4 pt-4 align-top text-sm font-semibold">{d.name}</td>
                        <td colSpan={5} className="px-4 py-4">
                          <EditFields doc={d} layout="table" onSaved={saved} onCancel={() => setEditingId(null)} />
                        </td>
                      </tr>
                    ) : (
                      <tr key={d.id} className="ts-row-hover" style={{ borderBottom: '1px solid rgba(227,223,210,0.6)' }}>
                        <td className="ts-ink px-4 py-3.5 text-sm font-medium">{d.name}</td>
                        <td className="ts-ink whitespace-nowrap px-4 py-3.5 text-sm">
                          {d.fee_amount == null ? <span className="ts-soft">No set fee</span> : PESO.format(Number(d.fee_amount))}
                        </td>
                        <td className="ts-soft whitespace-nowrap px-4 py-3.5 text-sm">{UNIT_LABEL[d.pricing_unit] || d.pricing_unit}</td>
                        <td className="ts-soft px-4 py-3.5 text-sm">{d.processing_time || '—'}</td>
                        <td className="px-4 py-3.5">
                          <AvailabilitySwitch doc={d} busy={toggling === d.id} onToggle={toggleAvailable} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingId(d.id)}
                            aria-label={`Edit ${d.name}`}
                            className="ts-link ts-tap text-sm font-semibold"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-3 lg:hidden">
              {docs.map((d) => (
                <div key={d.id} className="ts-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="ts-ink text-base font-semibold">{d.name}</p>
                      <p className="ts-soft mt-0.5 text-sm">
                        {feeLine(d)}
                        {d.processing_time ? ` · ${d.processing_time}` : ''}
                      </p>
                    </div>
                    <AvailabilitySwitch doc={d} busy={toggling === d.id} onToggle={toggleAvailable} />
                  </div>
                  <div className="ts-hairline my-3 h-px" />
                  {editingId === d.id ? (
                    <EditFields doc={d} layout="card" onSaved={saved} onCancel={() => setEditingId(null)} />
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="ts-soft text-sm">{d.is_available ? 'Open for requests' : 'Paused'}</span>
                      <button
                        type="button"
                        onClick={() => setEditingId(d.id)}
                        aria-label={`Edit ${d.name}`}
                        className="ts-link ts-tap text-sm font-semibold"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </AdminShell>
  );
}
