import { useCallback, useEffect, useState } from 'react';
import { BellIcon, ChevronIcon, EmptyState, ErrorState, FONT_SERIF, ListRowSkeleton, SkeletonGroup } from './trailsyncUI.jsx';
import StudentShell, { markNotificationRead, notificationHref, timeAgo, useStudentShell } from './StudentShell.jsx';
import { STUDENT_LOGIN_PATH, authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';
import { errorFromResponse, toApiError } from '../lib/api.js';

const LOGIN_PATH = STUDENT_LOGIN_PATH;

/**
 * The body lives in its own component so it can reach the shell's context:
 * marking things read here has to drop the number on the bell in the top bar
 * of this same screen, not only on the next page load.
 */
function NotificationsBody() {
  const { unreadCount, setUnreadCount, notify } = useStudentShell();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [items, setItems] = useState([]);
  const [order, setOrder] = useState('newest');
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, start: 0, end: 0, next: null, previous: null });
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (order === 'oldest') params.set('order', 'oldest');
      const res = await authFetch(`/api/notifications/?${params}`);
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setItems(data.results || []);
      setPageInfo({ count: data.count, start: data.start, end: data.end, next: data.next, previous: data.previous });
      setStatus('ready');
    } catch (error) {
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, [page, order]);

  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    try {
      const res = await authFetch('/api/notifications/mark-all-read/', { method: 'POST' });
      if (!res.ok) throw await errorFromResponse(res);
      setUnreadCount(0);
      setItems((list) => list.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      notify(toApiError(error).message, 'error');
    }
  };

  const open = (n) => {
    if (!n.is_read) {
      markNotificationRead(n.id);
      setUnreadCount(Math.max(0, unreadCount - 1));
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-6 sm:py-8 lg:px-10">
      <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
        Notifications
      </h1>
      <p className="ts-soft mt-1.5 text-base">
        Updates from the Registrar about your requests. Tap one to see that request.
      </p>

      {status === 'ready' && pageInfo.count > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <label htmlFor="notifOrder" className="sr-only">
              Sort notifications
            </label>
            <select
              id="notifOrder"
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                setPage(1);
              }}
              className="ts-input ts-select py-2.5 pl-3.5 pr-9 text-sm"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <ChevronIcon />
            </span>
          </div>
          {/* Deliberately quiet: this screen is for reading, so nothing on it
              should shout louder than the notifications themselves. */}
          {unreadCount > 0 && (
            <button type="button" onClick={markAll} className="ts-btn-glass px-4 py-2 text-sm font-medium">
              Mark all as read
            </button>
          )}
        </div>
      )}

      {status === 'error' && (
        <ErrorState className="mt-6" error={loadError} title="We couldn&rsquo;t load your notifications" onRetry={load} />
      )}

      {status !== 'error' && (
      <div className="ts-card mt-5 overflow-hidden">
        {status === 'loading' && (
          <SkeletonGroup label="Loading your notifications">
            <ListRowSkeleton avatar={false} />
            <div className="ts-row-divider" />
            <ListRowSkeleton avatar={false} />
            <div className="ts-row-divider" />
            <ListRowSkeleton avatar={false} />
          </SkeletonGroup>
        )}

        {status === 'ready' && items.length === 0 && (
          <EmptyState
            boxed={false}
            icon={BellIcon}
            title="You&rsquo;re all caught up"
            message="New updates about your requests will show up here, and on the bell at the top of every page."
            action={
              <a href="/request-form" className="ts-btn-primary inline-flex px-6 py-2.5 text-sm font-medium">
                Request a document
              </a>
            }
          />
        )}

        {status === 'ready' &&
          items.map((n) => (
            <a
              key={n.id}
              href={notificationHref(n)}
              onClick={() => open(n)}
              className="ts-row-hover ts-row-divider flex gap-3 px-5 py-5"
            >
              <span className={n.is_read ? 'ts-read-dot' : 'ts-unread-dot'} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className={`text-base ${n.is_read ? 'ts-soft' : 'ts-ink font-semibold'}`}>
                    {!n.is_read && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </span>
                  <span className="ts-soft text-sm">{timeAgo(n.created_at)}</span>
                </span>
                <span className="ts-soft mt-1 block text-sm leading-relaxed">{n.message}</span>
                {n.request_code && <span className="ts-link mt-2 inline-block text-sm font-medium">View request &rarr;</span>}
              </span>
            </a>
          ))}
      </div>
      )}

      {status === 'ready' && pageInfo.count > 0 && (pageInfo.next || pageInfo.previous) && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="ts-soft text-sm">
            Showing {pageInfo.start}&ndash;{pageInfo.end} of {pageInfo.count}
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={!pageInfo.previous} onClick={() => setPage((p) => p - 1)} className="ts-btn-glass px-4 py-2 text-sm font-medium">
              Previous
            </button>
            <button type="button" disabled={!pageInfo.next} onClick={() => setPage((p) => p + 1)} className="ts-btn-glass px-4 py-2 text-sm font-medium">
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function NotificationsPage() {
  const [me, setMe] = useState(() => getStoredUser());

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

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  return (
    <StudentShell active="notifications" title="Notifications" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <NotificationsBody />
    </StudentShell>
  );
}
