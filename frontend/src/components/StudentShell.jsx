import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  APP_CSS,
  AppSidebar,
  Avatar,
  BellIcon,
  CloseIcon,
  ErrorState,
  FONT_SANS,
  FONT_SERIF,
  LogoutIcon,
  MenuIcon,
  NAV_ITEMS,
  QuestionIcon,
  Toast,
} from './trailsyncUI.jsx';
import { authFetch, updateStoredUser } from '../lib/auth.js';
import { errorFromResponse, toApiError } from '../lib/api.js';

/**
 * The chrome every student page shares: the sidebar (tablet and desktop), a
 * bottom navigation bar with a title header (phones), the notification bell,
 * the floating "Need help?" button, and the first-time walkthrough.
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
  // Pages call this for "it worked" messages: one toast component, one
  // corner, on both sides of the app.
  notify: () => {},
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

function NotificationBell({ unreadCount, setUnreadCount, notify }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(null); // the ApiError, when the list didn't load
  const [ringing, setRinging] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  /**
   * Shake the bell when the count goes UP.
   *
   * Only upwards: reading notifications drops the number, and a bell that
   * jiggles because you just cleared it is noise. seenRef starts at the
   * first count this component ever sees, so arriving on a page with five
   * unread is not treated as five things arriving right now.
   */
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

// ---------------------------------------------------------------------------
// Phone navigation
// ---------------------------------------------------------------------------

/**
 * Which of the sidebar's items get a tab of their own.
 *
 * Five is the ceiling: at 360px each tab is 72px, and a sixth would put the
 * labels below the size anyone can read. The two that don't fit - the
 * Credential Guide and the (unbuilt) chatbot - live behind "More", along
 * with the profile and log out that the sidebar keeps in its footer.
 */
const BOTTOM_NAV_KEYS = ['home', 'request', 'track', 'notifications'];
const MORE_KEYS = ['guide', 'ask'];

/** Short enough to fit a tab without truncating; the page keeps its full name. */
const TAB_LABEL = {
  home: 'Home',
  request: 'Request',
  track: 'Track',
  notifications: 'Notifications',
};

function MoreSheet({ active, me, onLogout, onClose }) {
  const items = MORE_KEYS.map((key) => NAV_ITEMS.find((i) => i.key === key)).filter(Boolean);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="ts-sheet-overlay" onClick={onClose} />
      <div className="ts-sheet" role="dialog" aria-modal="true" aria-label="More">
        <div className="ts-sheet-grip" aria-hidden="true" />
        {items.map(({ key, href, label, Icon, soon }) =>
          soon ? (
            <span key={key} className="ts-sheet-row ts-soft" style={{ opacity: 0.65 }}>
              <Icon />
              {label}
              <span className="ml-auto text-xs font-semibold uppercase tracking-wide">Soon</span>
            </span>
          ) : (
            <a
              key={key}
              href={href}
              aria-current={key === active ? 'page' : undefined}
              className="ts-sheet-row"
              style={key === active ? { background: 'rgba(36,64,107,0.06)', fontWeight: 600 } : undefined}
            >
              <Icon />
              {label}
            </a>
          ),
        )}
        {me && (
          <a
            href="/profile"
            aria-current={active === 'profile' ? 'page' : undefined}
            className="ts-sheet-row"
            style={active === 'profile' ? { background: 'rgba(36,64,107,0.06)', fontWeight: 600 } : undefined}
          >
            <Avatar user={me} className="ts-avatar-sm" />
            My profile
          </a>
        )}
        <button type="button" onClick={onLogout} className="ts-sheet-row">
          <LogoutIcon />
          Log out
        </button>
      </div>
    </>
  );
}

/**
 * The phone's main navigation, fixed to the bottom of the viewport.
 *
 * A thumb reaches the bottom of a phone screen far more easily than a menu
 * button in the top corner, and the bar states outright what the app can do
 * instead of hiding it one tap deep.
 */
function BottomNav({ active, me, unreadCount, onLogout }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = BOTTOM_NAV_KEYS.map((key) => NAV_ITEMS.find((i) => i.key === key)).filter(Boolean);
  const moreIsActive = MORE_KEYS.includes(active) || active === 'profile';

  return (
    <>
      {moreOpen && (
        <MoreSheet active={active} me={me} onLogout={onLogout} onClose={() => setMoreOpen(false)} />
      )}
      <nav className="ts-bottom-nav" aria-label="Main">
        {tabs.map(({ key, href, Icon }) => (
          <a
            key={key}
            href={href}
            data-tour={key}
            aria-current={key === active ? 'page' : undefined}
            className={`ts-bottom-nav-item ${key === active ? 'ts-bottom-nav-item-active' : ''}`}
          >
            <Icon />
            <span>{TAB_LABEL[key]}</span>
            {key === 'notifications' && unreadCount > 0 && (
              <span className="ts-bottom-nav-count" aria-label={`${unreadCount} unread`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </a>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          // The tour points here when the item it wants lives in this sheet.
          data-tour="menu"
          className={`ts-bottom-nav-item ${moreIsActive || moreOpen ? 'ts-bottom-nav-item-active' : ''}`}
        >
          <MenuIcon />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}

/**
 * The phone header: which page you are on, and the bell. The brand mark it
 * used to show belongs to the sidebar, which a phone doesn't have - and a
 * logo repeated on every screen tells a student nothing about where they
 * are. On tablet and desktop the sidebar carries the title's job, so the bar
 * holds only the bell.
 */
function StudentTopBar({ title, unreadCount, setUnreadCount, notify }) {
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
    // querySelectorAll, not querySelector: the sidebar and the bottom bar
    // both carry data-tour="home" etc, and only one of them is on screen at
    // any width. Taking the first match would spotlight the hidden one.
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
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
            On your phone, you&rsquo;ll find this under <strong className="ts-ink">More</strong>.
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
export default function StudentShell({
  active,
  title,
  me,
  onLogout,
  offerTour = false,
  onMeChange,
  children,
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, tone = 'success') => setToast({ message, tone }), []);
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

  // No student page is usable with a half-built profile - the request form
  // prints from it - so anyone who gets here before finishing setup goes
  // back to the step they were on. Read from each page's fresh /api/me/ as
  // well as the cached copy, so it cannot be skipped by a stale cache.
  useEffect(() => {
    const onboarding = me?.profile?.onboarding;
    if (onboarding && !onboarding.complete) window.location.replace('/onboarding');
  }, [me]);

  return (
    <ShellContext.Provider value={{ unreadCount, setUnreadCount, startTour, refreshUnread, notify }}>
      <div className="ts-app-shell ts-student md:flex" style={FONT_SANS}>
        <style>{APP_CSS}</style>
        <AppSidebar active={active} onLogout={onLogout} me={me} unreadCount={unreadCount} />
        {/* ts-student-main carries the bottom padding that keeps the fixed
            phone nav from covering the end of a page. */}
        <div className="ts-student-main flex min-w-0 flex-1 flex-col">
          <StudentTopBar title={title} unreadCount={unreadCount} setUnreadCount={setUnreadCount} notify={notify} />
          {children}
          {/* Room to scroll the last button clear of the floating help button. */}
          <div className="h-24" aria-hidden="true" />
        </div>
        <HelpButton onStartTour={startTour} />
        <BottomNav active={active} me={me} unreadCount={unreadCount} onLogout={onLogout} />
        <Toast message={toast?.message} tone={toast?.tone} onDismiss={() => setToast(null)} />
        {tourOpen && <GuidedTour onClose={finishTour} />}
      </div>
    </ShellContext.Provider>
  );
}
