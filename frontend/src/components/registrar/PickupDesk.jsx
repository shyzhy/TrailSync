import { useCallback, useEffect, useRef, useState } from 'react';
import { BusyLabel } from '../ui/index.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';

// Someone is standing at the counter, so the list can't wait for a page refresh. Short enough to feel live, long
// enough not to hammer the server: the same idea as the notification bell's poll, at a counter's pace.
const POLL_MS = 8000;

function waitingLabel(minutes) {
  if (minutes < 1) return 'Just arrived';
  if (minutes < 60) return `Waiting ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Waiting ${hours}h${rest ? ` ${rest}m` : ''}`;
}

function longDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * The counter's own panel: who has tapped "I'm here" and is still waiting, and any new pickup date waiting for an
 * answer. It polls on its own rather than with the dashboard's one-shot load.
 */
export default function PickupDesk() {
  const [waiting, setWaiting] = useState([]);
  const [reschedules, setReschedules] = useState([]);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [deciding, setDeciding] = useState(null);
  // Minutes are counted server-side at each poll; this ticks the labels along between polls.
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/registrar/pickup-desk/');
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      if (!mounted.current) return;
      setWaiting(data.waiting || []);
      setReschedules(data.reschedules || []);
      setError(null);
    } catch (err) {
      if (mounted.current) setError(toApiError(err));
    } finally {
      if (mounted.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const poll = setInterval(load, POLL_MS);
    const minute = setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      mounted.current = false;
      clearInterval(poll);
      clearInterval(minute);
    };
  }, [load]);

  const decide = async (id, decision) => {
    setDeciding(`${id}-${decision}`);
    try {
      const res = await authFetch(`/api/registrar/queue/${id}/reschedule/${decision}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw await errorFromResponse(res);
      setReschedules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(toApiError(err));
      load();
    } finally {
      setDeciding(null);
    }
  };

  // Minutes since the poll that fetched this row, so a label doesn't sit still between polls.
  const minutesFor = (row) => {
    const since = row.arrived_at ? Math.floor((Date.now() - new Date(row.arrived_at).getTime()) / 60000) : row.waiting_minutes;
    return Number.isFinite(since) ? Math.max(since, 0) : row.waiting_minutes;
  };

  return (
    <section className="mb-6" aria-label="Pickup desk">
      <div className="ts-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="ts-ink text-lg font-semibold">Waiting for Pickup</h2>
          {waiting.length > 0 && <span className="ts-tag ts-tag-gold">{waiting.length} waiting</span>}
        </div>

        {error && loaded && waiting.length === 0 ? (
          <p className="ts-soft mt-3 text-sm">We couldn&rsquo;t refresh the list. {error.message}</p>
        ) : null}

        {!loaded ? (
          <p className="ts-soft mt-3 text-sm">Checking the counter&hellip;</p>
        ) : waiting.length === 0 ? (
          <p className="ts-soft mt-3 text-sm">No one is currently waiting.</p>
        ) : (
          <ul className="mt-3 space-y-2" key={tick}>
            {waiting.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-[#E3DFD2] bg-white px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="ts-ink text-sm font-semibold">{row.student_name}</p>
                  <p className="ts-soft mt-0.5 text-sm">
                    {row.request_code} &middot; {row.transaction_type}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="ts-soft text-sm font-medium">{waitingLabel(minutesFor(row))}</span>
                  {/* Straight to the Release action: with someone at the window, every extra click is a queue. */}
                  <a href={`/registrar/queue/${row.id}#release`} className="ts-btn-primary px-4 py-2 text-sm font-medium">
                    Process
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}

        {reschedules.length > 0 && (
          <div className="mt-5 border-t border-[#E3DFD2] pt-4">
            <h3 className="ts-ink text-base font-semibold">Pending Reschedule Requests</h3>
            <ul className="mt-3 space-y-2">
              {reschedules.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-[#E3DFD2] bg-white px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="ts-ink text-sm font-semibold">{row.student_name}</p>
                    <p className="ts-soft mt-0.5 text-sm">
                      {row.request_code} &middot; {row.transaction_type}
                    </p>
                    <p className="ts-soft mt-0.5 text-sm">
                      Missed {longDate(row.release_date)} &middot; asking for{' '}
                      <strong className="ts-ink">{longDate(row.requested_reschedule_date)}</strong>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decide(row.id, 'reject')}
                      disabled={Boolean(deciding)}
                      className="ts-btn-outline-danger px-4 py-2 text-sm font-medium"
                    >
                      <BusyLabel busy={deciding === `${row.id}-reject`} busyLabel="Sending…">
                        Reject
                      </BusyLabel>
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(row.id, 'approve')}
                      disabled={Boolean(deciding)}
                      className="ts-btn-primary px-4 py-2 text-sm font-medium"
                    >
                      <BusyLabel busy={deciding === `${row.id}-approve`} busyLabel="Saving…">
                        Approve
                      </BusyLabel>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
