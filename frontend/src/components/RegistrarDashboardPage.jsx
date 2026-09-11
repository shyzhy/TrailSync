import { useCallback, useEffect, useState } from 'react';
import {
  APP_CSS,
  FONT_SANS,
  FONT_SERIF,
  RegistrarMobileHeader,
  RegistrarSidebar,
  greetingForNow,
  Avatar,
  InboxIcon,
} from './trailsyncUI.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';
import { STATUS } from '../lib/requestStatus.js';

const LOGIN_PATH = '/';

// Today's release rows read in claim terms rather than lifecycle terms:
// at a release window the only question is whether the person has turned up
// yet, so Ready reads as "Waiting" and Released as "Claimed".
const RELEASE_ROW_PILL = {
  [STATUS.PROCESSING]: { label: 'Processing', className: 'ts-pill-processing' },
  [STATUS.READY]: { label: 'Waiting', className: 'ts-pill-blue' },
  [STATUS.RELEASED]: { label: 'Claimed', className: 'ts-pill-ready' },
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

function StatSkeleton() {
  return (
    <div className="ts-card p-5">
      <div className="ts-skeleton h-4 w-24" />
      <div className="ts-skeleton mt-4 h-7 w-14" />
      <div className="ts-skeleton mt-2 h-3.5 w-28" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="ts-skeleton h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="ts-skeleton h-3.5 w-32" />
        <div className="ts-skeleton h-3 w-24" />
      </div>
    </div>
  );
}

export default function RegistrarDashboardPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [summary, setSummary] = useState(null);
  const [recentSubmissions, setRecentSubmissions] = useState(null);
  const [releaseSlots, setReleaseSlots] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [meRes, summaryRes, recentRes, slotsRes] = await Promise.all([
        authFetch('/api/me/'),
        authFetch('/api/registrar/dashboard/summary/'),
        authFetch('/api/registrar/dashboard/recent-submissions/'),
        authFetch('/api/registrar/dashboard/todays-release-slots/'),
      ]);

      if ([meRes, summaryRes, recentRes, slotsRes].some((r) => r.status === 401)) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      // 403 here means an authenticated-but-non-staff (or not-yet-approved)
      // token hit a registrar-only endpoint — the API is the real gate;
      // this just gives a clear message instead of a half-rendered page.
      if ([meRes, summaryRes, recentRes, slotsRes].some((r) => r.status === 403)) {
        throw new Error('forbidden');
      }
      if (!meRes.ok || !summaryRes.ok || !recentRes.ok || !slotsRes.ok) {
        throw new Error('One or more requests failed.');
      }

      const [meData, summaryData, recentData, slotsData] = await Promise.all([
        meRes.json(),
        summaryRes.json(),
        recentRes.json(),
        slotsRes.json(),
      ]);

      setMe(meData);
      setSummary(summaryData);
      setRecentSubmissions(recentData);
      setReleaseSlots(slotsData);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
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

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <RegistrarSidebar active="dashboard" onLogout={handleLogout} me={me} />
      <RegistrarMobileHeader onLogout={handleLogout} />

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
                <p className="ts-soft mt-1.5 text-sm">
                  Here's the registrar queue activity for Window {profile?.assigned_window || '6'} today.
                </p>
              </>
            )}
          </div>
          <span className="ts-date-badge shrink-0">{todayLong()}</span>
        </div>

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mb-8 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>Something went wrong loading the dashboard.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {status === 'loading' ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <div className="ts-card ts-card-hoverable p-5">
                <span className="ts-tag ts-tag-gold">Pending</span>
                <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.pending_review_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">Pending Review</p>
              </div>

              <div className="ts-card ts-card-hoverable p-5">
                <span className="ts-tag ts-tag-sage">Approved</span>
                <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.verified_today_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">Approved Today</p>
              </div>

              <div className="ts-card ts-card-hoverable p-5">
                <span className="ts-tag">For Release</span>
                <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.for_release_today_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">For Release Today</p>
              </div>

              <div className="ts-card ts-card-hoverable p-5">
                <span className="ts-tag ts-tag-muted">Completed</span>
                <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.completed_this_week_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">Completed This Week</p>
              </div>
            </>
          )}
        </div>

        {/* Recent Submissions + Today's Release Slots */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>
                Recent Submissions
              </h2>
              <a href="/registrar/queue" className="ts-link text-sm font-medium">
                View Queue
              </a>
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

              {status === 'ready' && recentSubmissions?.length === 0 && (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <InboxIcon />
                  <p className="ts-soft mt-4 text-sm">No pending reviews right now.</p>
                </div>
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
                      <a
                        href="/registrar/queue"
                        className="ts-btn-primary shrink-0 px-4 py-1.5 text-xs font-medium"
                      >
                        Review
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {status === 'error' && (
                <div className="px-5 py-8 text-center">
                  <p className="ts-soft text-sm">Recent submissions couldn't be loaded.</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>
                Today's Release Slots
              </h2>
              <a href="/registrar/release-slots" className="ts-link text-sm font-medium">
                Manage Slots
              </a>
            </div>

            <div className="ts-card mt-4 overflow-hidden">
              {status === 'loading' && (
                <>
                  <RowSkeleton />
                  <div className="ts-row-divider" />
                  <RowSkeleton />
                </>
              )}

              {status === 'ready' && releaseSlots?.length === 0 && (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <InboxIcon />
                  <p className="ts-soft mt-4 text-sm">No releases scheduled today.</p>
                </div>
              )}

              {status === 'ready' && releaseSlots && releaseSlots.length > 0 && (
                <ul>
                  {releaseSlots.map((r) => {
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
                          <p className="ts-ink text-sm font-medium">{r.start_time}</p>
                          <p className="ts-soft mt-0.5 truncate text-xs">
                            {r.student_first_name} {r.student_last_name} · {r.transaction_type}
                          </p>
                        </div>
                        <span className={`ts-pill ${pill.className} shrink-0`}>{pill.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {status === 'error' && (
                <div className="px-5 py-8 text-center">
                  <p className="ts-soft text-sm">Today's release slots couldn't be loaded.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
