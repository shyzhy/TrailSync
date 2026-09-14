import { useCallback, useEffect, useState } from 'react';
import {
  APP_CSS,
  FONT_SANS,
  FONT_SERIF,
  RegistrarMobileHeader,
  RegistrarSidebar,
  greetingForNow,
  Avatar,
  EmptyState,
  ErrorState,
  InboxIcon,
  ListRowSkeleton,
  SkeletonGroup,
  StatCardSkeleton,
  WarningIcon,
} from './trailsyncUI.jsx';
import { STAFF_LOGIN_PATH, authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';
import { STATUS } from '../lib/requestStatus.js';
import { errorFromResponse, toApiError } from '../lib/api.js';
import ReleaseCalendar from './ReleaseCalendar.jsx';

/** "15:00" -> "3:00 PM". Staff read a clock, not a 24-hour timestamp. */
function formatClock(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const LOGIN_PATH = STAFF_LOGIN_PATH;

// Today's pickup rows read in claim terms rather than lifecycle terms:
// at the counter the only question is whether the person has turned up yet.
const RELEASE_ROW_PILL = {
  [STATUS.PROCESSING]: { label: 'Still being prepared', className: 'ts-pill-processing' },
  [STATUS.READY]: { label: 'Not collected yet', className: 'ts-pill-blue' },
  [STATUS.RELEASED]: { label: 'Collected', className: 'ts-pill-ready' },
};

function formatRelativeTime(iso) {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function todayLong() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function RegistrarDashboardPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [summary, setSummary] = useState(null);
  const [recentSubmissions, setRecentSubmissions] = useState(null);
  const [todaysPickups, setTodaysPickups] = useState(null);
  const [flagged, setFlagged] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [flaggedError, setFlaggedError] = useState(null);
  const [calendarError, setCalendarError] = useState(null);
  const [calendarCounts, setCalendarCounts] = useState({});
  const [calendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // The mini calendar loads on its own for the same reason the fraud alert
  // does: a slow or failed month shouldn't hold up the rest of the dashboard.
  const loadCalendar = useCallback(async () => {
    setCalendarError(null);
    try {
      const res = await authFetch(
        `/api/registrar/release-calendar/?year=${calendarMonth.year}&month=${calendarMonth.month + 1}`,
      );
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setCalendarCounts(Object.fromEntries((data.days || []).map((d) => [d.date, d.count])));
    } catch (error) {
      // The grid still draws, but blank days would read as "no pickups", so
      // say plainly that the numbers didn't load.
      setCalendarError(toApiError(error));
    }
  }, [calendarMonth]);

  // The fraud alert loads on its own, so a failure here can't take the rest
  // of the dashboard down with it - and a failure the other way round can't
  // hide a flag. Staff-only: the endpoint is IsApprovedRegistrarStaff, and
  // duplicate_flag appears on no student-facing serializer.
  const loadFlagged = useCallback(async () => {
    setFlaggedError(null);
    try {
      const res = await authFetch('/api/registrar/dashboard/flagged/');
      if (!res.ok) throw await errorFromResponse(res);
      setFlagged(await res.json());
    } catch (error) {
      // Never silent: no banner must mean "nothing flagged", not "couldn't check".
      setFlaggedError(toApiError(error));
    }
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [meRes, summaryRes, recentRes, pickupsRes] = await Promise.all([
        authFetch('/api/me/'),
        authFetch('/api/registrar/dashboard/summary/'),
        authFetch('/api/registrar/dashboard/recent-submissions/'),
        authFetch('/api/registrar/dashboard/todays-pickups/'),
      ]);

      // A 403 means a non-staff (or not-yet-approved) account reached a
      // registrar-only endpoint; the API is the real gate, and ErrorState
      // says so plainly instead of drawing a half-empty dashboard.
      const failed = [meRes, summaryRes, recentRes, pickupsRes].find((r) => !r.ok);
      if (failed) throw await errorFromResponse(failed);

      const [meData, summaryData, recentData, pickupsData] = await Promise.all([
        meRes.json(),
        summaryRes.json(),
        recentRes.json(),
        pickupsRes.json(),
      ]);

      setMe(meData);
      setSummary(summaryData);
      setRecentSubmissions(recentData);
      setTodaysPickups(pickupsData);
      setStatus('ready');
    } catch (error) {
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    load();
    loadFlagged();
    loadCalendar();
  }, [load, loadFlagged, loadCalendar]);

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  const profile = me?.profile;

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <RegistrarSidebar active="dashboard" onLogout={handleLogout} me={me} />
      <RegistrarMobileHeader active="dashboard" onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        {/* Greeting */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {status === 'loading' && !me ? (
              <>
                <div className="ts-skeleton h-8 w-72" />
                <div className="ts-skeleton mt-2 h-4 w-80" />
              </>
            ) : (
              <>
                <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
                  {greetingForNow()}{me?.first_name ? `, ${me.first_name}` : ''}!
                </h1>
                <p className="ts-soft mt-1.5 text-base">
                  Here&rsquo;s what&rsquo;s happening at Window {profile?.assigned_window || '6'} today.
                </p>
              </>
            )}
          </div>
          <span className="ts-date-badge shrink-0">{todayLong()}</span>
        </div>

        {flaggedError && (
          <ErrorState
            inline
            className="mb-8"
            error={flaggedError}
            title="We couldn&rsquo;t check for flagged requests"
            message="Possible duplicates may not be shown until this loads."
            onRetry={loadFlagged}
          />
        )}

        {flagged.length > 0 && (
          <div role="alert" className="ts-warning-card mb-8 p-5">
            <div className="flex items-center gap-2">
              <WarningIcon />
              <h2 className="text-base font-semibold">
                {flagged.length === 1
                  ? '1 request flagged as a possible duplicate'
                  : `${flagged.length} requests flagged as possible duplicates`}
              </h2>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed">
              These may reuse another request&rsquo;s tracking number. Check each one before taking any action on
              it. The student isn&rsquo;t shown this flag.
            </p>
            <ul className="mt-3 space-y-2">
              {flagged.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="min-w-0">
                    <strong>{f.request_code}</strong> &middot; {f.student_name} &middot; {f.transaction_type}
                  </span>
                  <a href={`/registrar/queue/${f.id}`} className="ts-link shrink-0 font-semibold">
                    Review
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* When the dashboard fails to load, the counts and lists are replaced
            by one error state: zeros here would tell staff there's no work. */}
        {status === 'error' && (
          <ErrorState error={loadError} title="We couldn&rsquo;t load the dashboard" onRetry={load} />
        )}

        {/* Stat cards */}
        {status !== 'error' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {status === 'loading' ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <div className="ts-card ts-card-hoverable p-5">
                <span className="ts-tag ts-tag-gold">To do</span>
                <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.pending_review_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">Waiting for your review</p>
              </div>

              <div className="ts-card ts-card-hoverable p-5">
                <span className="ts-tag ts-tag-sage">Done</span>
                <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.verified_today_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">Approved today</p>
              </div>

              <div className="ts-card ts-card-hoverable p-5">
                <span className="ts-tag">Pickups</span>
                <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.for_release_today_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">To be collected today</p>
              </div>

              <div className="ts-card ts-card-hoverable p-5">
                <span className="ts-tag ts-tag-muted">This week</span>
                <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.completed_this_week_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">Handed over this week</p>
              </div>
            </>
          )}
        </div>
        )}

        {/* Recent Submissions + Today's Release Slots */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {status !== 'error' && (
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>
                Newest requests
              </h2>
              <a href="/registrar/queue" className="ts-link text-sm font-medium">
                See all requests
              </a>
            </div>

            <div className="ts-card mt-4 overflow-hidden">
              {status === 'loading' && (
                <SkeletonGroup label="Loading the newest requests">
                  <ListRowSkeleton />
                  <div className="ts-row-divider" />
                  <ListRowSkeleton />
                  <div className="ts-row-divider" />
                  <ListRowSkeleton />
                </SkeletonGroup>
              )}

              {status === 'ready' && recentSubmissions?.length === 0 && (
                <EmptyState
                  boxed={false}
                  icon={InboxIcon}
                  title="No pending reviews right now"
                  message="New submissions will appear here as students send them."
                />
              )}

              {status === 'ready' && recentSubmissions && recentSubmissions.length > 0 && (
                <ul>
                  {recentSubmissions.map((r) => (
                    <li
                      key={r.id}
                      className="ts-row-hover ts-row-divider flex items-center gap-3 px-5 py-4"
                    >
                      <Avatar
                        className="ts-avatar-sm"
                        src={r.student_profile_picture_url}
                        user={{ first_name: r.student_first_name, last_name: r.student_last_name }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="ts-ink truncate text-sm font-medium">
                          {r.student_first_name} {r.student_last_name}
                        </p>
                        <p className="ts-soft mt-0.5 truncate text-xs">
                          {r.request_code} · {r.transaction_type} · {formatRelativeTime(r.created_at)}
                        </p>
                      </div>
                      {/* Opens this request, not the list it came from. */}
                      <a
                        href={`/registrar/queue/${r.id}`}
                        className="ts-btn-primary shrink-0 px-5 py-2.5 text-sm font-medium"
                      >
                        Review
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          )}

          <div className="lg:col-span-2">
            {/* The month around today, so "today's pickups" below has
                context. Picking a day opens it on the full calendar. */}
            <div className="flex items-center justify-between">
              <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>
                Release calendar
              </h2>
              <a href="/registrar/calendar" className="ts-link text-sm font-medium">
                View full calendar
              </a>
            </div>
            <div className="ts-card mt-4 p-4">
              <ReleaseCalendar
                size="mini"
                year={calendarMonth.year}
                month={calendarMonth.month}
                counts={calendarCounts}
                onSelect={(iso) => {
                  window.location.href = `/registrar/calendar?date=${iso}`;
                }}
              />
              {calendarError && (
                <ErrorState
                  inline
                  className="mt-3"
                  error={calendarError}
                  title="Pickup counts didn&rsquo;t load"
                  message="Days may look empty."
                  onRetry={loadCalendar}
                />
              )}
            </div>

            {status !== 'error' && (
            <>
            <div className="mt-8 flex items-center justify-between">
              <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>
                Today&rsquo;s pickups
              </h2>
              <a href="/registrar/released" className="ts-link text-sm font-medium">
                See released
              </a>
            </div>

            <div className="ts-card mt-4 overflow-hidden">
              {status === 'loading' && (
                <SkeletonGroup label="Loading today's pickups">
                  <ListRowSkeleton avatar={false} />
                  <div className="ts-row-divider" />
                  <ListRowSkeleton avatar={false} />
                </SkeletonGroup>
              )}

              {status === 'ready' && todaysPickups?.length === 0 && (
                <EmptyState
                  boxed={false}
                  icon={InboxIcon}
                  title="No pickups today"
                  message="Documents you mark ready show up here on their pickup date."
                />
              )}

              {status === 'ready' && todaysPickups && todaysPickups.length > 0 && (
                <ul>
                  {todaysPickups.map((r) => {
                    const pill = RELEASE_ROW_PILL[r.request_status] || {
                      label: r.request_status,
                      className: 'ts-pill-released',
                    };
                    return (
                      <li
                        key={r.id}
                        className="ts-row-hover ts-row-divider flex items-center justify-between gap-3 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="ts-ink text-sm font-medium">
                            {r.student_first_name} {r.student_last_name}
                          </p>
                          <p className="ts-soft mt-0.5 truncate text-sm">
                            {r.transaction_type}
                            {formatClock(r.start_time) ? ` · from ${formatClock(r.start_time)}` : ''}
                          </p>
                        </div>
                        <span className={`ts-pill ${pill.className} shrink-0`}>{pill.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
