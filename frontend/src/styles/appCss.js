import { COLOR_UTIL_CSS, FORM_CONTROL_CSS } from './baseCss.js';

// Styles for logged-in screens, on paper rather than glass.

export const APP_CSS = `
  ${COLOR_UTIL_CSS}
  ${FORM_CONTROL_CSS}

  /* A ~5% warm glow, just enough for the glass cards to float over. */
  .ts-app-shell {
    min-height: 100vh;
    background:
      radial-gradient(1100px 550px at 12% -8%, rgba(184,135,43,0.06), transparent 60%),
      radial-gradient(950px 650px at 100% 105%, rgba(79,122,106,0.06), transparent 55%),
      #FAF8F3;
  }

  .ts-app-header {
    background: rgba(250,248,243,0.92);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border-bottom: 1px solid #E3DFD2;
  }

  /* Sidebar: institutional-blue frosted glass */
  .ts-sidebar {
    background: linear-gradient(180deg, #35548F 0%, #24406B 45%, #17294A 100%);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.16),
      6px 0 28px -14px rgba(15,23,42,0.4);
  }
  /* Inactive items are muted so the active one reads instantly. */
  .ts-nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: rgba(250,248,243,0.52);
    border-radius: 10px;
    transition: color 150ms ease, background 150ms ease, transform 120ms ease;
  }
  .ts-nav-item:hover {
    color: rgba(250,248,243,0.95);
    background: rgba(255,255,255,0.08);
    transform: translateX(1px);
  }
  .ts-nav-item:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }
  /* Active: inset glow, top highlight and a thin gold accent bar. */
  .ts-nav-item-active {
    color: #FAF8F3;
    background: linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.05) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.4),
      inset 0 0 0 1px rgba(255,255,255,0.10),
      0 3px 12px rgba(15,23,42,0.32);
  }
  .ts-nav-item-active:hover {
    background: linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.06) 100%);
    transform: none;
  }
  .ts-nav-item-active::before {
    content: '';
    position: absolute;
    left: -3px; top: 20%; bottom: 20%;
    width: 3px;
    border-radius: 2px;
    background: linear-gradient(180deg, #E4B45C, #B8872B);
  }

  /* Cards: translucent paper over the shell's texture */
  .ts-card {
    position: relative;
    background: linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(250,248,243,0.70) 100%);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.65);
    border-radius: 14px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.8),
      0 16px 32px -20px rgba(31,41,55,0.28),
      0 2px 6px rgba(31,41,55,0.05);
    transition: transform 200ms ease, box-shadow 200ms ease;
  }
  /* Only the stat cards lift on hover. */
  .ts-card-hoverable:hover {
    transform: translateY(-3px);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.9),
      0 26px 46px -22px rgba(31,41,55,0.34),
      0 4px 10px rgba(31,41,55,0.08);
  }

  /* Embossed number: a dark lift plus a faint blue halo. */
  .ts-stat-number {
    color: #1F2937;
    text-shadow: 0 1px 1px rgba(255,255,255,0.7), 0 2px 6px rgba(31,41,55,0.14), 0 0 22px rgba(36,64,107,0.10);
  }

  .ts-stat-icon {
    width: 40px; height: 40px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(31,41,55,0.05);
  }
  .ts-stat-icon-blue { background: linear-gradient(180deg, rgba(36,64,107,0.15), rgba(36,64,107,0.05)); color: #24406B; }
  .ts-stat-icon-gold { background: linear-gradient(180deg, rgba(184,135,43,0.20), rgba(184,135,43,0.06)); color: #B8872B; }
  .ts-stat-icon-sage { background: linear-gradient(180deg, rgba(79,122,106,0.20), rgba(79,122,106,0.06)); color: #4F7A6A; }

  /* Quick action cards: built to look pressable, depressing on hover and click */
  .ts-quick-card {
    position: relative;
    background: linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(250,248,243,0.70) 100%);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.65);
    border-radius: 14px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.8),
      0 16px 32px -20px rgba(31,41,55,0.28),
      0 2px 6px rgba(31,41,55,0.05);
    transition: box-shadow 150ms ease, transform 100ms ease, background 150ms ease;
  }
  .ts-quick-card:hover {
    background: linear-gradient(165deg, rgba(248,246,240,0.9) 0%, rgba(240,236,226,0.78) 100%);
    box-shadow: inset 0 2px 6px rgba(31,41,55,0.10), 0 8px 18px -14px rgba(31,41,55,0.2);
    transform: translateY(1px);
  }
  .ts-quick-card:active {
    background: linear-gradient(165deg, rgba(242,238,229,0.94) 0%, rgba(231,226,212,0.86) 100%);
    box-shadow: inset 0 3px 10px rgba(31,41,55,0.16), inset 0 -1px 0 rgba(255,255,255,0.4);
    transform: translateY(2px) scale(0.99);
  }
  .ts-quick-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }

  /* Status pills: small glossy enamel badges */
  .ts-pill {
    display: inline-flex; align-items: center; gap: 5px;
    border-radius: 999px; padding: 3px 10px;
    font-size: 12px; font-weight: 600; white-space: nowrap;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 2px rgba(31,41,55,0.05), 0 1px 2px rgba(31,41,55,0.06);
  }
  .ts-pill-processing {
    background: linear-gradient(180deg, rgba(226,180,97,0.34) 0%, rgba(184,135,43,0.18) 100%);
    color: #7A5A17;
    border: 1px solid rgba(184,135,43,0.4);
  }
  .ts-pill-ready {
    background: linear-gradient(180deg, rgba(122,173,153,0.34) 0%, rgba(79,122,106,0.18) 100%);
    color: #2C4B3F;
    border: 1px solid rgba(79,122,106,0.42);
  }
  .ts-pill-released {
    background: linear-gradient(180deg, rgba(156,163,174,0.30) 0%, rgba(91,100,116,0.16) 100%);
    color: #4A5262;
    border: 1px solid rgba(91,100,116,0.32);
  }
  /* Cancelled: an outline only, so it never reads as a stage the request is waiting at. */
  .ts-pill-cancelled {
    background: transparent;
    color: #5B6474;
    border: 1px dashed rgba(91,100,116,0.55);
  }
  /* Recessed surface for a read-only figure inside a card, such as the amount owed. */
  .ts-well {
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(227,223,210,0.34) 0%, rgba(250,248,243,0.55) 100%);
    border: 1px solid rgba(227,223,210,0.9);
    box-shadow: inset 0 2px 5px rgba(31,41,55,0.07), inset 0 -1px 0 rgba(255,255,255,0.7);
  }
  /* A checklist with a problem, matching .ts-input-error. */
  .ts-well-error {
    border-color: rgba(185,28,28,0.5);
    box-shadow: inset 0 2px 4px rgba(185,28,28,0.14), inset 0 -1px 0 rgba(255,255,255,0.7);
  }

  /* Ready to Print: blue, the one stage waiting on the student. */
  .ts-pill-blue {
    background: linear-gradient(180deg, rgba(36,64,107,0.22) 0%, rgba(36,64,107,0.10) 100%);
    color: #1E3559;
    border: 1px solid rgba(36,64,107,0.38);
  }
  /* Under Review: teal, so the three stages in the office's hands stay distinct. */
  .ts-pill-teal {
    background: linear-gradient(180deg, rgba(45,106,110,0.24) 0%, rgba(45,106,110,0.11) 100%);
    color: #235457;
    border: 1px solid rgba(45,106,110,0.4);
  }
  .ts-pill-danger {
    background: linear-gradient(180deg, rgba(220,38,38,0.20) 0%, rgba(185,28,28,0.10) 100%);
    color: #991B1B;
    border: 1px solid rgba(185,28,28,0.35);
  }

  /* Toast: the same glass construction as .ts-card. */
  .ts-toast {
    /* Top-right from tablet size; across the top on a phone, where a corner card would cover the bell. */
    position: fixed; top: 16px; right: 16px; left: 16px; z-index: 65;
    display: flex; align-items: center; gap: 10px;
    max-width: min(92vw, 460px);
    padding: 12px 18px;
    border-radius: 14px;
    font-size: 14px; font-weight: 500;
    color: #F7F5EF;
    background: linear-gradient(180deg, rgba(47,52,61,0.97) 0%, rgba(31,35,42,0.97) 100%);
    border: 1px solid rgba(255,255,255,0.14);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 12px 30px rgba(20,24,31,0.42);
    animation: ts-toast-in 0.26s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  .ts-toast-accent { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; background: #7AAD99; }
  .ts-toast-close {
    flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; margin: -4px -6px -4px 0;
    border-radius: 999px;
    color: rgba(247,245,239,0.7);
    cursor: pointer;
  }
  .ts-toast-close:hover { color: #F7F5EF; background: rgba(255,255,255,0.12); }
  .ts-toast-close:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.65); }
  .ts-toast-error .ts-toast-accent { background: #E2857F; }
  @media (min-width: 768px) {
    .ts-toast { left: auto; max-width: 420px; }
  }
  @keyframes ts-toast-in {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) { .ts-toast { animation: none; } }

  .ts-row-hover:hover { background: rgba(36,64,107,0.03); }

  /* Soft inset line instead of a flat border between rows. */
  .ts-row-divider { box-shadow: inset 0 1px 0 rgba(31,41,55,0.07); }
  .ts-row-divider:first-child { box-shadow: none; }

  .ts-skeleton {
    background: linear-gradient(90deg, #ECE8DD 25%, #F5F3EC 37%, #ECE8DD 63%);
    background-size: 400% 100%;
    animation: ts-shimmer 1.4s ease infinite;
    border-radius: 8px;
  }
  @keyframes ts-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }

  /* Mini calendar */
  .ts-cal-day {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    font-size: 12px;
  }
  .ts-cal-day-today {
    color: #FAF8F3;
    font-weight: 600;
    background: linear-gradient(180deg, #DCA948 0%, #B8872B 100%);
    box-shadow: 0 1px 3px rgba(31,41,55,0.3), inset 0 1px 0 rgba(255,255,255,0.5);
  }
  .ts-cal-dot { display: block; width: 4px; height: 4px; margin-top: 3px; border-radius: 999px; background: transparent; }
  .ts-cal-dot-active { background: #4F7A6A; }

  /* Sidebar profile footer */
  .ts-sidebar-footer { border-top: 1px solid rgba(255,255,255,0.12); }
  /* A photo inside any avatar slot; the slot's own class supplies the circle, and cover stops stretching. */
  .ts-avatar-photo {
    display: block;
    object-fit: cover;
    background: #E3DFD2;
  }

  /* The large avatar on the Profile page. */
  .ts-avatar-xl {
    position: relative;
    width: 112px; height: 112px;
    flex-shrink: 0;
    border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    font-size: 38px; font-weight: 600; letter-spacing: 0.01em;
    color: #FAF8F3;
    background: linear-gradient(180deg, #DCA948 0%, #B8872B 100%);
    box-shadow:
      0 0 0 4px rgba(255,255,255,0.85),
      0 0 0 5px rgba(227,223,210,0.9),
      0 10px 24px rgba(31,41,55,0.18),
      inset 0 1px 0 rgba(255,255,255,0.4);
  }
  .ts-avatar-xl > img { width: 100%; height: 100%; border-radius: 999px; }
  /* Positioning box for the avatar and its camera button. */
  .ts-avatar-frame { width: 112px; height: 112px; }

  /* Camera button pinned to the avatar's lower-right edge. */
  .ts-avatar-edit {
    position: absolute; right: -2px; bottom: -2px;
    width: 36px; height: 36px;
    border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    color: #FAF8F3;
    background: linear-gradient(180deg, #34558A 0%, #24406B 100%);
    border: 2px solid rgba(255,255,255,0.95);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 10px rgba(36,64,107,0.35);
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.15s ease;
  }
  .ts-avatar-edit:hover:not(:disabled) { filter: brightness(1.1); }
  .ts-avatar-edit:active:not(:disabled) { transform: translateY(1px); }
  .ts-avatar-edit:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.65), 0 4px 10px rgba(36,64,107,0.35); }
  .ts-avatar-edit:disabled { cursor: progress; filter: saturate(0.7); }

  /* Frosted veil over the avatar while an upload is in flight. */
  .ts-avatar-busy {
    position: absolute; inset: 0;
    border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    color: #FAF8F3;
    background: rgba(31,41,55,0.42);
    -webkit-backdrop-filter: blur(2px);
    backdrop-filter: blur(2px);
  }

  /* Nav extra: the "not built yet" item */
  .ts-nav-item-soon { cursor: default; opacity: 0.55; }
  .ts-nav-item-soon:hover { background: transparent; }
  .ts-nav-soon {
    margin-left: auto;
    font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 2px 7px; border-radius: 999px;
    color: rgba(250,248,243,0.85);
    border: 1px solid rgba(250,248,243,0.3);
  }

  /* HelpTip */
  .ts-helptip { position: relative; display: inline-flex; vertical-align: middle; margin-left: 6px; }
  .ts-helptip-btn {
    width: 20px; height: 20px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; line-height: 1;
    color: #24406B;
    background: linear-gradient(180deg, #FFFFFF 0%, #EEF1F6 100%);
    border: 1px solid rgba(36,64,107,0.28);
    box-shadow: 0 1px 2px rgba(31,41,55,0.12), inset 0 1px 0 rgba(255,255,255,0.9);
    cursor: help;
  }
  .ts-helptip-btn:hover { border-color: rgba(36,64,107,0.5); }
  .ts-helptip-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }
  .ts-helptip-bubble {
    position: absolute; bottom: calc(100% + 9px); left: 50%;
    z-index: 70;
    width: max-content; max-width: min(280px, 80vw);
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 13px; font-weight: 400; line-height: 1.5; text-align: left;
    white-space: normal;
    color: #F7F5EF;
    background: rgba(31,41,55,0.96);
    box-shadow: 0 10px 24px rgba(20,24,31,0.28);
    pointer-events: none;
  }
  .ts-helptip-bubble::after {
    content: ''; position: absolute; top: 100%; left: 50%;
    margin-left: -6px; border: 6px solid transparent; border-top-color: rgba(31,41,55,0.96);
  }

  /* Student top bar */
  .ts-topbar {
    position: sticky; top: 0; z-index: 30;
    background: linear-gradient(180deg, rgba(250,248,243,0.9) 0%, rgba(250,248,243,0.72) 100%);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    backdrop-filter: blur(14px) saturate(1.2);
    border-bottom: 1px solid rgba(227,223,210,0.8);
  }
  @media (min-width: 1024px) {
    /* The sidebar carries the brand on desktop, so the bar only holds the bell. */
    .ts-topbar { background: transparent; border-bottom: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
  }
  .ts-icon-btn {
    position: relative;
    height: 42px; min-width: 42px; padding: 0 12px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    font-size: 14px; font-weight: 600;
    color: #24406B;
    background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.72) 100%);
    border: 1px solid rgba(227,223,210,0.95);
    box-shadow: 0 2px 6px rgba(31,41,55,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
    cursor: pointer;
  }
  .ts-icon-btn:hover { background: #FFFFFF; }
  .ts-icon-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }
  .ts-bell-badge {
    position: absolute; top: -3px; right: -3px;
    min-width: 19px; height: 19px; padding: 0 5px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff;
    background: #B91C1C;
    border: 2px solid #FAF8F3;
  }

  /* Dropdowns: bell preview, mobile menu, help menu */
  .ts-popover {
    position: absolute; z-index: 60;
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,248,243,0.97) 100%);
    border: 1px solid rgba(227,223,210,0.95);
    box-shadow: 0 18px 44px rgba(31,41,55,0.2), inset 0 1px 0 rgba(255,255,255,0.9);
    overflow: hidden;
  }
  .ts-popover-row { display: flex; gap: 10px; padding: 12px 16px; text-align: left; width: 100%; }
  .ts-popover-row:hover { background: rgba(36,64,107,0.04); }
  .ts-popover-row + .ts-popover-row { border-top: 1px solid rgba(227,223,210,0.7); }
  .ts-unread-dot { width: 8px; height: 8px; margin-top: 7px; border-radius: 999px; flex-shrink: 0; background: #24406B; }
  .ts-read-dot { width: 8px; height: 8px; margin-top: 7px; flex-shrink: 0; }

  /* Floating help button */
  .ts-help-fab {
    position: fixed; right: 20px; bottom: 20px; z-index: 50;
    height: 52px; padding: 0 18px 0 14px;
    border-radius: 999px;
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 15px; font-weight: 600;
    color: #FAF8F3;
    background: linear-gradient(180deg, #34558A 0%, #24406B 100%);
    border: 1px solid rgba(255,255,255,0.18);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 10px 26px rgba(36,64,107,0.38);
    cursor: pointer;
  }
  .ts-help-fab:hover { filter: brightness(1.08); }
  .ts-help-fab:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.7), 0 10px 26px rgba(36,64,107,0.38); }


  /* Phone bottom navigation (<768px): 56px plus the device's safe area, which the content spacer is sized against. */
  .ts-bottom-nav {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 40;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    background: linear-gradient(180deg, #35548F 0%, #24406B 55%, #17294A 100%);
    border-top: 1px solid rgba(255,255,255,0.14);
    box-shadow: 0 -10px 26px -14px rgba(15,23,42,0.6);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .ts-bottom-nav-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    /* Past the 44px thumb target even before the safe area. */
    min-height: 56px;
    padding: 7px 4px 9px;
    color: rgba(250,248,243,0.62);
    font-weight: 600;
    cursor: pointer;
  }
  .ts-bottom-nav-item > span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* Shrinks slightly on a 360px phone so "Notifications" still fits. */
    font-size: clamp(10px, 2.85vw, 11px);
    line-height: 1.15;
  }
  .ts-bottom-nav-item-active {
    color: #FAF8F3;
    background: linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.04) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.35);
  }
  .ts-bottom-nav-item-active::before {
    content: '';
    position: absolute;
    top: 0; left: 22%; right: 22%;
    height: 3px;
    border-radius: 0 0 3px 3px;
    background: linear-gradient(90deg, #E4B45C, #B8872B);
  }
  .ts-bottom-nav-item:focus-visible { outline: none; box-shadow: inset 0 0 0 3px rgba(184,135,43,0.65); }
  @media (min-width: 768px) { .ts-bottom-nav { display: none; } }

  /* Nothing at the end of a page should hide behind the fixed bar. */
  @media (max-width: 767px) {
    .ts-student-main { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }
  }

  /* "More" sheet: the nav items that don't fit as tabs */
  .ts-sheet-overlay { position: fixed; inset: 0; z-index: 70; background: rgba(15,23,42,0.45); }
  .ts-sheet {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 71;
    border-radius: 18px 18px 0 0;
    background: linear-gradient(180deg, #FFFFFF 0%, #FAF8F3 100%);
    border-top: 1px solid rgba(227,223,210,0.95);
    box-shadow: 0 -20px 46px rgba(15,23,42,0.3);
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
    animation: ts-sheet-up 180ms ease-out;
  }
  @keyframes ts-sheet-up { from { transform: translateY(12%); opacity: 0.6; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .ts-sheet { animation: none; } }
  .ts-sheet-grip {
    width: 40px; height: 4px; border-radius: 999px;
    background: rgba(91,100,116,0.28);
    margin: 10px auto 4px;
  }
  .ts-sheet-row {
    display: flex; align-items: center; gap: 12px;
    width: 100%; min-height: 52px; padding: 12px 20px;
    text-align: left; color: #1F2937; font-size: 15px; font-weight: 500;
  }
  .ts-sheet-row + .ts-sheet-row { border-top: 1px solid rgba(227,223,210,0.7); }
  .ts-sheet-row:active { background: rgba(36,64,107,0.06); }

  /* Horizontally swipeable chip rows, the only thing in the app meant to scroll sideways. */
  .ts-tab-scroller {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    /* Room for the chips' focus ring, which would otherwise be clipped. */
    padding: 3px 0;
    /* Runs to the screen edge, so it reads as scrollable. */
    margin-inline: -1.5rem;
    padding-inline: 1.5rem;
    scroll-padding-inline: 1.5rem;
  }
  .ts-tab-scroller::-webkit-scrollbar { display: none; }
  .ts-tab-scroller > * { flex: 0 0 auto; }
  @media (min-width: 768px) {
    .ts-tab-scroller {
      flex-wrap: wrap;
      overflow-x: visible;
      margin-inline: 0;
      padding-inline: 0;
    }
  }


  /* Guided tour */
  .ts-tour-layer { position: fixed; inset: 0; z-index: 80; }
  .ts-tour-spot {
    position: fixed; border-radius: 14px;
    box-shadow: 0 0 0 9999px rgba(15,23,42,0.58), 0 0 0 3px rgba(220,169,72,0.95);
    transition: all 0.25s ease;
    pointer-events: none;
  }
  .ts-tour-dim { position: fixed; inset: 0; background: rgba(15,23,42,0.58); }
  .ts-tour-card {
    position: fixed; z-index: 81;
    width: min(340px, calc(100vw - 32px));
    padding: 20px;
    border-radius: 18px;
    background: linear-gradient(180deg, #FFFFFF 0%, #FAF8F3 100%);
    border: 1px solid rgba(227,223,210,0.95);
    box-shadow: 0 22px 50px rgba(15,23,42,0.35);
    transition: top 0.25s ease, left 0.25s ease;
  }
  @media (prefers-reduced-motion: reduce) { .ts-tour-spot, .ts-tour-card { transition: none; } }
  .ts-tour-dots { display: flex; gap: 6px; }
  .ts-tour-dots > span { width: 7px; height: 7px; border-radius: 999px; background: #E3DFD2; }
  .ts-tour-dots > span[data-on="1"] { background: #24406B; width: 18px; }

  /* Larger small text for first-time users (student side only) */
  .ts-student .text-xs { font-size: 0.8125rem; line-height: 1.35rem; }
  .ts-student .text-sm { line-height: 1.45rem; }

  .ts-sidebar-avatar {
    width: 34px; height: 34px;
    border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 600;
    color: #FAF8F3;
    background: linear-gradient(180deg, #DCA948 0%, #B8872B 100%);
    box-shadow: 0 1px 3px rgba(31,41,55,0.3), inset 0 1px 0 rgba(255,255,255,0.4);
  }

  /* Stepper badges */
  .ts-step-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    transition: all 200ms ease;
  }
  .ts-step-badge-upcoming {
    background: rgba(91,100,116,0.10);
    color: #5B6474;
    box-shadow: inset 0 1px 2px rgba(31,41,55,0.08);
  }
  .ts-step-badge-current {
    width: 38px;
    height: 38px;
    color: #fff;
    background: linear-gradient(180deg, #3E5D8F 0%, #24406B 60%, #17294A 100%);
    box-shadow: 0 4px 10px rgba(23,41,74,0.35), inset 0 1px 0 rgba(255,255,255,0.4);
  }
  .ts-step-badge-done {
    color: #fff;
    background: linear-gradient(180deg, #6FA08C 0%, #4F7A6A 60%, #395C4E 100%);
    box-shadow: 0 2px 6px rgba(79,122,106,0.35), inset 0 1px 0 rgba(255,255,255,0.4);
  }
  .ts-step-connector { height: 2px; flex: 1; background: #E3DFD2; border-radius: 2px; }
  .ts-step-connector-done { background: linear-gradient(90deg, #4F7A6A, rgba(79,122,106,0.5)); }

  /* Selectable document cards */
  .ts-select-card {
    position: relative;
    width: 100%;
    text-align: left;
    border-radius: 14px;
    background: linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(250,248,243,0.70) 100%);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1.5px solid rgba(255,255,255,0.65);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 12px 26px -18px rgba(31,41,55,0.26);
    transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, background 150ms ease;
  }
  .ts-select-card:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 18px 34px -18px rgba(31,41,55,0.3); }
  .ts-select-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }
  /* A paused document: readable, visibly not choosable. */
  .ts-select-card:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: inset 0 1px 0 rgba(255,255,255,0.85); }
  .ts-select-card-selected {
    border-color: rgba(36,64,107,0.55);
    background: linear-gradient(165deg, rgba(255,255,255,0.95) 0%, rgba(234,240,248,0.88) 100%);
    box-shadow: 0 0 0 3px rgba(36,64,107,0.14), inset 0 1px 0 rgba(255,255,255,0.9), 0 16px 30px -18px rgba(31,41,55,0.3);
  }
  .ts-select-card-check {
    position: absolute;
    top: 12px; right: 12px;
    width: 22px; height: 22px;
    border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    color: #fff;
    background: linear-gradient(180deg, #3E5D8F, #24406B);
    box-shadow: 0 1px 3px rgba(23,41,74,0.4);
  }

  /* On/off switch */
  .ts-switch-wrap { position: relative; display: inline-flex; width: 46px; height: 26px; flex-shrink: 0; cursor: pointer; }
  .ts-switch-input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .ts-switch-track {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 999px;
    background: rgba(31,41,55,0.14);
    box-shadow: inset 0 2px 4px rgba(31,41,55,0.22);
    transition: background 200ms ease, box-shadow 200ms ease;
  }
  .ts-switch-input:checked + .ts-switch-track {
    background: linear-gradient(180deg, #3E5D8F, #24406B);
    box-shadow: inset 0 1px 2px rgba(15,23,42,0.3);
  }
  .ts-switch-input:focus-visible + .ts-switch-track { box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }
  .ts-switch-thumb {
    position: absolute;
    top: 3px; left: 3px;
    /* Clicks pass through to the checkbox underneath, or tapping the knob itself would do nothing. */
    pointer-events: none;
    width: 20px; height: 20px;
    border-radius: 999px;
    background: linear-gradient(180deg, #FFFFFF, #F1EEE6);
    box-shadow: 0 1px 3px rgba(31,41,55,0.3), inset 0 1px 0 #fff;
    transition: transform 200ms cubic-bezier(0.22, 0.9, 0.3, 1);
  }
  .ts-switch-input:checked ~ .ts-switch-thumb { transform: translateX(20px); }

  /* Gold-tinted glass warning card */
  .ts-warning-card {
    border-radius: 14px;
    background: linear-gradient(165deg, rgba(184,135,43,0.16) 0%, rgba(184,135,43,0.06) 100%);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border: 1px solid rgba(184,135,43,0.38);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 22px -16px rgba(184,135,43,0.4);
    color: #6B4E17;
  }

  /* Review summary rows */
  .ts-review-row { padding: 0.9rem 0; }
  .ts-review-row + .ts-review-row { border-top: 1px solid #E3DFD2; }
  .ts-review-label { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #5B6474; }
  .ts-review-value { color: #1F2937; font-weight: 600; margin-top: 2px; }

  /* File upload dropzone */
  .ts-file-drop {
    border-radius: 12px;
    border: 1.5px dashed rgba(36,64,107,0.35);
    background: rgba(255,255,255,0.5);
    transition: border-color 150ms ease, background 150ms ease;
  }
  .ts-file-drop:hover { border-color: rgba(36,64,107,0.55); background: rgba(255,255,255,0.7); }
  .ts-file-drop-filled { border-style: solid; border-color: rgba(79,122,106,0.5); background: rgba(79,122,106,0.06); }
  .ts-file-drop-error { border-color: rgba(220,38,38,0.55); background: rgba(220,38,38,0.04); }

  /* Filter tabs */
  .ts-filter-tab {
    border-radius: 999px;
    padding: 0.45rem 0.95rem;
    font-size: 13px;
    font-weight: 500;
    color: #5B6474;
    background: rgba(91,100,116,0.08);
    border: 1px solid rgba(91,100,116,0.12);
    box-shadow: inset 0 1px 2px rgba(31,41,55,0.05);
    transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
    white-space: nowrap;
  }
  .ts-filter-tab:hover { color: #1F2937; background: rgba(91,100,116,0.15); }
  .ts-filter-tab:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }
  .ts-filter-tab-active {
    color: #fff;
    background: linear-gradient(180deg, #3E5D8F 0%, #24406B 60%, #17294A 100%);
    border-color: rgba(23,41,74,0.5);
    box-shadow: 0 3px 8px rgba(23,41,74,0.3), inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .ts-filter-tab-active:hover { color: #fff; background: linear-gradient(180deg, #3E5D8F 0%, #24406B 60%, #17294A 100%); }

  /* Ticket card: a coloured stub, a dashed seam, and two punch notches clipped by the card's overflow. */
  .ts-ticket {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    border-radius: 14px;
    overflow: hidden;
    background: linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(250,248,243,0.70) 100%);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.65);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px -18px rgba(31,41,55,0.26);
    transition: transform 150ms ease, box-shadow 150ms ease;
  }
  .ts-ticket-clickable { cursor: pointer; }
  .ts-ticket-clickable:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 20px 38px -18px rgba(31,41,55,0.3); }
  .ts-ticket-clickable:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }

  .ts-ticket-stub {
    flex-shrink: 0;
    width: 104px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem 0.5rem;
    text-align: center;
    background: linear-gradient(180deg, #3E5D8F 0%, #24406B 60%, #17294A 100%);
    color: #fff;
  }
  .ts-ticket-stub-code { font-weight: 600; font-size: 1rem; line-height: 1.2; }
  .ts-ticket-stub-label {
    margin-top: 5px;
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
  }

  .ts-ticket-body {
    position: relative;
    flex: 1;
    min-width: 0;
    padding: 1rem 1.25rem 1rem 1.5rem;
    border-left: 2px dashed rgba(31,41,55,0.18);
  }
  .ts-ticket-body::before,
  .ts-ticket-body::after {
    content: '';
    position: absolute;
    left: -9px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #FAF8F3;
  }
  .ts-ticket-body::before { top: -9px; }
  .ts-ticket-body::after { bottom: -9px; }

  .ts-ticket-steps { display: flex; align-items: center; margin-top: 0.85rem; }
  .ts-ticket-step-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    flex-shrink: 0;
    background: rgba(91,100,116,0.22);
    box-shadow: inset 0 1px 1px rgba(31,41,55,0.1);
  }
  .ts-ticket-step-dot-done { background: linear-gradient(180deg, #6FA08C, #4F7A6A); box-shadow: 0 1px 2px rgba(79,122,106,0.4); }
  .ts-ticket-step-dot-current {
    width: 12px;
    height: 12px;
    background: linear-gradient(180deg, #3E5D8F, #24406B);
    box-shadow: 0 0 0 3px rgba(36,64,107,0.16), 0 1px 3px rgba(23,41,74,0.4);
  }
  .ts-ticket-step-line { flex: 1; height: 2px; background: #E3DFD2; margin: 0 3px; border-radius: 2px; }
  .ts-ticket-step-line-done { background: linear-gradient(90deg, #4F7A6A, rgba(79,122,106,0.45)); }

  .ts-ticket-rejected-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(180deg, #E0685A, #B91C1C);
    box-shadow: 0 1px 2px rgba(185,28,28,0.4);
    flex-shrink: 0;
  }

  /* Cancelled by the student: greyed out and ended, deliberately unlike a progress line that has stalled. */
  .ts-ticket-cancelled .ts-ticket-stub { background: linear-gradient(180deg, #A3AAB5 0%, #858D9B 60%, #6B7381 100%); }
  .ts-ticket-cancelled .ts-ticket-stub-label { color: rgba(255,255,255,0.75); }
  .ts-ticket-cancelled-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    border: 2px solid rgba(91,100,116,0.55);
    flex-shrink: 0;
  }

  .ts-ticket-detail { border-top: 1px solid #E3DFD2; padding: 1.1rem 1.5rem 1.25rem; }
  /* Stacks on phones so the download button keeps a full-width tap target. */
  .ts-ticket-actions {
    margin-top: 1rem;
    padding-top: 0.85rem;
    border-top: 1px solid #E3DFD2;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.65rem;
  }
  @media (min-width: 640px) {
    .ts-ticket-actions { flex-direction: row; align-items: center; justify-content: space-between; gap: 1.25rem; }
  }

  /* Neutral tags for fees and purposes, distinct from the status pills. */
  .ts-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 500;
    color: #24406B;
    background: rgba(36,64,107,0.08);
    border: 1px solid rgba(36,64,107,0.16);
    white-space: nowrap;
  }
  .ts-tag-sage { color: #33574A; background: rgba(79,122,106,0.10); border-color: rgba(79,122,106,0.24); }

  /* Credential Guide catalogue card */
  .ts-guide-card {
    text-align: left;
    width: 100%;
    border-radius: 14px;
    background: linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(250,248,243,0.70) 100%);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.65);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 12px 26px -18px rgba(31,41,55,0.26);
    transition: transform 150ms ease, box-shadow 150ms ease;
  }
  .ts-guide-card:hover { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 18px 34px -18px rgba(31,41,55,0.3); }
  .ts-guide-card:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }

  /* Modal overlay */
  .ts-modal-overlay {
    position: fixed;
    inset: 0;
    /* Above the help button (50) as well as the bottom nav, as the phone rule already was. */
    z-index: 60;
    background: rgba(23,41,74,0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .ts-modal-panel {
    position: relative;
    width: 100%;
    max-width: 560px;
    max-height: 88vh;
    overflow-y: auto;
    border-radius: 16px;
    background: linear-gradient(165deg, rgba(250,248,243,0.98) 0%, rgba(245,242,235,0.96) 100%);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.7);
    box-shadow: 0 30px 60px -20px rgba(15,23,42,0.45), inset 0 1px 0 rgba(255,255,255,0.85);
  }
  .ts-modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #5B6474;
    background: rgba(91,100,116,0.08);
    transition: color 150ms ease, background 150ms ease;
  }
  .ts-modal-close:hover { color: #1F2937; background: rgba(91,100,116,0.16); }
  .ts-modal-close:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }

  /* More tag variants */
  .ts-tag-gold { color: #6B4E17; background: rgba(184,135,43,0.12); border-color: rgba(184,135,43,0.28); }
  .ts-tag-muted { color: #5B6474; background: rgba(91,100,116,0.08); border-color: rgba(91,100,116,0.18); }

  /* Small gold "today" pill */
  .ts-date-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: #6B4E17;
    background: linear-gradient(180deg, rgba(220,169,72,0.28) 0%, rgba(184,135,43,0.14) 100%);
    border: 1px solid rgba(184,135,43,0.35);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
    white-space: nowrap;
  }

  /* Small list-row avatar */
  .ts-avatar-sm {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: #FAF8F3;
    background: linear-gradient(180deg, #DCA948 0%, #B8872B 100%);
    box-shadow: 0 1px 3px rgba(31,41,55,0.3), inset 0 1px 0 rgba(255,255,255,0.4);
    flex-shrink: 0;
  }

  /* Registrar sidebar: the student structure in charcoal and gold, so the two roles are unmistakable. */
  .ts-staff-sidebar {
    background: linear-gradient(180deg, #3A3A3E 0%, #232326 55%, #17171A 100%);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 6px 0 28px -14px rgba(0,0,0,0.5);
  }
  .ts-staff-nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: rgba(250,248,243,0.55);
    border-radius: 10px;
    transition: color 150ms ease, background 150ms ease;
  }
  .ts-staff-nav-item:hover { color: #FAF8F3; background: rgba(255,255,255,0.07); }
  .ts-staff-nav-item:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }
  .ts-staff-nav-item-active {
    color: #FAF8F3;
    background: linear-gradient(180deg, rgba(184,135,43,0.22) 0%, rgba(184,135,43,0.05) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.18),
      inset 0 0 0 1px rgba(184,135,43,0.28),
      0 2px 10px rgba(0,0,0,0.35);
  }
  .ts-staff-nav-item-active::before {
    content: '';
    position: absolute;
    left: -3px;
    top: 20%;
    bottom: 20%;
    width: 3px;
    border-radius: 2px;
    background: linear-gradient(180deg, #E4B45C, #B8872B);
  }
  .ts-staff-sidebar-footer { border-top: 1px solid rgba(255,255,255,0.10); }

  .ts-staff-mobile-header {
    background: rgba(35,35,38,0.94);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }

  /* Interactive calendar day buttons */
  .ts-cal-day-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }
  .ts-cal-day-btn:hover:not(.ts-cal-day-today):not(.ts-cal-day-selected) { background: rgba(36,64,107,0.08); }
  .ts-cal-day-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }
  .ts-cal-day-selected {
    color: #fff;
    font-weight: 600;
    background: linear-gradient(180deg, #3E5D8F 0%, #24406B 100%);
    box-shadow: 0 2px 6px rgba(23,41,74,0.4), inset 0 1px 0 rgba(255,255,255,0.35);
  }
  .ts-cal-nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    color: #5B6474;
    background: rgba(91,100,116,0.08);
    transition: color 150ms ease, background 150ms ease;
  }
  .ts-cal-nav-btn:hover { color: #1F2937; background: rgba(91,100,116,0.16); }
  .ts-cal-nav-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }

  /* Compact list cards inside a panel */
  .ts-slot-card {
    border-radius: 12px;
    background: rgba(255,255,255,0.55);
    border: 1px solid #E3DFD2;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
  }
  .ts-icon-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    color: #5B6474;
    background: rgba(91,100,116,0.08);
    transition: color 150ms ease, background 150ms ease;
  }
  .ts-icon-chip:hover { color: #1F2937; background: rgba(91,100,116,0.16); }
  .ts-icon-chip:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }

  /* Sage and outline-danger buttons: the primary button's construction in other palettes */
  .ts-btn-sage {
    color: #fff;
    border-radius: 10px;
    background: linear-gradient(180deg, #6FA08C 0%, #4F7A6A 55%, #395C4E 100%);
    border: 1px solid rgba(57,92,78,0.6);
    border-top-color: rgba(255,255,255,0.45);
    box-shadow: 0 8px 18px rgba(57,92,78,0.32), 0 2px 4px rgba(57,92,78,0.24), inset 0 1px 0 rgba(255,255,255,0.35);
    text-shadow: 0 1px 1px rgba(0,0,0,0.28);
    transition: box-shadow 150ms ease, transform 80ms ease, filter 150ms ease;
  }
  .ts-btn-sage:hover:not(:disabled) { filter: brightness(1.07); }
  .ts-btn-sage:active:not(:disabled) { transform: translateY(1px); box-shadow: inset 0 3px 8px rgba(0,0,0,0.35); }
  .ts-btn-sage:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.65), 0 8px 18px rgba(57,92,78,0.32); }
  .ts-btn-sage:disabled { opacity: 0.6; cursor: not-allowed; filter: saturate(0.85); }

  .ts-btn-outline-danger {
    color: #B91C1C;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.62) 100%);
    border: 1px solid rgba(185,28,28,0.4);
    box-shadow: 0 2px 5px rgba(31,41,55,0.1), inset 0 1px 0 rgba(255,255,255,0.9);
    transition: background 150ms ease, box-shadow 150ms ease, transform 80ms ease;
  }
  .ts-btn-outline-danger:hover:not(:disabled) { background: rgba(185,28,28,0.07); }
  .ts-btn-outline-danger:active:not(:disabled) { transform: translateY(1px); }
  .ts-btn-outline-danger:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }
  .ts-btn-outline-danger:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Loading, empty and motion */

  /* Skeletons read as unlit glass; the sweep is a transform, which stays smooth on long lists. */
  .ts-skeleton {
    position: relative;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(236,232,221,0.95) 0%, rgba(228,223,210,0.9) 100%);
    border-radius: 8px;
  }
  .ts-skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0) 0%,
      rgba(255,255,255,0.38) 45%,
      rgba(255,255,255,0.62) 55%,
      rgba(255,255,255,0) 100%
    );
    animation: ts-sweep 1.5s ease-in-out infinite;
  }
  @keyframes ts-sweep { to { transform: translateX(100%); } }

  /* Keeps the card's glass edge, so the page doesn't change shape when data lands. */
  .ts-skeleton-card {
    position: relative;
    border-radius: 14px;
    background: linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(250,248,243,0.70) 100%);
    border: 1px solid rgba(255,255,255,0.65);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px -18px rgba(31,41,55,0.26);
  }

  /* Error states: a warm red edge, so failed never looks like the calm blue empty state. */
  .ts-error-state {
    border-top: 3px solid rgba(185,28,28,0.55);
  }
  .ts-error-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 999px;
    color: #B91C1C;
    background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(254,236,236,0.95) 100%);
    border: 1px solid rgba(220,38,38,0.28);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 12px -6px rgba(185,28,28,0.3);
  }
  .ts-error-icon > svg { width: 22px; height: 22px; }
  .ts-error-state-inline {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 16px;
    border-radius: 12px;
    background: rgba(220,38,38,0.06);
    border: 1px solid rgba(220,38,38,0.28);
    color: #991B1B;
  }


  .ts-empty-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 999px;
    color: #24406B;
    background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(236,240,246,0.9) 100%);
    border: 1px solid rgba(227,223,210,0.95);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 12px -6px rgba(31,41,55,0.25);
  }
  .ts-empty-icon > svg { width: 22px; height: 22px; }


  /* Success seal: circle drawn, then the tick */
  .ts-seal-circle {
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    animation: ts-draw 0.42s ease-out forwards;
  }
  .ts-seal-check {
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    animation: ts-draw 0.26s ease-out 0.34s forwards;
  }
  @keyframes ts-draw { to { stroke-dashoffset: 0; } }

  /* The page wrapper fades but must never transform: any ancestor transform breaks position: fixed for the toast, nav and help button. */
  .ts-page-enter { animation: ts-page-fade 0.22s ease-out both; }
  @keyframes ts-page-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  /* The rise lives on the page content, which never contains a fixed element. */
  .ts-page-enter main { animation: ts-page-rise 0.24s ease-out both; }
  @keyframes ts-page-rise {
    from { opacity: 0; transform: translateY(7px); }
    to   { opacity: 1; transform: none; }
  }
  .ts-step-enter-fwd { animation: ts-step-fwd 0.24s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
  .ts-step-enter-back { animation: ts-step-back 0.24s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
  @keyframes ts-step-fwd {
    from { opacity: 0; transform: translateX(22px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes ts-step-back {
    from { opacity: 0; transform: translateX(-22px); }
    to   { opacity: 1; transform: none; }
  }

  /* The bell, when something new arrives */
  .ts-bell-ring { animation: ts-ring 0.7s ease-in-out; transform-origin: 50% 12%; }
  @keyframes ts-ring {
    0%, 100% { transform: rotate(0); }
    12% { transform: rotate(-13deg); }
    26% { transform: rotate(11deg); }
    40% { transform: rotate(-8deg); }
    54% { transform: rotate(6deg); }
    68% { transform: rotate(-3deg); }
  }

  /* Every clickable card presses in on click. */
  .ts-select-card:active, .ts-guide-card:active, .ts-card-hoverable:active {
    transform: translateY(1px);
    box-shadow: inset 0 3px 9px rgba(31,41,55,0.15), inset 0 -1px 0 rgba(255,255,255,0.45);
  }
  .ts-card-hoverable { transition: transform 150ms ease, box-shadow 150ms ease; }

  /* Interactive rows lift the same way cards do. */
  .ts-row-hover { transition: background 150ms ease, transform 150ms ease, box-shadow 150ms ease; }
  .ts-row-hover:hover {
    background: rgba(36,64,107,0.045);
    box-shadow: inset 3px 0 0 rgba(184,135,43,0.55);
  }
  .ts-row-hover:active { background: rgba(36,64,107,0.07); }

  /* Reduced motion switches off everything above */
  @media (prefers-reduced-motion: reduce) {
    .ts-skeleton::after { animation: none; }
    .ts-seal-circle, .ts-seal-check { animation: none; stroke-dashoffset: 0; }
    .ts-page-enter, .ts-page-enter main, .ts-step-enter-fwd, .ts-step-enter-back, .ts-bell-ring { animation: none; }
    .ts-card-hoverable:hover, .ts-guide-card:hover, .ts-ticket-clickable:hover, .ts-row-hover:hover {
      transform: none;
    }
  }

  /* Release calendar */
  .ts-relcal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .ts-relcal-weekday {
    padding-bottom: 4px;
    text-align: center;
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    color: #5B6474;
  }
  .ts-relcal-day {
    position: relative;
    aspect-ratio: 1 / 1;
    min-height: 44px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 12px;
    border: 1px solid transparent;
    background: transparent;
    color: #1F2937;
    font-size: 14px; font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
  }
  .ts-relcal-day:hover { background: rgba(36,64,107,0.05); }
  /* A day with releases reads as a raised tile. */
  .ts-relcal-day.has-releases {
    background: linear-gradient(165deg, rgba(255,255,255,0.96) 0%, rgba(250,248,243,0.82) 100%);
    border-color: rgba(227,223,210,0.95);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 5px 12px -7px rgba(31,41,55,0.3);
  }
  .ts-relcal-day.is-selected {
    background: linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(234,240,248,0.92) 100%);
    border-color: rgba(36,64,107,0.55);
    box-shadow: 0 0 0 3px rgba(36,64,107,0.15), inset 0 1px 0 rgba(255,255,255,0.9);
  }
  .ts-relcal-day:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }
  .ts-relcal-num {
    width: 30px; height: 30px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .ts-relcal-day.is-today .ts-relcal-num {
    color: #FAF8F3; font-weight: 600;
    background: linear-gradient(180deg, #DCA948 0%, #B8872B 100%);
    box-shadow: 0 1px 3px rgba(31,41,55,0.3), inset 0 1px 0 rgba(255,255,255,0.5);
  }
  .ts-relcal-count {
    position: absolute; top: 4px; right: 4px;
    min-width: 19px; height: 19px; padding: 0 5px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; line-height: 1;
    color: #FAF8F3;
    background: linear-gradient(180deg, #3E5D8F 0%, #24406B 100%);
    box-shadow: 0 1px 3px rgba(23,41,74,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .ts-relcal-count-legend { position: static; flex-shrink: 0; }
  .ts-relcal-nav {
    width: 40px; height: 40px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 10px;
    color: #24406B;
    background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.62) 100%);
    border: 1px solid #E3DFD2;
    box-shadow: 0 2px 5px rgba(31,41,55,0.1), inset 0 1px 0 rgba(255,255,255,0.95);
    cursor: pointer;
  }
  .ts-relcal-nav:hover { background: #FFFFFF; }
  .ts-relcal-nav:active { transform: translateY(1px); box-shadow: inset 0 2px 5px rgba(31,41,55,0.18); }
  .ts-relcal-nav:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }

  /* The dashboard's mini version: same drawing, smaller. */
  .ts-relcal-mini .ts-relcal-grid { gap: 3px; }
  .ts-relcal-mini .ts-relcal-weekday { font-size: 10px; }
  .ts-relcal-mini .ts-relcal-day { min-height: 34px; border-radius: 9px; font-size: 12px; }
  .ts-relcal-mini .ts-relcal-num { width: 24px; height: 24px; }
  .ts-relcal-mini .ts-relcal-count { top: 1px; right: 1px; min-width: 15px; height: 15px; padding: 0 3px; font-size: 9.5px; }

  /* Phone overrides, deliberately last: media queries add no specificity, so source order makes them win. */
  /* Phone touch targets */
  @media (max-width: 767px) {
    .ts-filter-tab { min-height: 44px; }
    .ts-icon-btn { height: 44px; min-width: 44px; }
    .ts-help-fab {
      /* Clear of the bottom bar rather than floating on top of it. */
      right: 16px;
      bottom: calc(56px + 14px + env(safe-area-inset-bottom, 0px));
      height: 48px;
    }
    /* Phone modals become full-height sheets above the bottom nav and help button. */
    .ts-modal-overlay { padding: 0; align-items: flex-end; z-index: 60; }
    .ts-modal-panel {
      max-width: none;
      height: 100dvh;
      max-height: 100dvh;
      border-radius: 0;
      border-left: none;
      border-right: none;
    }
    .ts-modal-close { top: 0.75rem; right: 0.75rem; width: 40px; height: 40px; }
  }

  /* Below ~400px the ticket stub becomes a header strip. */
  @media (max-width: 400px) {
    .ts-ticket-clickable { flex-direction: column; }
    .ts-ticket-stub {
      width: 100%;
      flex-direction: row;
      align-items: baseline;
      justify-content: space-between;
      padding: 0.6rem 1rem;
      text-align: left;
    }
    .ts-ticket-stub-label { margin-top: 0; }
    .ts-ticket-body {
      border-left: none;
      border-top: 2px dashed rgba(31,41,55,0.18);
      padding: 0.9rem 1rem;
    }
    /* The seam notches are drawn for a vertical perforation. */
    .ts-ticket-body::before, .ts-ticket-body::after { display: none; }
  }

  @media (max-width: 767px) {
    /* The 20px "?" chips get a 46px hit area without looking bigger. */
    .ts-helptip-btn::after { content: ''; position: absolute; inset: -13px; }

    /* Only standalone links are padded out; an inline-flex link mid-sentence would stop wrapping. */
    a.ts-tap, button.ts-tap {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }

    /* At 112px the avatar takes a fifth of a 360px screen. */
    .ts-avatar-xl, .ts-avatar-frame { width: 96px; height: 96px; }
    .ts-avatar-xl { font-size: 32px; }
    /* Bigger for a thumb, and pushed out to cover less of the smaller photo. */
    .ts-avatar-edit { width: 44px; height: 44px; right: -6px; bottom: -6px; }
  }
`;
