import { useCallback, useEffect, useState } from 'react';
import AdminShell from '../../components/layout/AdminShell.jsx';
import {
  ArchiveIcon,
  DocumentIcon,
  EmptyState,
  ErrorState,
  GraduationCapIcon,
  InboxIcon,
  ListRowSkeleton,
  SkeletonGroup,
  StatCardSkeleton,
  UserPlusIcon,
  UsersIcon,
} from '../../components/ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import { ADMIN_LOGIN_PATH, authFetch, clearSession, getAccessToken, getStoredUser } from '../../lib/auth.js';
import { greetingForNow } from '../../lib/greeting.js';
import { timeAgo } from '../../lib/notifications.js';

function todayLong() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function StatCard({ Icon, value, label }) {
  return (
    <div className="ts-card ts-card-hoverable p-5">
      <div className="ts-stat-icon ts-stat-icon-plum">
        <Icon />
      </div>
      <p className="ts-stat-number mt-4 text-3xl font-semibold" style={FONT_SERIF}>
        {value}
      </p>
      <p className="ts-soft mt-1 text-sm">{label}</p>
    </div>
  );
}

// /admin/dashboard: system-wide counts and a short feed of recent sign-ups and staff approvals.
export default function AdminDashboardPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [summary, setSummary] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activity, setActivity] = useState(null);
  const [activityError, setActivityError] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [meRes, summaryRes] = await Promise.all([authFetch('/api/me/'), authFetch('/api/admin/dashboard/summary/')]);
      const failed = [meRes, summaryRes].find((r) => !r.ok);
      if (failed) throw await errorFromResponse(failed);
      const [meData, summaryData] = await Promise.all([meRes.json(), summaryRes.json()]);
      setMe(meData);
      setSummary(summaryData);
      setStatus('ready');
    } catch (error) {
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, []);

  // Loads on its own, so a failed feed never hides the counts.
  const loadActivity = useCallback(async () => {
    setActivityError(null);
    try {
      const res = await authFetch('/api/admin/dashboard/activity/');
      if (!res.ok) throw await errorFromResponse(res);
      setActivity((await res.json()).results || []);
    } catch (error) {
      setActivityError(toApiError(error));
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = ADMIN_LOGIN_PATH;
      return;
    }
    load();
    loadActivity();
  }, [load, loadActivity]);

  const handleLogout = () => {
    clearSession();
    window.location.href = ADMIN_LOGIN_PATH;
  };

  return (
    <AdminShell active="dashboard" me={me} onLogout={handleLogout}>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              {greetingForNow()}
              {me?.first_name ? `, ${me.first_name}` : ''}!
            </h1>
            <p className="ts-soft mt-1.5 text-base">Here&rsquo;s all of TrailSync at a glance.</p>
          </div>
          <span className="ts-date-badge shrink-0">{todayLong()}</span>
        </div>

        {status === 'error' && (
          <ErrorState error={loadError} title="We couldn&rsquo;t load the dashboard" onRetry={load} />
        )}

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
                <StatCard Icon={GraduationCapIcon} value={summary.students_count} label="Total students" />
                <StatCard Icon={ArchiveIcon} value={summary.alumni_count} label="Total alumni" />
                <StatCard Icon={UsersIcon} value={summary.staff_count} label="Total registrar staff" />
                <StatCard
                  Icon={DocumentIcon}
                  value={summary.requests_this_month_count}
                  label={`Requests in ${summary.month_label}`}
                />
              </>
            )}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2" aria-labelledby="activity-heading">
            <div className="flex items-center justify-between">
              <h2 id="activity-heading" className="ts-ink text-lg font-semibold" style={FONT_SERIF}>
                Recent activity
              </h2>
              <a href="/admin/accounts" className="ts-link text-sm font-medium">
                All accounts
              </a>
            </div>

            <div className="ts-card mt-4 overflow-hidden">
              {activityError && (
                <div className="p-4">
                  <ErrorState inline error={activityError} title="Recent activity didn&rsquo;t load" onRetry={loadActivity} />
                </div>
              )}

              {!activityError && activity === null && (
                <SkeletonGroup label="Loading recent activity">
                  <ListRowSkeleton avatar={false} />
                  <div className="ts-row-divider" />
                  <ListRowSkeleton avatar={false} />
                  <div className="ts-row-divider" />
                  <ListRowSkeleton avatar={false} />
                </SkeletonGroup>
              )}

              {!activityError && activity?.length === 0 && (
                <EmptyState
                  boxed={false}
                  icon={InboxIcon}
                  title="Nothing to show yet"
                  message="New sign-ups and staff approvals will appear here."
                />
              )}

              {!activityError && activity?.length > 0 && (
                <ul>
                  {activity.map((item) => (
                    <li key={`${item.kind}-${item.account_id}-${item.at}`} className="ts-row-divider">
                      <a href={`/admin/accounts?view=${item.account_id}`} className="ts-row-hover flex gap-3 px-5 py-4">
                        <span
                          className={`ts-activity-dot ${item.kind === 'staff_approved' ? 'ts-activity-dot-staff' : ''}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="ts-ink block text-sm font-medium">{item.title}</span>
                          {item.detail && <span className="ts-soft mt-0.5 block text-sm">{item.detail}</span>}
                        </span>
                        <span className="ts-soft shrink-0 text-sm">{timeAgo(item.at)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="ts-ink text-lg font-semibold" style={FONT_SERIF}>
              Quick actions
            </h2>
            <div className="mt-4 space-y-3">
              <a href="/admin/accounts?add=1" className="ts-quick-card flex items-center gap-4 p-5 text-left">
                <div className="ts-stat-icon ts-stat-icon-plum shrink-0">
                  <UserPlusIcon />
                </div>
                <div>
                  <p className="ts-ink text-sm font-semibold">Add a registrar account</p>
                  <p className="ts-soft mt-0.5 text-sm">They&rsquo;ll get an email to set their own password</p>
                </div>
              </a>
              <a href="/admin/accounts" className="ts-quick-card flex items-center gap-4 p-5 text-left">
                <div className="ts-stat-icon ts-stat-icon-plum shrink-0">
                  <UsersIcon />
                </div>
                <div>
                  <p className="ts-ink text-sm font-semibold">Manage accounts</p>
                  <p className="ts-soft mt-0.5 text-sm">Find an account, view details, suspend or reactivate</p>
                </div>
              </a>
            </div>
          </section>
        </div>
      </main>
    </AdminShell>
  );
}
