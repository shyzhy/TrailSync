import { useCallback, useEffect, useState } from 'react';
import {
  ArchiveIcon,
  BellIcon,
  BookIcon,
  DocumentIcon,
  FONT_SERIF,
  greetingForNow,
  InboxIcon,
  PlusCircleIcon,
  SearchIcon,
} from './trailsyncUI.jsx';
import StudentShell from './StudentShell.jsx';
import MiniCalendar from './MiniCalendar.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';
import { LIFECYCLE, STATUS, statusPillClass, studentStatusLabel } from '../lib/requestStatus.js';

const LOGIN_PATH = '/';

// Student-facing wording for each stage, from the shared lifecycle. The
// stages are no longer collapsed: "Ready to Print" is an instruction to the
// student (go pay) and "Processing" means the office has their money and is
// working on it — telling them apart is the whole point of the new stage.
const STATUS_PILL = Object.fromEntries(
  [...LIFECYCLE, STATUS.REJECTED].map((value) => [
    value,
    { label: studentStatusLabel(value), className: statusPillClass(value) },
  ]),
);

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function StatSkeleton() {
  return (
    <div className="ts-card p-5">
      <div className="ts-skeleton h-10 w-10" />
      <div className="ts-skeleton mt-4 h-7 w-14" />
      <div className="ts-skeleton mt-2 h-3.5 w-28" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="ts-skeleton h-4 w-40" />
        <div className="ts-skeleton mt-2 h-3 w-24" />
      </div>
      <div className="ts-skeleton h-6 w-24 shrink-0 rounded-full" />
    </div>
  );
}

