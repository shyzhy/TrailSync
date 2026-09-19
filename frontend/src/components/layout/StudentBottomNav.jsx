import { useEffect, useState } from 'react';
import { NAV_ITEMS } from './StudentSidebar.jsx';
import { Avatar, LogoutIcon, MenuIcon } from '../ui/index.js';
import { useBackButton } from '../../lib/backButton.js';

// Tabs for four items plus More; a sixth tab would make labels too small to read at 360px. Notifications is reached
// from the bell in the header, not a tab.
const BOTTOM_NAV_KEYS = ['home', 'request', 'track', 'guide'];
const MORE_KEYS = ['ask'];

// Short enough to fit a tab; the page keeps its full name.
const TAB_LABEL = {
  home: 'Home',
  request: 'Request',
  track: 'Track',
  guide: 'Guide',
};

function MoreSheet({ active, me, onLogout, onClose }) {
  const items = MORE_KEYS.map((key) => NAV_ITEMS.find((i) => i.key === key)).filter(Boolean);
  useBackButton(true, onClose, { overlay: true });

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

// The phone's main navigation, fixed to the bottom where a thumb reaches it.
export function BottomNav({ active, me, onLogout }) {
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
