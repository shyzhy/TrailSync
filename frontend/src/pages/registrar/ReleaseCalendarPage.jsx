import { useCallback, useEffect, useState } from 'react';
import { RegistrarMobileHeader, RegistrarSidebar } from '../../components/layout/RegistrarSidebar.jsx';
import {
  CalendarIcon,
  EmptyState,
  ErrorState,
  ListRowSkeleton,
  SkeletonGroup,
} from '../../components/ui/index.js';
import ReleaseCalendar, { todayIso } from '../../components/registrar/ReleaseCalendar.jsx';
import { APP_CSS } from '../../styles/appCss.js';
import { FONT_SANS, FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import { authFetch, clearSession, getAccessToken, getStoredUser, STAFF_LOGIN_PATH } from '../../lib/auth.js';
import { STATUS } from '../../lib/requestStatus.js';

const LOGIN_PATH = STAFF_LOGIN_PATH;

// "15:00" -> "3:00 PM".
function formatClock(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// Where each release stands, in the words the counter uses.
const RELEASE_STATE = {
  [STATUS.RELEASED]: { label: 'Collected', className: 'ts-pill-ready' },
  [STATUS.READY]: { label: 'Not collected yet', className: 'ts-pill-blue' },
  [STATUS.PROCESSING]: { label: 'Still being prepared', className: 'ts-pill-processing' },
};

// ?date=YYYY-MM-DD when arriving from the dashboard, otherwise today; anything malformed falls back to today.
function initialDate() {
  const param = new URLSearchParams(window.location.search).get('date');
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [y, m, d] = param.split('-').map(Number);
    const probe = new Date(y, m - 1, d);
    if (probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d) return param;
  }
  return todayIso();
}

// View-only: a release date is set in exactly one place, Mark Ready on the Request Review page.
export default function ReleaseCalendarPage() {
  const [me, setMe] = useState(() => getStoredUser());
  const [selected, setSelected] = useState(initialDate);
  const [view, setView] = useState(() => {
    const [y, m] = initialDate().split('-').map(Number);
    return { year: y, month: m - 1 };
  });

  const [counts, setCounts] = useState({});
  const [monthStatus, setMonthStatus] = useState('loading'); // loading | ready | error
  const [monthError, setMonthError] = useState(null);
  const [day, setDay] = useState([]);
  const [dayStatus, setDayStatus] = useState('loading');
  const [dayError, setDayError] = useState(null);

  // Dates and counts for the visible month only.
  const loadMonth = useCallback(async () => {
    setMonthStatus('loading');
    try {
      const res = await authFetch(`/api/registrar/release-calendar/?year=${view.year}&month=${view.month + 1}`);
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setCounts(Object.fromEntries((data.days || []).map((d) => [d.date, d.count])));
      setMonthStatus('ready');
    } catch (error) {
      // Old numbers from the previous month must not linger under a failure.
      setCounts({});
      setMonthError(toApiError(error));
      setMonthStatus('error');
    }
  }, [view]);

  // Full detail only for the date someone actually opened.
  const loadDay = useCallback(async () => {
    if (!selected) return;
    setDayStatus('loading');
    try {
      const res = await authFetch(`/api/registrar/release-calendar/day/?date=${selected}`);
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setDay(data.releases || []);
      setDayStatus('ready');
    } catch (error) {
      setDayError(toApiError(error));
      setDayStatus('error');
    }
  }, [selected]);

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    authFetch('/api/me/')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setMe(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (getAccessToken()) loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    if (getAccessToken()) loadDay();
  }, [loadDay]);

  // Keep the address in step with the open date, so it can be shared or reloaded.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('date', selected);
    window.history.replaceState(null, '', url);
  }, [selected]);

  const changeMonth = (delta) => {
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToday = () => {
    const iso = todayIso();
    const [y, m] = iso.split('-').map(Number);
    setView({ year: y, month: m - 1 });
    setSelected(iso);
  };

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  const monthTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <RegistrarSidebar active="calendar" onLogout={handleLogout} me={me} />
      <RegistrarMobileHeader active="calendar" onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Release Calendar
        </h1>
        <p className="ts-soft mt-1.5 max-w-2xl text-base">
          Which days have documents going out, and who they&rsquo;re for. This page is for looking only &mdash; a
          pickup date is set from the request itself, in the Processing Queue.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_1fr]">
          {/* The month */}
          <div className="ts-card p-5 sm:p-6">
            <ReleaseCalendar
              year={view.year}
              month={view.month}
              counts={counts}
              selected={selected}
              onSelect={setSelected}
              onMonthChange={changeMonth}
              onToday={goToday}
              loading={monthStatus === 'loading'}
            />
            <div className="ts-hairline mt-5 h-px" />
            {monthStatus === 'error' ? (
              <ErrorState
                inline
                className="mt-3"
                error={monthError}
                title="We couldn&rsquo;t load this month"
                message="Days may look empty until it loads."
                onRetry={loadMonth}
              />
            ) : (
              <p className="ts-soft mt-3 flex items-center gap-2 text-sm">
                <span className="ts-relcal-count ts-relcal-count-legend" aria-hidden="true">
                  3
                </span>
                {monthStatus === 'loading'
                  ? 'Checking this month…'
                  : monthTotal === 0
                    ? 'Nothing scheduled this month.'
                    : `A number marks how many documents are due that day · ${monthTotal} this month`}
              </p>
            )}
          </div>

          {/* The open day */}
          <section className="ts-card flex flex-col p-5 sm:p-6" aria-live="polite" aria-labelledby="day-heading">
            <p className="ts-soft text-xs font-semibold uppercase tracking-wide">
              {selected === todayIso() ? 'Today' : 'Selected day'}
            </p>
            <h2 id="day-heading" className="ts-ink mt-1 text-xl font-semibold" style={FONT_SERIF}>
              {longDate(selected)}
            </h2>

            <div className="mt-4 flex-1">
              {dayStatus === 'loading' && (
                <SkeletonGroup label="Loading this day's releases" className="-mx-5 sm:-mx-6">
                  <ListRowSkeleton avatar={false} />
                  <ListRowSkeleton avatar={false} />
                </SkeletonGroup>
              )}

              {dayStatus === 'error' && (
                <ErrorState
                  boxed={false}
                  className="py-8"
                  error={dayError}
                  title="We couldn&rsquo;t load this day"
                  onRetry={loadDay}
                />
              )}

              {dayStatus === 'ready' && day.length === 0 && (
                <EmptyState
                  boxed={false}
                  className="py-10"
                  icon={CalendarIcon}
                  title="Nothing scheduled for this date."
                  message="Pick a day with a number on it to see who is due."
                />
              )}

              {dayStatus === 'ready' && day.length > 0 && (
                <>
                  <p className="ts-soft text-sm">
                    {day.length === 1 ? '1 document due' : `${day.length} documents due`}
                  </p>
                  <ul className="mt-2">
                    {day.map((r) => {
                      const state = RELEASE_STATE[r.request_status];
                      return (
                        <li key={r.id} className="ts-row-divider flex items-start justify-between gap-3 py-3.5">
                          <div className="min-w-0">
                            <p className="ts-ink truncate text-base font-medium">{r.student_name}</p>
                            <p className="ts-soft mt-0.5 text-sm">
                              {/* A link to read the request, not an action on it. */}
                              <a href={`/registrar/queue/${r.id}`} className="ts-link font-semibold">
                                {r.request_code}
                              </a>{' '}
                              &middot; {r.transaction_type}
                              {formatClock(r.release_time_start) ? ` · from ${formatClock(r.release_time_start)}` : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            {state && <span className={`ts-pill ${state.className}`}>{state.label}</span>}
                            {r.proxy_changed_at && r.request_status === 'Ready' && (
                              <span className="ts-pill ts-pill-processing">&#9888; Proxy changed</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
