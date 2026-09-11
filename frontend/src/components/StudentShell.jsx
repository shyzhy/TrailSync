import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  APP_CSS,
  AppSidebar,
  Avatar,
  BellIcon,
  CloseIcon,
  FONT_SANS,
  FONT_SERIF,
  LogoutIcon,
  MenuIcon,
  NAV_ITEMS,
  QuestionIcon,
} from './trailsyncUI.jsx';
import { authFetch, updateStoredUser } from '../lib/auth.js';

/**
 * The chrome every student page shares: sidebar, top bar with the
 * notification bell, a labelled "Menu" on phones, the floating "Need help?"
 * button, and the first-time walkthrough.
 *
 * One component rather than the same five lines pasted into every page,
 * because all of these have to be present on EVERY student screen - a bell
 * or a help button that exists on some pages and not others is worse than
 * none, since a first-time user learns that it's there and then can't find
 * it again.
 *
 * Pages keep rendering their own <main>; it goes in as children.
 */

const ShellContext = createContext({
  unreadCount: 0,
  setUnreadCount: () => {},
  startTour: () => {},
});

/** For pages that change the unread count themselves (the Notifications page). */
export function useStudentShell() {
  return useContext(ShellContext);
}

function useDismiss(open, onClose, ref) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, ref]);
}

export function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Where a notification should take the student: straight to that request. */
export function notificationHref(n) {
  return n.request_code ? `/track-requests?search=${encodeURIComponent(n.request_code)}` : '/track-requests';
}

