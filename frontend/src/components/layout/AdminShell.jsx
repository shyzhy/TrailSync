import { useCallback, useRef, useState } from 'react';
import { useDismiss } from './useDismiss.js';
import { Avatar, CloseIcon, GridIcon, LogoutIcon, MenuIcon, Toast, UsersIcon } from '../ui/index.js';
import { ADMIN_CSS } from '../../styles/adminCss.js';
import { APP_CSS } from '../../styles/appCss.js';
import { FONT_SANS, FONT_SERIF } from '../../styles/fonts.js';

// Deliberately two items: this portal only oversees accounts, the Registrar's work stays on the staff side.
const ADMIN_NAV_ITEMS = [
  { key: 'dashboard', href: '/admin/dashboard', label: 'Dashboard', Icon: GridIcon },
  { key: 'accounts', href: '/admin/accounts', label: 'Manage Accounts', Icon: UsersIcon },
];

function AdminSidebar({ active, me, onLogout }) {
  return (
    <aside className="ts-admin-sidebar hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-none lg:flex-col">
      <div className="px-6 pb-8 pt-7">
        <div className="flex items-center gap-2">
          <img src="/trailsync-logo.png" alt="" aria-hidden="true" style={{ height: '30px', width: 'auto', margin: '-6px 0' }} />
          <span className="text-lg font-semibold" style={{ ...FONT_SERIF, color: '#FAF8F3' }}>
            TrailSync
          </span>
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#C9A7EB' }}>
          Admin Portal
        </p>
      </div>

      <nav className="flex-1 space-y-2.5 px-3" aria-label="Admin pages">
        {ADMIN_NAV_ITEMS.map(({ key, href, label, Icon }) => (
          <a
            key={key}
            href={href}
            aria-current={key === active ? 'page' : undefined}
            className={`ts-admin-nav-item px-3 py-2.5 text-sm font-medium ${key === active ? 'ts-admin-nav-item-active' : ''}`}
          >
            <Icon />
            {label}
          </a>
        ))}
      </nav>

      {me && (
        <div className="ts-admin-sidebar-footer flex items-center gap-2.5 px-4 py-4">
          <Avatar user={me} className="ts-sidebar-avatar" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" style={{ color: '#FAF8F3' }}>
              {[me.first_name, me.last_name].filter(Boolean).join(' ') || me.email}
            </p>
            <p className="truncate text-xs" style={{ color: 'rgba(250,248,243,0.55)' }}>
              Administrator
            </p>
          </div>
        </div>
      )}

      <div className="px-3 pb-6">
        <button type="button" onClick={onLogout} className="ts-admin-nav-item w-full px-3 py-2.5 text-sm font-medium">
          <LogoutIcon />
          Log out
        </button>
      </div>
    </aside>
  );
}

function AdminMobileHeader({ active, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  return (
    <header className="ts-admin-mobile-header sticky top-0 z-20 lg:hidden">
      <div className="flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-2">
          <img src="/trailsync-logo.png" alt="" aria-hidden="true" style={{ height: '34px', width: 'auto', margin: '-7px 0' }} />
          <span className="text-lg font-semibold" style={{ ...FONT_SERIF, color: '#FAF8F3' }}>
            TrailSync
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#C9A7EB' }}>
            Admin
          </span>
        </div>

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={open}
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: '#DCC2F5', minHeight: 44 }}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
            Menu
          </button>

          {open && (
            <nav className="ts-popover right-0 mt-2 w-60 py-1" aria-label="Admin pages">
              {ADMIN_NAV_ITEMS.map(({ key, href, label, Icon }) => (
                <a
                  key={key}
                  href={href}
                  aria-current={key === active ? 'page' : undefined}
                  className="ts-popover-row ts-ink items-center text-base"
                  style={key === active ? { background: 'rgba(123,85,160,0.08)', fontWeight: 600 } : undefined}
                >
                  <Icon />
                  {label}
                </a>
              ))}
              <button type="button" onClick={onLogout} className="ts-popover-row ts-ink items-center text-base">
                <LogoutIcon />
                Log out
              </button>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

// The frame every admin page shares: plum sidebar on desktop, menu header on phones, and one toast.
export default function AdminShell({ active, me, onLogout, toast, onToastDismiss, children }) {
  return (
    <div className="ts-app-shell ts-admin lg:flex" style={FONT_SANS}>
      <style>{APP_CSS + ADMIN_CSS}</style>
      <AdminSidebar active={active} me={me} onLogout={onLogout} />
      <AdminMobileHeader active={active} onLogout={onLogout} />
      {children}
      <Toast message={toast?.message} tone={toast?.tone} onDismiss={onToastDismiss} />
    </div>
  );
}
