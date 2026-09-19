import {
  Avatar,
  BookIcon,
  ChatIcon,
  HomeIcon,
  LogoutIcon,
  PlusCircleIcon,
  TicketIcon,
} from '../ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';

// Student navigation items; Ask TrailSync is a placeholder until that page exists. Notifications has no item: the
// header bell (with its unread badge and "View all notifications" link) is the one way in.

export const NAV_ITEMS = [
  { key: 'home', href: '/portal', label: 'Home', Icon: HomeIcon },
  { key: 'request', href: '/request-form', label: 'Request a document', Icon: PlusCircleIcon },
  { key: 'track', href: '/track-requests', label: 'Track my requests', Icon: TicketIcon },
  { key: 'guide', href: '/credential-guide', label: 'Credential Guide', Icon: BookIcon },
  // A labelled, non-navigating item: a menu link that does nothing reads as the app being broken.
  { key: 'ask', href: null, label: 'Ask TrailSync', Icon: ChatIcon, soon: true },
];

// `me` is optional: without it the sidebar renders without the profile footer.
export function StudentSidebar({ active, onLogout, me }) {
  const profile = me?.profile;
  const idLine = [profile?.school_id_number, profile?.course].filter(Boolean).join(' · ');

  return (
    // From 768px up, icons only until 1024px; below 768px the bottom bar replaces it.
    <aside className="ts-sidebar hidden md:sticky md:top-0 md:flex md:h-screen md:w-[76px] md:flex-none md:flex-col lg:w-64">
      <div className="flex items-center gap-2 px-4 pb-8 pt-7 md:justify-center lg:justify-start lg:px-6">
        <img
          src="/trailsync-logo.png"
          alt=""
          aria-hidden="true"
          style={{ height: '30px', width: 'auto', margin: '-6px 0' }}
        />
        <span className="hidden text-lg font-semibold lg:inline" style={{ ...FONT_SERIF, color: '#FAF8F3' }}>TrailSync</span>
      </div>

      <nav className="flex-1 space-y-2.5 px-2 lg:px-3" aria-label="Main">
        {NAV_ITEMS.map(({ key, href, label, Icon, soon }) =>
          soon ? (
            <span
              key={key}
              data-tour={key}
              className="ts-nav-item ts-nav-item-soon justify-center px-3 py-2.5 text-sm font-medium lg:justify-start"
              title={`${label} — coming soon`}
            >
              <Icon />
              <span className="hidden lg:inline">{label}</span>
              <span className="ts-nav-soon hidden lg:inline">Soon</span>
            </span>
          ) : (
            <a
              key={key}
              href={href}
              data-tour={key}
              aria-current={key === active ? 'page' : undefined}
              title={label}
              className={`ts-nav-item justify-center px-3 py-2.5 text-sm font-medium lg:justify-start ${key === active ? 'ts-nav-item-active' : ''}`}
            >
              <Icon />
              {/* The label stays the accessible name when it is visually hidden on a tablet. */}
              <span className="sr-only lg:not-sr-only">{label}</span>
            </a>
          ),
        )}
      </nav>

      {me && (
        // The footer doubles as the entry point to the Profile page.
        <a
          href="/profile"
          aria-current={active === 'profile' ? 'page' : undefined}
          title="My profile"
          className={`ts-sidebar-footer ts-nav-item justify-center px-4 py-4 lg:justify-start ${active === 'profile' ? 'ts-nav-item-active' : ''}`}
        >
          <Avatar user={me} className="ts-sidebar-avatar" />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-medium" style={{ color: '#FAF8F3' }}>
              {me.first_name} {me.last_name}
            </p>
            {idLine && (
              <p className="truncate text-xs" style={{ color: 'rgba(250,248,243,0.55)' }}>
                {idLine}
              </p>
            )}
          </div>
        </a>
      )}

      <div className="px-2 pb-6 lg:px-3">
        <button
          type="button"
          onClick={onLogout}
          title="Log out"
          className="ts-nav-item w-full justify-center px-3 py-2.5 text-sm font-medium lg:justify-start"
        >
          <LogoutIcon />
          <span className="sr-only lg:not-sr-only">Log out</span>
        </button>
      </div>
    </aside>
  );
}
