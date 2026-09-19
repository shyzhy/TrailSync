import { useCallback, useEffect, useState } from 'react';
import StudentShell from '../../components/layout/StudentShell.jsx';
import {
  ArchiveIcon,
  BellIcon,
  BookIcon,
  DocumentIcon,
  EmptyState,
  ErrorState,
  ListRowSkeleton,
  PlusCircleIcon,
  SearchIcon,
  SkeletonGroup,
  StatCardSkeleton,
  TicketIcon,
} from '../../components/ui/index.js';
import MiniCalendar from '../../components/student/MiniCalendar.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';
import { academicStatusLine } from '../../lib/academics.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import {
  authFetch,
  clearSession,
  getAccessToken,
  getStoredUser,
  STUDENT_LOGIN_PATH,
} from '../../lib/auth.js';
import { greetingForNow } from '../../lib/greeting.js';
import { LIFECYCLE, STATUS, statusPillClass, studentStatusLabel } from '../../lib/requestStatus.js';

const LOGIN_PATH = STUDENT_LOGIN_PATH;

// Student-facing wording per stage; "Ready to Print" (go pay) and "Processing" (office has your payment) must stay distinct.
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

export default function StudentDashboard() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState(null);
  const [upcomingReleaseDates, setUpcomingReleaseDates] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);

    // Best-effort: the calendar dots are a nice-to-have, so a failure just means no dots.
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

      // An expired session never gets this far: authFetch sends it to log in.
      const failed = [meRes, summaryRes, recentRes].find((r) => !r.ok);
      if (failed) throw await errorFromResponse(failed);

      const [meData, summaryData, recentData] = await Promise.all([
        meRes.json(),
        summaryRes.json(),
        recentRes.json(),
      ]);

      setMe(meData);
      setSummary(summaryData);
      setRecent(recentData);
      setStatus('ready');
    } catch (error) {
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // No token at all: nothing to fetch.
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
  const subtitleParts = [profile?.course, academicStatusLine(profile?.academic_status)].filter(Boolean);

  return (
    <StudentShell active="home" title="Home" me={me} onLogout={handleLogout} onMeChange={setMe} offerTour={status === 'ready'}>
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

            {/* On failure one error state replaces the numbers and the list: zeros would say "you have no requests". */}
            {status === 'error' && (
              <ErrorState error={loadError} title="We couldn&rsquo;t load your home page" onRetry={load} />
            )}

            {/* Stat cards */}
            {status !== 'error' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {status === 'loading' ? (
                <>
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
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
            )}

            {/* Secondary actions, deliberately quieter than the header button. */}
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
            {status !== 'error' && (
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>Recent requests</h2>
                {recent && recent.length > 0 && (
                  <a href="/track-requests" className="ts-link ts-tap text-sm font-medium">
                    See all
                  </a>
                )}
              </div>

              <div className="ts-card mt-4 overflow-hidden">
                {status === 'loading' && (
                  <SkeletonGroup label="Loading your recent requests">
                    <ListRowSkeleton avatar={false} />
                    <div className="ts-row-divider" />
                    <ListRowSkeleton avatar={false} />
                    <div className="ts-row-divider" />
                    <ListRowSkeleton avatar={false} />
                  </SkeletonGroup>
                )}

                {status === 'ready' && recent?.length === 0 && (
                  <EmptyState
                    boxed={false}
                    icon={TicketIcon}
                    title="You haven&rsquo;t requested anything yet"
                    message="Your first request takes a few taps, and you can follow it right here afterwards."
                    action={
                      <a href="/request-form" className="ts-btn-primary inline-flex px-6 py-2.5 text-sm font-medium">
                        Request my first document
                      </a>
                    }
                  />
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
              </div>
            </div>
            )}
          </div>

          {/* Right rail: stacks below the main column on narrow screens. */}
          <div className="mt-8 lg:mt-0 lg:w-[300px] lg:flex-none">
            <MiniCalendar highlightDates={upcomingReleaseDates} />
          </div>
        </div>
      </main>
    </StudentShell>
  );
}
