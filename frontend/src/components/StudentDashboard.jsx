import { useCallback, useEffect, useState } from 'react';
import {
  APP_CSS,
  ArchiveIcon,
  BellIcon,
  DocumentIcon,
  FONT_SANS,
  FONT_SERIF,
  InboxIcon,
  PlusCircleIcon,
  SearchIcon,
} from './trailsyncUI.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';

// request_status -> the pill label/color the spec defines. Submitted and
// Verified are both still in the registrar's hands, so both read as
// "Processing" to the student — the underlying value is what the summary
// endpoint's active_requests_count already buckets the same way.
const STATUS_PILL = {
  Submitted: { label: 'Processing', className: 'ts-pill-processing' },
  Verified: { label: 'Processing', className: 'ts-pill-processing' },
  Ready: { label: 'Ready for pickup', className: 'ts-pill-ready' },
  Released: { label: 'Released', className: 'ts-pill-released' },
};

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

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

  const load = useCallback(async () => {
    setStatus('loading');
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
    <div className="ts-app-shell" style={FONT_SANS}>
      <style>{APP_CSS}</style>

      <header className="ts-app-header sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2">
            <img
              src="/trailsync-logo.png"
              alt=""
              aria-hidden="true"
              style={{ height: '34px', width: 'auto', margin: '-7px 0' }}
            />
            <span className="ts-ink text-lg font-semibold" style={FONT_SERIF}>TrailSync</span>
          </div>
          <button type="button" onClick={handleLogout} className="ts-link text-sm font-medium">
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        {/* Greeting */}
        <div className="mb-8">
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

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mb-8 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>Something went wrong loading your dashboard.</span>
            <button type="button" onClick={load} className="ts-link font-medium shrink-0">
              Retry
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
              <div className="ts-card p-5">
                <div className="ts-stat-icon ts-stat-icon-blue">
                  <DocumentIcon />
                </div>
                <p className="ts-ink mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.active_requests_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">Active requests</p>
              </div>

              <div className="ts-card p-5">
                <div className="ts-stat-icon ts-stat-icon-gold">
                  <BellIcon />
                </div>
                <p className="ts-ink mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.ready_for_pickup_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">Ready at Window 6</p>
              </div>

              <div className="ts-card p-5">
                <div className="ts-stat-icon ts-stat-icon-sage">
                  <ArchiveIcon />
                </div>
                <p className="ts-ink mt-4 text-3xl font-semibold" style={FONT_SERIF}>
                  {summary?.released_this_year_count ?? 0}
                </p>
                <p className="ts-soft mt-1 text-sm">Released this year</p>
              </div>
            </>
          )}
        </div>

        {/* Quick actions — placeholders; wired up in a later step */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button type="button" className="ts-quick-card flex items-center gap-4 p-5 text-left">
            <div className="ts-stat-icon ts-stat-icon-blue shrink-0">
              <PlusCircleIcon />
            </div>
            <div>
              <p className="ts-ink text-sm font-semibold">Request a form</p>
              <p className="ts-soft mt-0.5 text-xs">Start a new document request</p>
            </div>
          </button>

          <button type="button" className="ts-quick-card flex items-center gap-4 p-5 text-left">
            <div className="ts-stat-icon ts-stat-icon-blue shrink-0">
              <SearchIcon />
            </div>
            <div>
              <p className="ts-ink text-sm font-semibold">Track requests</p>
              <p className="ts-soft mt-0.5 text-xs">See the full status of every request</p>
            </div>
          </button>
        </div>

        {/* Recent requests */}
        <div className="mt-8">
          <h2 className="ts-ink text-lg font-semibold" style={FONT_SERIF}>Recent requests</h2>

          <div className="ts-card mt-4 divide-y overflow-hidden" style={{ borderColor: '#E3DFD2' }}>
            {status === 'loading' && (
              <>
                <RowSkeleton />
                <div className="ts-hairline h-px" />
                <RowSkeleton />
                <div className="ts-hairline h-px" />
                <RowSkeleton />
              </>
            )}

            {status === 'ready' && recent?.length === 0 && (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <InboxIcon />
                <p className="ts-soft mt-4 text-sm">
                  You haven't made any requests yet — get started below.
                </p>
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
                    <li
                      key={r.request_code}
                      className="ts-row-hover flex items-center justify-between gap-4 border-t px-5 py-4 first:border-t-0"
                      style={{ borderColor: '#E3DFD2' }}
                    >
                      <div className="min-w-0">
                        <p className="ts-ink truncate text-sm font-medium">{r.transaction_type}</p>
                        <p className="ts-soft mt-0.5 text-xs">
                          {r.request_code} · {formatDate(r.created_at)}
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
                <p className="ts-soft text-sm">Recent requests couldn't be loaded.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
