import { useCallback, useEffect, useState } from 'react';
import { BellIcon, ChevronIcon, FONT_SERIF } from './trailsyncUI.jsx';
import StudentShell, { markNotificationRead, notificationHref, timeAgo, useStudentShell } from './StudentShell.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';

function RowSkeleton() {
  return (
    <div className="flex gap-3 px-5 py-5">
      <div className="ts-skeleton mt-1.5 h-2 w-2 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="ts-skeleton h-4 w-48" />
        <div className="ts-skeleton h-4 w-full" />
        <div className="ts-skeleton h-3 w-24" />
      </div>
    </div>
  );
}

/**
 * The body lives in its own component so it can reach the shell's context:
 * marking things read here has to drop the number on the bell in the top bar
 * of this same screen, not only on the next page load.
 */
function NotificationsBody() {
  const { unreadCount, setUnreadCount } = useStudentShell();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [items, setItems] = useState([]);
  const [order, setOrder] = useState('newest');
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ count: 0, start: 0, end: 0, next: null, previous: null });

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (order === 'oldest') params.set('order', 'oldest');
      const res = await authFetch(`/api/notifications/?${params}`);
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setItems(data.results || []);
      setPageInfo({ count: data.count, start: data.start, end: data.end, next: data.next, previous: data.previous });
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page, order]);

  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    const res = await authFetch('/api/notifications/mark-all-read/', { method: 'POST' }).catch(() => null);
    if (res?.ok) {
      setUnreadCount(0);
      setItems((list) => list.map((n) => ({ ...n, is_read: true })));
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
        <div className="ts-banner ts-banner-error mt-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span>We couldn&rsquo;t load your notifications. Please check your connection.</span>
          <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
            Try again
          </button>
        </div>
      )}

      <div className="ts-card mt-5 overflow-hidden">
        {status === 'loading' && (
          <>
            <RowSkeleton />
            <div className="ts-row-divider" />
            <RowSkeleton />
          </>
        )}

        {status === 'ready' && items.length === 0 && (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="ts-soft">
              <BellIcon />
            </span>
            <p className="ts-ink mt-4 text-base font-semibold">No notifications yet</p>
            <p className="ts-soft mt-1.5 max-w-sm text-sm">
              When the Registrar moves one of your requests forward, a message will appear here &mdash; and on the bell at
              the top of every page.
            </p>
            <a href="/request-form" className="ts-btn-primary mt-6 inline-flex px-6 py-2.5 text-sm font-medium">
              Request a document
            </a>
          </div>
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
    <StudentShell active="notifications" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <NotificationsBody />
    </StudentShell>
  );
}
