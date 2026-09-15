import { useEffect, useRef, useState } from 'react';
import {
  ArchiveIcon,
  Avatar,
  CalendarIcon,
  CloseIcon,
  DocumentIcon,
  GridIcon,
  LogoutIcon,
  MenuIcon,
  QuestionIcon,
} from '../ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';

// Registrar shell: charcoal and gold, so staff never mistake which side of the app they're on.

// Keep it short: no Notifications (student-only) and no Release Slots (everything is released 3:00 to 5:00 PM).
const STAFF_NAV_ITEMS = [
  { key: 'dashboard', href: '/registrar/dashboard', label: 'Dashboard', Icon: GridIcon },
  { key: 'queue', href: '/registrar/queue', label: 'Processing Queue', Icon: DocumentIcon },
  { key: 'calendar', href: '/registrar/calendar', label: 'Release Calendar', Icon: CalendarIcon },
  { key: 'released', href: '/registrar/released', label: 'Released Documents', Icon: ArchiveIcon },
];

// Plain answers to a new staff member's questions, reachable from every registrar screen.
function StaffHelp({ onClose }) {
  const items = [
    {
      q: 'How do I work through a request?',
      a: 'Open "Processing Queue" and click Review on any row. The page shows the one action that fits where that request has got to, and asks you to confirm before anything is saved.',
    },
    {
      q: 'What do the stages mean?',
      a: 'Waiting for Review (you check the requirements) → Waiting for Approval (the Registrar approves and the fee is set) → Waiting for Payment (the student pays at the Cashier) → Being Prepared → Ready for Pickup → Released.',
    },
    {
      q: 'When can students collect documents?',
      a: 'Window 6 releases documents from 3:00 to 5:00 PM. You set the date when you mark a request ready; the time is always that window.',
    },
    {
      q: 'How do I get a record for the office?',
      a: 'Released Documents lists everything that has been claimed. Set the dates you need and click "Export to Excel" to download it as a spreadsheet.',
    },
    {
      q: 'Something looks wrong, or I am stuck.',
      a: 'Contact whoever administers TrailSync for your office. If a request will not move to the next stage, the page explains why at the top - most often the student is not cleared yet.',
    },
  ];

  return (
    <div className="ts-modal-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        className="ts-modal-panel p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="ts-modal-close">
          <CloseIcon />
        </button>
        <h2 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
          Need help?
        </h2>
        <p className="ts-soft mt-1.5 text-base">The short version of how this side of TrailSync works.</p>
        <dl className="mt-6 space-y-5">
          {items.map((item) => (
            <div key={item.q}>
              <dt className="ts-ink text-base font-semibold">{item.q}</dt>
              <dd className="ts-soft mt-1 text-sm leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="ts-btn-primary mt-7 flex w-full items-center justify-center py-2.5 text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function RegistrarSidebar({ active, onLogout, me }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const profile = me?.profile;
  const idLine = [profile?.employee_id, profile?.assigned_window ? `Window ${profile.assigned_window}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <aside className="ts-staff-sidebar hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-none lg:flex-col">
      <div className="flex items-center gap-2 px-6 pb-8 pt-7">
        <img
          src="/trailsync-logo.png"
          alt=""
          aria-hidden="true"
          style={{ height: '30px', width: 'auto', margin: '-6px 0' }}
        />
        <span className="text-lg font-semibold" style={{ ...FONT_SERIF, color: '#FAF8F3' }}>TrailSync</span>
      </div>

      <nav className="flex-1 space-y-2.5 px-3">
        {STAFF_NAV_ITEMS.map(({ key, href, label, Icon }) => (
          <a
            key={key}
            href={href}
            aria-current={key === active ? 'page' : undefined}
            className={`ts-staff-nav-item px-3 py-2.5 text-sm font-medium ${key === active ? 'ts-staff-nav-item-active' : ''}`}
          >
            <Icon />
            {label}
          </a>
        ))}
      </nav>

      {me && (
        <div className="ts-staff-sidebar-footer flex items-center gap-2.5 px-4 py-4">
          <Avatar user={me} className="ts-sidebar-avatar" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" style={{ color: '#FAF8F3' }}>
              {me.first_name} {me.last_name}
            </p>
            {idLine && (
              <p className="truncate text-xs" style={{ color: 'rgba(250,248,243,0.55)' }}>
                {idLine}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2.5 px-3 pb-6">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="ts-staff-nav-item w-full px-3 py-2.5 text-sm font-medium"
        >
          <QuestionIcon />
          Need help?
        </button>
        <button type="button" onClick={onLogout} className="ts-staff-nav-item w-full px-3 py-2.5 text-sm font-medium">
          <LogoutIcon />
          Log out
        </button>
      </div>

      {helpOpen && <StaffHelp onClose={() => setHelpOpen(false)} />}
    </aside>
  );
}

// The staff header on phones, with a menu carrying the same pages plus help.
export function RegistrarMobileHeader({ active, onLogout }) {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="ts-staff-mobile-header sticky top-0 z-20 lg:hidden">
      <div className="flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-2">
          <img
            src="/trailsync-logo.png"
            alt=""
            aria-hidden="true"
            style={{ height: '34px', width: 'auto', margin: '-7px 0' }}
          />
          <span className="text-lg font-semibold" style={{ ...FONT_SERIF, color: '#FAF8F3' }}>TrailSync</span>
        </div>

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={open}
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: '#E4B45C', minHeight: 44 }}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
            Menu
          </button>

          {open && (
            <nav className="ts-popover right-0 mt-2 w-64 py-1" aria-label="Registrar pages">
              {STAFF_NAV_ITEMS.map(({ key, href, label, Icon }) => (
                <a
                  key={key}
                  href={href}
                  aria-current={key === active ? 'page' : undefined}
                  className="ts-popover-row ts-ink items-center text-base"
                  style={key === active ? { background: 'rgba(36,64,107,0.06)', fontWeight: 600 } : undefined}
                >
                  <Icon />
                  {label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setHelpOpen(true);
                }}
                className="ts-popover-row ts-ink items-center text-base"
              >
                <QuestionIcon />
                Need help?
              </button>
              <button type="button" onClick={onLogout} className="ts-popover-row ts-ink items-center text-base">
                <LogoutIcon />
                Log out
              </button>
            </nav>
          )}
        </div>
      </div>

      {helpOpen && <StaffHelp onClose={() => setHelpOpen(false)} />}
    </header>
  );
}
