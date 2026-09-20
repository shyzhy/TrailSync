import { useState } from 'react';
import { BusyLabel, FieldError } from '../ui/index.js';
import { errorFromResponse, formErrors, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';

function longDate(iso) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * The pickup moment on the student's ticket: telling Window 6 they have arrived, and asking for a new date after a
 * missed one. Both only ever appear at Ready for Pickup.
 */
export default function PickupActions({ request, onChanged }) {
  const schedule = request.release_schedule || {};
  const [busy, setBusy] = useState(null);
  const [errors, setErrors] = useState({});
  const [date, setDate] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const announce = async () => {
    setBusy('arrived');
    setErrors({});
    try {
      const res = await authFetch(`/api/form-requests/${request.id}/arrived/`, { method: 'POST' });
      if (!res.ok) throw await errorFromResponse(res);
      onChanged(await res.json());
    } catch (error) {
      const apiError = toApiError(error);
      setErrors({ general: apiError.message });
      // The request moved on while this page was open; reload so the ticket shows where it actually is.
      if (apiError.kind === 'conflict') onChanged(null);
    } finally {
      setBusy(null);
    }
  };

  const requestDate = async () => {
    setBusy('reschedule');
    setErrors({});
    try {
      const res = await authFetch(`/api/form-requests/${request.id}/reschedule/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_reschedule_date: date }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      setFormOpen(false);
      setDate('');
      onChanged(await res.json());
    } catch (error) {
      const apiError = toApiError(error);
      setErrors(formErrors(apiError, ['requested_reschedule_date']));
      if (apiError.kind === 'conflict') onChanged(null);
    } finally {
      setBusy(null);
    }
  };

  const pending = schedule.reschedule_status === 'Pending';
  const rejected = schedule.reschedule_status === 'Rejected';

  return (
    <>
      {request.can_announce_arrival && (
        <div className="ts-ticket-actions">
          <p className="ts-soft text-xs">At Window 6 now? Let them know so they can call you.</p>
          <button
            type="button"
            onClick={announce}
            disabled={busy === 'arrived'}
            className="ts-btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
          >
            <BusyLabel busy={busy === 'arrived'} busyLabel="Telling them…">
              I&rsquo;m Here for Pickup
            </BusyLabel>
          </button>
        </div>
      )}

      {/* Once tapped, the button is gone: a second tap would only move them down the queue. */}
      {request.arrival_notice_sent_at && request.request_status === 'Ready' && (
        <div className="ts-ticket-actions ts-ticket-actions-stack">
          <div className="ts-banner ts-banner-success w-full px-3.5 py-2.5 text-sm">
            <p className="font-semibold">Window 6 has been notified</p>
            <p className="mt-1 leading-relaxed">Please wait, they&rsquo;ll call you shortly.</p>
          </div>
        </div>
      )}

      {schedule.missed_pickup_notified_at && (
        <div className="ts-ticket-actions ts-ticket-actions-stack">
          <div className="w-full">
            <div className="ts-info-note px-3.5 py-2.5 text-sm">
              <p className="ts-ink font-semibold">You missed your pickup on {longDate(schedule.release_date)}</p>
              <p className="mt-1 leading-relaxed">
                Your document is still here. Ask for a new date and Window 6 will confirm it.
              </p>
            </div>

            {pending ? (
              <p className="ts-soft mt-2 text-sm">
                You asked for <strong className="ts-ink">{longDate(schedule.requested_reschedule_date)}</strong>. Your new
                pickup date request has been sent for approval.
              </p>
            ) : (
              <>
                {rejected && (
                  <p className="ts-soft mt-2 text-sm">
                    {longDate(schedule.requested_reschedule_date)} wasn&rsquo;t available. Choose another date.
                  </p>
                )}
                {formOpen ? (
                  <div className="mt-3">
                    <label htmlFor={`reschedule-${request.id}`} className="ts-ink mb-1.5 block text-sm font-medium">
                      Which day can you come?
                    </label>
                    <input
                      id={`reschedule-${request.id}`}
                      type="date"
                      value={date}
                      min={todayISO()}
                      onChange={(e) => setDate(e.target.value)}
                      aria-invalid={Boolean(errors.requested_reschedule_date)}
                      className={`ts-input w-full px-3.5 py-2.5 text-sm sm:w-auto ${errors.requested_reschedule_date ? 'ts-input-error' : ''}`}
                    />
                    <FieldError id={`reschedule-${request.id}`}>{errors.requested_reschedule_date}</FieldError>
                    <p className="ts-soft mt-1 text-xs">Window 6 releases documents from 3:00 to 5:00 PM.</p>
                    {errors.general && (
                      <div role="alert" className="ts-banner ts-banner-error mt-2 px-3.5 py-2.5 text-sm">
                        {errors.general}
                      </div>
                    )}
                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
                      <button type="button" onClick={() => setFormOpen(false)} className="ts-btn-glass px-4 py-2.5 text-sm font-medium">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={requestDate}
                        disabled={!date || busy === 'reschedule'}
                        className="ts-btn-primary px-4 py-2.5 text-sm font-medium"
                      >
                        <BusyLabel busy={busy === 'reschedule'} busyLabel="Sending…">
                          Send this date
                        </BusyLabel>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="ts-btn-primary mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
                  >
                    Request a New Pickup Date
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {errors.general && !formOpen && (
        <div className="ts-ticket-actions ts-ticket-actions-stack">
          <div role="alert" className="ts-banner ts-banner-error w-full px-3.5 py-2.5 text-sm">
            {errors.general}
          </div>
        </div>
      )}
    </>
  );
}
