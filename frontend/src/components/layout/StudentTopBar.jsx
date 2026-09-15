import { useCallback, useEffect, useRef, useState } from 'react';
import { useDismiss } from './useDismiss.js';
import { BellIcon, ErrorState } from '../ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';
import { markNotificationRead, notificationHref, timeAgo } from '../../lib/notifications.js';

function NotificationBell({ unreadCount, setUnreadCount, notify }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(null); // The ApiError, when the list didn't load.
  const [ringing, setRinging] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  // Shake the bell only when the count goes up, and not for the count a page opens with.
  const seenRef = useRef(null);
  useEffect(() => {
    const previous = seenRef.current;
    seenRef.current = unreadCount;
    if (previous === null || unreadCount <= previous) return undefined;
    setRinging(true);
    const t = setTimeout(() => setRinging(false), 750);
    return () => clearTimeout(t);
  }, [unreadCount]);

  const loadItems = useCallback(async () => {
    setFailed(null);
    try {
      const res = await authFetch('/api/notifications/?page_size=5');
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setItems(data.results || []);
    } catch (error) {
      setFailed(toApiError(error));
    }
  }, []);

  useEffect(() => {
    if (open) loadItems();
  }, [open, loadItems]);

  const markAll = async () => {
    try {
      const res = await authFetch('/api/notifications/mark-all-read/', { method: 'POST' });
      if (!res.ok) throw await errorFromResponse(res);
      setUnreadCount(0);
      setItems((list) => (list || []).map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      notify?.(toApiError(error).message, 'error');
    }
  };

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ts-icon-btn"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        data-tour="bell"
      >
        <span className={ringing ? 'ts-bell-ring' : undefined}>
          <BellIcon />
        </span>
        {unreadCount > 0 && <span className="ts-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="ts-popover right-0 mt-2" style={{ width: 'min(360px, calc(100vw - 32px))' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(227,223,210,0.8)' }}>
            <p className="ts-ink text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={markAll} className="ts-link text-xs font-medium">
                Mark all as read
              </button>
            )}
          </div>

          {items === null && !failed && <p className="ts-soft px-4 py-6 text-center text-sm">Loading…</p>}
          {failed && (
            <div className="p-3">
              <ErrorState inline error={failed} title="Notifications didn&rsquo;t load" onRetry={loadItems} />
            </div>
          )}
          {items && items.length === 0 && (
            <div className="px-5 py-7 text-center">
              <p className="ts-ink text-sm font-medium">You&rsquo;re all caught up</p>
              <p className="ts-soft mt-1 text-sm">When the Registrar updates one of your requests, you&rsquo;ll see it here.</p>
            </div>
          )}
          {items && items.length > 0 && (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {items.map((n) => (
                <a
                  key={n.id}
                  href={notificationHref(n)}
                  onClick={() => !n.is_read && markNotificationRead(n.id)}
                  className="ts-popover-row"
                >
                  <span className={n.is_read ? 'ts-read-dot' : 'ts-unread-dot'} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.is_read ? 'ts-soft' : 'ts-ink font-semibold'}`}>{n.title}</span>
                    <span className="ts-soft mt-0.5 block text-sm" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {n.message}
                    </span>
                    <span className="ts-soft mt-1 block text-xs">{timeAgo(n.created_at)}</span>
                  </span>
                </a>
              ))}
            </div>
          )}

          <a
            href="/notifications"
            className="ts-link block px-4 py-3 text-center text-sm font-medium"
            style={{ borderTop: '1px solid rgba(227,223,210,0.8)' }}
          >
            View all notifications
          </a>
        </div>
      )}
    </div>
  );
}

// Phone header with the page title and the bell; on wider screens the sidebar carries the title, so only the bell shows.
export function StudentTopBar({ title, unreadCount, setUnreadCount, notify }) {
  return (
    <header className="ts-topbar">
      <div className="flex items-center justify-between gap-3 px-5 py-3 md:justify-end md:px-10 md:pt-5 md:pb-0">
        <p className="ts-ink truncate text-lg font-semibold md:hidden" style={FONT_SERIF}>
          {title}
        </p>
        <NotificationBell unreadCount={unreadCount} setUnreadCount={setUnreadCount} notify={notify} />
      </div>
    </header>
  );
}