export function markNotificationRead(id) {
  // Fire-and-forget: the student is already on their way to the request, and
  // a failed mark-read only means the dot stays until next time.
  return authFetch(`/api/notifications/${id}/read/`, { method: 'POST' }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Notification bell
// ---------------------------------------------------------------------------

function NotificationBell({ unreadCount, setUnreadCount }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  useEffect(() => {
    if (!open) return;
    setFailed(false);
    authFetch('/api/notifications/?page_size=5')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setItems(data.results || []))
      .catch(() => setFailed(true));
  }, [open]);

  const markAll = async () => {
    const res = await authFetch('/api/notifications/mark-all-read/', { method: 'POST' }).catch(() => null);
    if (res?.ok) {
      setUnreadCount(0);
      setItems((list) => (list || []).map((n) => ({ ...n, is_read: true })));
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
        <BellIcon />
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
            <p className="ts-soft px-4 py-6 text-center text-sm">
              We couldn&rsquo;t load your notifications right now.
            </p>
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

// ---------------------------------------------------------------------------
// Phone menu
// ---------------------------------------------------------------------------

/**
 * On phones the sidebar is hidden, and until now there was no other way to
 * reach most of the app from a phone - Request, Track, the Credential Guide
 * and Profile were all sidebar-only. Labelled "Menu" in words rather than a
 * bare three-line icon, which a first-time user may not recognise.
 */
function MobileMenu({ active, me, unreadCount, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  return (
    <div className="relative lg:hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ts-icon-btn"
        aria-haspopup="true"
        aria-expanded={open}
        data-tour="menu"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
        Menu
      </button>
      {open && (
        <nav className="ts-popover right-0 mt-2 w-64 py-1" aria-label="Main">
          {NAV_ITEMS.map(({ key, href, label, Icon, soon }) =>
            soon ? (
              <span key={key} className="ts-popover-row ts-soft items-center text-base" style={{ opacity: 0.6 }}>
                <Icon />
                {label}
                <span className="ml-auto text-xs font-semibold uppercase tracking-wide">Soon</span>
              </span>
            ) : (
              <a
                key={key}
                href={href}
                aria-current={key === active ? 'page' : undefined}
                className={`ts-popover-row items-center text-base ${key === active ? 'ts-ink font-semibold' : 'ts-ink'}`}
                style={key === active ? { background: 'rgba(36,64,107,0.06)' } : undefined}
              >
                <Icon />
                {label}
                {key === 'notifications' && unreadCount > 0 && (
                  <span className="ts-nav-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </a>
            ),
          )}
          {me && (
            <a href="/profile" className="ts-popover-row ts-ink items-center text-base">
              <Avatar user={me} className="ts-avatar-sm" />
              My profile
            </a>
          )}
          <button type="button" onClick={onLogout} className="ts-popover-row ts-ink items-center text-base">
            <LogoutIcon />
            Log out
          </button>
        </nav>
      )}
    </div>
  );
}

function StudentTopBar({ active, me, unreadCount, setUnreadCount, onLogout }) {
  return (
    <header className="ts-topbar">
      <div className="flex items-center justify-between gap-3 px-5 py-3 lg:justify-end lg:px-10 lg:pt-5 lg:pb-0">
        <a href="/portal" className="flex items-center gap-2 lg:hidden" aria-label="TrailSync home">
          <img src="/trailsync-logo.png" alt="" aria-hidden="true" style={{ height: '32px', width: 'auto', margin: '-6px 0' }} />
          <span className="ts-ink text-lg font-semibold" style={FONT_SERIF}>TrailSync</span>
        </a>
        <div className="flex items-center gap-2">
          <MobileMenu active={active} me={me} unreadCount={unreadCount} onLogout={onLogout} />
          <NotificationBell unreadCount={unreadCount} setUnreadCount={setUnreadCount} />
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Floating help
// ---------------------------------------------------------------------------

/**
 * Always in the same corner of every student screen. First-time users often
 * never open the navigation at all; a button that says "Need help?" in words
 * catches the person who is stuck but wouldn't think to go looking.
 */
function HelpButton({ onStartTour }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  const links = [
    { href: '/credential-guide', title: 'Which document do I need?', body: 'See what each document is for and what it costs.' },
    { href: '/request-form', title: 'How do I request a document?', body: 'Four short steps, and we check everything with you before sending.' },
    { href: '/track-requests', title: 'Where is my request?', body: 'See how far along each request is.' },
  ];

  return (
    <div ref={ref}>
      {open && (
        <div className="ts-popover" style={{ position: 'fixed', right: 20, bottom: 84, width: 'min(320px, calc(100vw - 40px))' }}>
          <div className="px-4 pb-2 pt-4">
            <p className="ts-ink text-base font-semibold" style={FONT_SERIF}>How can we help?</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onStartTour();
            }}
            className="ts-popover-row"
          >
            <span>
              <span className="ts-ink block text-sm font-semibold">Show me around</span>
              <span className="ts-soft block text-sm">A quick tour of where everything is.</span>
            </span>
          </button>
          {links.map((l) => (
            <a key={l.href} href={l.href} className="ts-popover-row">
              <span>
                <span className="ts-ink block text-sm font-semibold">{l.title}</span>
                <span className="ts-soft block text-sm">{l.body}</span>
              </span>
            </a>
          ))}
          <p className="ts-soft px-4 py-3 text-sm" style={{ borderTop: '1px solid rgba(227,223,210,0.8)', background: 'rgba(227,223,210,0.22)' }}>
            Still stuck? The Registrar&rsquo;s staff at Window 6 can help you in person.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ts-help-fab"
        aria-haspopup="true"
        aria-expanded={open}
        data-tour="help"
      >
        {open ? <CloseIcon /> : <QuestionIcon />}
        {open ? 'Close' : 'Need help?'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// First-time walkthrough
// ---------------------------------------------------------------------------

/**
 * Each step lists where to point, in order of preference: the sidebar item
 * on a desktop, the Menu button on a phone (where the sidebar is hidden). The
 * first one actually visible wins, so the same tour works on both.
 *
 * The brief asked for a chatbot step. "Ask TrailSync" isn't built, and a tour
 * that points a newcomer at a feature that does nothing teaches them the app
 * is broken - so the last step points at the help button instead.
 */
const TOUR_STEPS = [
  {
    targets: ['[data-tour="home"]', '[data-tour="menu"]'],
    title: 'This is your home page',
    body: 'It shows your latest requests at a glance, so you always know how things are going.',
  },
  {
    targets: ['[data-tour="request"]', '[data-tour="menu"]'],
    title: 'Request a document',
    body: 'Start here whenever you need something from the Registrar, like a Transcript of Records.',
  },
  {
    targets: ['[data-tour="track"]', '[data-tour="menu"]'],
    title: 'Track your requests',
    body: 'See how far along each request is, and download your forms when they are ready.',
  },
  {
    targets: ['[data-tour="guide"]', '[data-tour="menu"]'],
    title: 'Not sure what you need?',
    body: 'The Credential Guide explains each document, what it is for, and what it costs.',
  },
  {
    targets: ['[data-tour="help"]'],
    title: 'Help is always here',
    body: 'Tap "Need help?" any time you are stuck, or to see this tour again.',
  },
];

function visibleTarget(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function GuidedTour({ onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [viaMenu, setViaMenu] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef(null);
  const primaryRef = useRef(null);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  const measure = useCallback(() => {
    const el = visibleTarget(step.targets);
    setViaMenu(Boolean(el && el.getAttribute('data-tour') === 'menu' && !step.targets[0].includes('menu')));
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  // Place the card beside the highlighted thing: to its right when there's
  // room (sidebar items), otherwise above or below it, always on screen.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 16;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    if (!rect) {
      setPos({ top: (vh - ch) / 2, left: (vw - cw) / 2 });
      return;
    }
    if (rect.right + m + cw < vw - m) {
      setPos({ top: clamp(rect.top - 10, m, vh - ch - m), left: rect.right + m });
    } else if (rect.bottom + m + ch < vh - m) {
      setPos({ top: rect.bottom + m, left: clamp(rect.left + rect.width / 2 - cw / 2, m, vw - cw - m) });
    } else {
      setPos({ top: clamp(rect.top - ch - m, m, vh - ch - m), left: clamp(rect.right - cw, m, vw - cw - m) });
    }
  }, [rect, index]);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, onClose]);

  const pad = 6;
  return (
    <div className="ts-tour-layer" role="dialog" aria-modal="true" aria-labelledby="ts-tour-title">
      {rect ? (
        <div
          className="ts-tour-spot"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="ts-tour-dim" />
      )}

      <div ref={cardRef} className="ts-tour-card" style={{ top: pos.top, left: pos.left }}>
        <div className="flex items-center justify-between gap-3">
          <p className="ts-soft text-sm">
            Step {index + 1} of {TOUR_STEPS.length}
          </p>
          <button type="button" onClick={onClose} className="ts-link text-sm font-medium">
            Skip tour
          </button>
        </div>
        <h2 id="ts-tour-title" className="ts-ink mt-2 text-lg font-semibold" style={FONT_SERIF}>
          {step.title}
        </h2>
        <p className="ts-soft mt-1.5 text-base leading-relaxed">{step.body}</p>
        {viaMenu && (
          <p className="ts-soft mt-2 text-sm">
            On your phone, you&rsquo;ll find this inside <strong className="ts-ink">Menu</strong>.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="ts-tour-dots" aria-hidden="true">
            {TOUR_STEPS.map((_, i) => (
              <span key={i} data-on={i === index ? '1' : '0'} />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex((i) => i - 1)} className="ts-btn-glass px-4 py-2 text-sm font-medium">
                Back
              </button>
            )}
            <button
              ref={primaryRef}
              type="button"
              onClick={() => (last ? onClose() : setIndex((i) => i + 1))}
              className="ts-btn-primary px-5 py-2 text-sm font-medium"
            >
              {last ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------

/**
 * @param offerTour  Pass true once the page has a FRESH /api/me/ (not the
 *                   cached login copy), so a student who already finished the
 *                   tour on another device isn't shown it again from a stale
 *                   cache. Only the dashboard - where login lands - offers it.
 * @param onMeChange Called with the updated user after the tour is marked
 *                   done, so the page's own copy of `me` stays in step.
 */
export default function StudentShell({ active, me, onLogout, offerTour = false, onMeChange, children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const offeredRef = useRef(false);

  const refreshUnread = useCallback(() => {
    authFetch('/api/notifications/unread-count/')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setUnreadCount(data.unread_count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnread();
    // Pick up changes the Registrar made while the tab sat in the background.
    const onVisible = () => document.visibilityState === 'visible' && refreshUnread();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshUnread]);

  useEffect(() => {
    if (!offerTour || offeredRef.current) return;
    if (me?.profile && !me.profile.tour_completed_at) {
      offeredRef.current = true;
      setTourOpen(true);
    }
  }, [offerTour, me]);

  const finishTour = useCallback(async () => {
    setTourOpen(false);
    if (me?.profile?.tour_completed_at) return; // a replay: nothing to record
    const res = await authFetch('/api/me/tour/', { method: 'POST' }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      updateStoredUser(data);
      onMeChange?.(data);
    }
  }, [me, onMeChange]);

  const startTour = useCallback(() => setTourOpen(true), []);

  return (
    <ShellContext.Provider value={{ unreadCount, setUnreadCount, startTour, refreshUnread }}>
      <div className="ts-app-shell ts-student lg:flex" style={FONT_SANS}>
        <style>{APP_CSS}</style>
        <AppSidebar active={active} onLogout={onLogout} me={me} unreadCount={unreadCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <StudentTopBar
            active={active}
            me={me}
            unreadCount={unreadCount}
            setUnreadCount={setUnreadCount}
            onLogout={onLogout}
          />
          {children}
          {/* Room to scroll the last button clear of the floating help button. */}
          <div className="h-24" aria-hidden="true" />
        </div>
        <HelpButton onStartTour={startTour} />
        {tourOpen && <GuidedTour onClose={finishTour} />}
      </div>
    </ShellContext.Provider>
  );
}
