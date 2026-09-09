import { useCallback, useEffect, useState } from 'react';
import {
  APP_CSS,
  CloseIcon,
  FONT_SANS,
  FONT_SERIF,
  PencilIcon,
  RegistrarMobileHeader,
  RegistrarSidebar,
  Spinner,
} from './trailsyncUI.jsx';
import ReleaseSlotCalendar, { toISODate } from './ReleaseSlotCalendar.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';

function todayISO() {
  const d = new Date();
  return toISODate(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateLong(iso) {
  // Parsed as local, not UTC — plain "YYYY-MM-DD" parsed via `new Date(iso)`
  // shifts a day in negative-UTC-offset timezones.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(t) {
  // "13:00:00" -> "1:00 PM"
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function CreateSlotModal({ lockedDate, onClose, onCreated }) {
  const [slotDate, setSlotDate] = useState(lockedDate || '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await authFetch('/api/registrar/release-slots/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_date: lockedDate || slotDate,
          start_time: startTime,
          end_time: endTime,
          available_slots: Number(capacity),
        }),
      });
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(Object.values(data).flat().filter((v) => typeof v === 'string').join(' ') || 'Could not create this slot.');
        return;
      }
      onCreated(lockedDate || slotDate);
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ts-modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Create release slot" className="ts-modal-panel p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="ts-modal-close">
          <CloseIcon />
        </button>
        <h2 className="ts-ink text-xl font-semibold" style={FONT_SERIF}>
          {lockedDate ? 'Add Time Slot' : 'Create New Slot'}
        </h2>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="slotDate" className="ts-ink mb-1.5 block text-sm font-medium">
              Date
            </label>
            {lockedDate ? (
              <p className="ts-input px-3.5 py-2.5 text-sm" style={{ color: '#5B6474' }}>
                {formatDateLong(lockedDate)}
              </p>
            ) : (
              <input
                id="slotDate"
                type="date"
                required
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="ts-input w-full px-3.5 py-2.5 text-sm"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startTime" className="ts-ink mb-1.5 block text-sm font-medium">
                Start Time
              </label>
              <input
                id="startTime"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="ts-input w-full px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="endTime" className="ts-ink mb-1.5 block text-sm font-medium">
                End Time
              </label>
              <input
                id="endTime"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="ts-input w-full px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="capacity" className="ts-ink mb-1.5 block text-sm font-medium">
              Slot Limit
            </label>
            <input
              id="capacity"
              type="number"
              min="1"
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="ts-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          {error && (
            <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="ts-btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium"
          >
            {submitting && <Spinner />}
            {submitting ? 'Creating…' : 'Create Slot'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AssignModal({ slot, onClose, onAssigned }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [requests, setRequests] = useState([]);
  const [submittingId, setSubmittingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/registrar/release-slots/assignable-requests/');
        if (res.status === 401) {
          clearSession();
          window.location.href = LOGIN_PATH;
          return;
        }
        if (!res.ok) throw new Error();
        setRequests(await res.json());
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  const handleAssign = async (formRequestId) => {
    setSubmittingId(formRequestId);
    setError('');
    try {
      const res = await authFetch(`/api/registrar/release-slots/${slot.id}/assign/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_request: formRequestId }),
      });
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(Object.values(data).flat().filter((v) => typeof v === 'string').join(' ') || 'Could not assign this request.');
        return;
      }
      onAssigned();
    } catch {
      setError('Unable to reach the server. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="ts-modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Assign a request to this slot" className="ts-modal-panel p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="ts-modal-close">
          <CloseIcon />
        </button>
        <h2 className="ts-ink text-xl font-semibold" style={FONT_SERIF}>
          Assign to {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
        </h2>
        <p className="ts-soft mt-1.5 text-sm">
          Approved requests ready to be scheduled. Picking one already assigned elsewhere reassigns it here.
        </p>

        {error && (
          <div role="alert" className="ts-banner ts-banner-error mt-4 px-3.5 py-2.5 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {status === 'loading' && (
            <>
              <div className="ts-skeleton h-14 w-full" />
              <div className="ts-skeleton h-14 w-full" />
            </>
          )}
          {status === 'error' && <p className="ts-soft text-sm">Could not load assignable requests.</p>}
          {status === 'ready' && requests.length === 0 && (
            <p className="ts-soft py-6 text-center text-sm">No approved requests are waiting to be scheduled.</p>
          )}
          {status === 'ready' &&
            requests.map((r) => (
              <div key={r.id} className="ts-slot-card flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="ts-ink truncate text-sm font-medium">
                    {r.student_first_name} {r.student_last_name}
                  </p>
                  <p className="ts-soft truncate text-xs">
                    {r.request_code} · {r.transaction_type}
                    {r.current_slot_id === slot.id ? ' · Already in this slot' : r.current_slot_id ? ' · Assigned elsewhere' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(submittingId) || r.current_slot_id === slot.id}
                  onClick={() => handleAssign(r.id)}
                  className="ts-btn-primary flex shrink-0 items-center gap-2 px-4 py-1.5 text-xs font-medium"
                >
                  {submittingId === r.id && <Spinner />}
                  {r.current_slot_id === slot.id ? 'Assigned' : 'Assign'}
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function ReleaseSlotsPage() {
  const [me, setMe] = useState(() => getStoredUser());

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [dotDates, setDotDates] = useState([]);

  const [slotsStatus, setSlotsStatus] = useState('loading');
  const [slots, setSlots] = useState([]);

  const [createModalDate, setCreateModalDate] = useState(undefined); // undefined = closed, null = "any date", ISO = locked
  const [assignModalSlot, setAssignModalSlot] = useState(null);

  const loadCalendar = useCallback(async (y, m) => {
    const res = await authFetch(`/api/registrar/release-slots/calendar/?year=${y}&month=${m + 1}`);
    if (res.status === 401) {
      clearSession();
      window.location.href = LOGIN_PATH;
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setDotDates(data.map((d) => d.date));
    }
  }, []);

  const loadSlots = useCallback(async (dateISO) => {
    setSlotsStatus('loading');
    try {
      const res = await authFetch(`/api/registrar/release-slots/?date=${dateISO}`);
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (!res.ok) throw new Error();
      setSlots(await res.json());
      setSlotsStatus('ready');
    } catch {
      setSlotsStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    authFetch('/api/me/').then(async (res) => {
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (res.ok) setMe(await res.json());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCalendar(year, month);
  }, [year, month, loadCalendar]);

  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  const handleMonthChange = (y, m) => {
    setYear(y);
    setMonth(m);
  };

  const handleSlotCreated = (dateISO) => {
    setCreateModalDate(undefined);
    loadCalendar(year, month);
    setSelectedDate(dateISO);
    loadSlots(dateISO);
  };

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <RegistrarSidebar active="slots" onLogout={handleLogout} me={me} />
      <RegistrarMobileHeader onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Manage Release Slots
            </h1>
            <p className="ts-soft mt-1.5 max-w-xl text-sm">
              Configure dates, daily window hours, limits, and assign approved student documents to slot schedules.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateModalDate(null)}
            className="ts-btn-primary shrink-0 px-5 py-2.5 text-sm font-medium"
          >
            + Create New Slot
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ReleaseSlotCalendar
              year={year}
              month={month}
              onMonthChange={handleMonthChange}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              dotDates={dotDates}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>
                Slots for {formatDateLong(selectedDate)}
              </h2>
              <button type="button" onClick={() => setCreateModalDate(selectedDate)} className="ts-link text-sm font-medium">
                + Add Time Slot
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {slotsStatus === 'loading' && (
                <>
                  <div className="ts-card p-5">
                    <div className="ts-skeleton h-5 w-40" />
                    <div className="ts-skeleton mt-3 h-3 w-24" />
                  </div>
                </>
              )}

              {slotsStatus === 'error' && (
                <div className="ts-banner ts-banner-error px-4 py-3 text-sm">Could not load slots for this date.</div>
              )}

              {slotsStatus === 'ready' && slots.length === 0 && (
                <div className="ts-card flex flex-col items-center px-6 py-14 text-center">
                  <p className="ts-ink text-sm font-semibold">No slots configured for this date</p>
                  <p className="ts-soft mt-1 text-sm">Use "+ Add Time Slot" to create one.</p>
                </div>
              )}

              {slotsStatus === 'ready' &&
                slots.map((slot) => (
                  <div key={slot.id} className="ts-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="ts-ink text-base font-semibold">
                        {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                      </p>
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label="Edit slot" className="ts-icon-chip">
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignModalSlot(slot)}
                          className="ts-btn-primary px-4 py-1.5 text-xs font-medium"
                        >
                          Assign
                        </button>
                      </div>
                    </div>

                    <p className="ts-soft mt-1.5 text-sm">
                      {slot.assigned_count > 0
                        ? `${slot.assigned_count}/${slot.available_slots} slots filled`
                        : `0/${slot.available_slots} slots available`}
                    </p>

                    {slot.assignments.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {slot.assignments.map((a) => (
                          <li
                            key={a.form_request_id}
                            className="ts-row-hover flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="ts-ink truncate text-sm font-medium">
                                {a.student_first_name} {a.student_last_name}
                              </p>
                              <p className="ts-soft truncate text-xs">{a.transaction_type}</p>
                            </div>
                            <span
                              className={`ts-pill shrink-0 ${a.status === 'Claimed' ? 'ts-pill-ready' : 'ts-pill-processing'}`}
                              style={a.status === 'Scheduled' ? { color: '#1E3A6B', background: 'rgba(36,64,107,0.10)', borderColor: 'rgba(36,64,107,0.28)' } : undefined}
                            >
                              {a.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </main>

      {createModalDate !== undefined && (
        <CreateSlotModal
          lockedDate={createModalDate}
          onClose={() => setCreateModalDate(undefined)}
          onCreated={handleSlotCreated}
        />
      )}

      {assignModalSlot && (
        <AssignModal
          slot={assignModalSlot}
          onClose={() => setAssignModalSlot(null)}
          onAssigned={() => {
            setAssignModalSlot(null);
            loadSlots(selectedDate);
          }}
        />
      )}
    </div>
  );
}