export default function StudentDashboard() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState(null);
  const [upcomingReleaseDates, setUpcomingReleaseDates] = useState([]);

  const load = useCallback(async () => {
    setStatus('loading');

    // Best-effort, off to the side: the calendar's "coming up" dots are a
    // nice-to-have, not core dashboard data, so a missing/failing endpoint
    // (e.g. before Part 3's release-slot backend exists) just means no dots
    // rather than an error state for the whole page.
    authFetch('/api/dashboard/upcoming-release-dates/')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUpcomingReleaseDates(Array.isArray(data?.dates) ? data.dates : []))
      .catch(() => {});

    try {
      const [meRes, summaryRes, recentRes] = await Promise.all([
        authFetch('/api/me/'),
        authFetch('/api/dashboard/summary/'),
        authFetch('/api/dashboard/recent-requests/'),
      ]);

      // A stale/expired token means none of these three can be trusted —
      // send the student back to log in rather than render half a dashboard.
      if ([meRes, summaryRes, recentRes].some((r) => r.status === 401)) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (!meRes.ok || !summaryRes.ok || !recentRes.ok) {
        throw new Error('One or more dashboard requests failed.');
      }

      const [meData, summaryData, recentData] = await Promise.all([
        meRes.json(),
        summaryRes.json(),
        recentRes.json(),
      ]);

      setMe(meData);
      setSummary(summaryData);
      setRecent(recentData);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // No token at all: nothing to fetch, no point rendering a spinner first.
    if (!getAccessToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    load();
  }, [load]);

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  const profile = me?.profile;
  const subtitleParts = [profile?.course, profile?.user_category === 'Student' ? profile?.year_level : null].filter(
    Boolean
  );

  return (
    <StudentShell active="home" me={me} onLogout={handleLogout} onMeChange={setMe} offerTour={status === 'ready'}>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
        <div className="lg:flex lg:items-start lg:gap-8">
          <div className="min-w-0 flex-1">
            {/* Greeting, with the page's single primary action beside it. */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                {status === 'loading' && !me ? (
                  <>
                    <div className="ts-skeleton h-8 w-64" />
                    <div className="ts-skeleton mt-2 h-4 w-40" />
                  </>
                ) : (
                  <>
                    <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
                      {greetingForNow()}{me?.first_name ? `, ${me.first_name}` : ''}
                    </h1>
                    {subtitleParts.length > 0 && (
                      <p className="ts-soft mt-1.5 text-sm">{subtitleParts.join(' · ')}</p>
                    )}
                  </>
                )}
              </div>
              <a
                href="/request-form"
                className="ts-btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-6 py-3 text-base font-medium"
              >
                <PlusCircleIcon />
                Request a document
              </a>
            </div>

            {status === 'error' && (
              <div className="ts-banner ts-banner-error mb-8 flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span>We couldn&rsquo;t load your home page. Please check your internet connection.</span>
                <button type="button" onClick={load} className="ts-link font-medium shrink-0">
                  Try again
                </button>
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {status === 'loading' ? (
                <>
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                </>
              ) : (
                <>
                  <div className="ts-card ts-card-hoverable p-5">
                    <div className="ts-stat-icon ts-stat-icon-blue">
                      <DocumentIcon />
                    </div>
                    <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                      {summary?.active_requests_count ?? 0}
                    </p>
                    <p className="ts-soft mt-1 text-sm">Active requests</p>
                  </div>

                  <div className="ts-card ts-card-hoverable p-5">
                    <div className="ts-stat-icon ts-stat-icon-gold">
                      <BellIcon />
                    </div>
                    <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                      {summary?.ready_for_pickup_count ?? 0}
                    </p>
                    <p className="ts-soft mt-1 text-sm">Ready at Window 6</p>
                  </div>

                  <div className="ts-card ts-card-hoverable p-5">
                    <div className="ts-stat-icon ts-stat-icon-sage">
                      <ArchiveIcon />
                    </div>
                    <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                      {summary?.released_this_year_count ?? 0}
                    </p>
                    <p className="ts-soft mt-1 text-sm">Picked up this year</p>
                  </div>
                </>
              )}
            </div>

            {/* Secondary actions, deliberately quieter than the header button
                so "Request a document" is where the eye lands. The old third
                card, "Ask TrailSync", was a <button> with no handler at all -
                tapping it did nothing. */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <a href="/track-requests" className="ts-quick-card flex items-center gap-4 p-5 text-left">
                <div className="ts-stat-icon ts-stat-icon-blue shrink-0">
                  <SearchIcon />
                </div>
                <div>
                  <p className="ts-ink text-sm font-semibold">Where is my request?</p>
                  <p className="ts-soft mt-0.5 text-sm">See how far along each one is</p>
                </div>
              </a>

              <a href="/credential-guide" className="ts-quick-card flex items-center gap-4 p-5 text-left">
                <div className="ts-stat-icon ts-stat-icon-gold shrink-0">
                  <BookIcon />
                </div>
                <div>
                  <p className="ts-ink text-sm font-semibold">Which document do I need?</p>
                  <p className="ts-soft mt-0.5 text-sm">What each one is for, and what it costs</p>
                </div>
              </a>
            </div>

            {/* Recent requests */}
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>Recent requests</h2>
                {recent && recent.length > 0 && (
                  <a href="/track-requests" className="ts-link text-sm font-medium">
                    See all
                  </a>
                )}
              </div>

              <div className="ts-card mt-4 overflow-hidden">
                {status === 'loading' && (
                  <>
                    <RowSkeleton />
                    <div className="ts-row-divider" />
                    <RowSkeleton />
                    <div className="ts-row-divider" />
                    <RowSkeleton />
                  </>
                )}

                {status === 'ready' && recent?.length === 0 && (
                  <div className="flex flex-col items-center px-6 py-12 text-center">
                    <InboxIcon />
                    <p className="ts-ink mt-4 text-base font-semibold">No requests yet</p>
                    <p className="ts-soft mt-1.5 max-w-sm text-sm">
                      You haven&rsquo;t requested any documents yet. Tap below to request your first one &mdash; it
                      only takes a few minutes.
                    </p>
                    <a href="/request-form" className="ts-btn-primary mt-5 inline-flex px-6 py-2.5 text-sm font-medium">
                      Request my first document
                    </a>
                  </div>
                )}

                {status === 'ready' && recent && recent.length > 0 && (
                  <ul>
                    {recent.map((r) => {
                      const pill = STATUS_PILL[r.request_status] || {
                        label: r.request_status,
                        className: 'ts-pill-released',
                      };
                      return (
                        <li key={r.request_code} className="ts-row-divider">
                          {/* Looked tappable before but wasn't; opens that request. */}
                          <a
                            href={`/track-requests?search=${encodeURIComponent(r.request_code)}`}
                            className="ts-row-hover flex items-center justify-between gap-4 px-5 py-4"
                          >
                            <div className="min-w-0">
                              <p className="ts-ink truncate text-sm font-medium">{r.transaction_type}</p>
                              <p className="ts-soft mt-0.5 text-xs">
                                {r.request_code} · Requested {formatDate(r.created_at)}
                              </p>
                            </div>
                            <span className={`ts-pill ${pill.className} shrink-0`}>{pill.label}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {status === 'error' && (
                  <div className="px-5 py-8 text-center">
                    <p className="ts-soft text-sm">We couldn&rsquo;t load your recent requests right now.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right rail: at-a-glance calendar. Stacks below the main column on
            narrow viewports instead of sitting beside it. */}
          <div className="mt-8 lg:mt-0 lg:w-[300px] lg:flex-none">
            <MiniCalendar highlightDates={upcomingReleaseDates} />
          </div>
        </div>
      </main>
    </StudentShell>
  );
}
