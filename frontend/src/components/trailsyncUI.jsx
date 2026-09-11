import { useEffect, useRef, useState } from 'react';

// Shared TrailSync visual system: the gradient-fade glass scene, the
// skeuomorphic control styling, and the icons. Both LoginPage and
// CreateAccountPage import from here so the two screens can't drift apart.

export const FONT_SERIF = { fontFamily: "'Source Serif 4', ui-serif, Georgia, serif" };
export const FONT_SANS = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" };

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="ts-icon-svg h-5 w-5" aria-hidden="true">
      <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="ts-icon-svg h-5 w-5" aria-hidden="true">
      <path d="M2.5 2.5l15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.3 4.3c.55-.13 1.12-.2 1.7-.2 5.5 0 8.5 6 8.5 6-.5 1-1.4 2.4-2.7 3.6M5.6 5.9C3.2 7.4 1.5 10 1.5 10s3 6 8.5 6c1.1 0 2.1-.24 3-.63" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.1 8.2a2.5 2.5 0 0 0 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-90" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="ts-icon-svg h-4 w-4" aria-hidden="true">
      <path d="M5.5 8l4.5 4.5L14.5 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckSealIcon() {
  return (
    <svg viewBox="0 0 44 44" fill="none" className="h-11 w-11" aria-hidden="true">
      <circle cx="22" cy="22" r="20" fill="rgba(79,122,106,0.14)" stroke="rgba(79,122,106,0.5)" strokeWidth="1.5" />
      <path d="M13.5 22.5l6 6 11-13" stroke="#4F7A6A" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Text-color/link utilities used on both the glass auth pages and the plain
// paper app-shell pages (dashboard etc.) — defined once so the two contexts
// can't drift to slightly different shades of "ink".
const COLOR_UTIL_CSS = `
  .ts-ink { color: #1F2937; }
  .ts-soft { color: #5B6474; }
  .ts-sage { color: #4F7A6A; }
  .ts-gold { color: #B8872B; }
  .ts-rule { height: 2px; width: 46px; border-radius: 2px; background: linear-gradient(90deg, #B8872B, rgba(184,135,43,0.12)); }
  .ts-link { color: #24406B; text-decoration: none; border-radius: 4px; }
  .ts-link:hover { text-decoration: underline; }
  .ts-link:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }
  .ts-error-text { color: #B91C1C; }
  .ts-hairline { background: #E3DFD2; }

  .ts-banner { border-radius: 10px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.7); }
  .ts-banner-error { background: rgba(220,38,38,0.10); border: 1px solid rgba(220,38,38,0.35); color: #991B1B; }
  .ts-banner-pending { background: rgba(184,135,43,0.14); border: 1px solid rgba(184,135,43,0.45); color: #6B4E17; }
  .ts-banner-success { background: rgba(79,122,106,0.12); border: 1px solid rgba(79,122,106,0.42); color: #33574A; }

  /* Neutral informational note — distinct from error/success/pending, e.g.
     "You'll need: ..." under a Request a Form dropdown. */
  .ts-info-note {
    border-radius: 10px;
    background: rgba(36,64,107,0.05);
    border: 1px solid rgba(36,64,107,0.15);
    color: #24406B;
  }
`;

// Form-control skeuomorphic styling (inputs, selects, checkboxes, toggle
// switch, primary/glass buttons) — shared between the auth pages (glass over
// photo) and app-shell pages (opaque cards on paper), since none of these
// rules reference the photo/backdrop, only rgba overlays that read the same
// on both. One definition, included in both SHARED_CSS and APP_CSS, so a
// tweak to how an input looks never has to be made twice.
const FORM_CONTROL_CSS = `
  /* On phones: iOS Safari zooms the whole page when a field under 16px gets
     focus, leaving a first-time user scrolled sideways mid-form. Element +
     class so it outranks Tailwind's text-sm on the same input. And 44px is
     the smallest tap target people hit reliably with a thumb. */
  @media (max-width: 639px) {
    input.ts-input, select.ts-input, textarea.ts-input { font-size: 16px; }
    .ts-btn-primary, .ts-btn-glass, .ts-btn-sage, .ts-btn-outline-danger { min-height: 44px; }
  }

  /* Carved into the glass: inner shadow from the top, bright lip. */
  .ts-input {
    color: #1F2937;
    background: rgba(255,255,255,0.62);
    border-radius: 10px;
    border: 1px solid #E3DFD2;
    border-top-color: rgba(255,255,255,0.95);
    box-shadow:
      inset 0 2px 4px rgba(31,41,55,0.14),
      inset 0 -1px 0 rgba(255,255,255,0.85),
      0 1px 0 rgba(255,255,255,0.6);
    transition: box-shadow 150ms ease, border-color 150ms ease, background 150ms ease;
  }
  .ts-input::placeholder { color: rgba(91,100,116,0.7); }
  .ts-input:focus {
    outline: none;
    background: rgba(255,255,255,0.82);
    border-color: rgba(184,135,43,0.75);
    box-shadow: inset 0 2px 4px rgba(31,41,55,0.12), 0 0 0 3px rgba(184,135,43,0.5);
  }
  .ts-input-error {
    border-color: rgba(185,28,28,0.5);
    box-shadow: inset 0 2px 4px rgba(185,28,28,0.20), inset 0 -1px 0 rgba(255,255,255,0.7);
  }
  .ts-select {
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
  }

  .ts-icon-btn { color: #5B6474; background: transparent; border-radius: 8px; transition: color 150ms ease; }
  .ts-icon-btn:hover { color: #1F2937; }
  .ts-icon-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.55); }
  .ts-icon-svg { filter: drop-shadow(0 1px 0 rgba(255,255,255,0.9)); }

  .ts-checkbox-wrap { position: relative; display: inline-flex; width: 20px; height: 20px; flex-shrink: 0; }
  .ts-checkbox-input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  /* pointer-events:none so clicks reach the real input underneath. */
  .ts-checkbox-well {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 6px;
    background: rgba(255,255,255,0.7);
    border: 1px solid #E3DFD2;
    box-shadow: inset 0 2px 4px rgba(31,41,55,0.20), inset 0 -1px 0 rgba(255,255,255,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
  }
  .ts-checkbox-input:checked + .ts-checkbox-well {
    background: linear-gradient(180deg, #DCA948 0%, #B8872B 55%, #8C6620 100%);
    border-color: #8C6620;
    box-shadow: 0 1px 3px rgba(31,41,55,0.32), inset 0 1px 0 rgba(255,255,255,0.65);
  }
  .ts-checkbox-input:focus-visible + .ts-checkbox-well {
    box-shadow: 0 0 0 3px rgba(184,135,43,0.55), inset 0 2px 4px rgba(31,41,55,0.20);
  }
  .ts-checkbox-input:disabled + .ts-checkbox-well { opacity: 0.55; }
  .ts-checkbox-check {
    width: 12px; height: 10px;
    opacity: 0;
    transform: scale(0.6);
    transition: opacity 120ms ease, transform 120ms ease;
    filter: drop-shadow(0 1px 0.5px rgba(140,102,32,0.7));
  }
  .ts-checkbox-input:checked + .ts-checkbox-well .ts-checkbox-check { opacity: 1; transform: scale(1); }

  .ts-toggle-track {
    position: relative;
    border-radius: 999px;
    padding: 4px;
    background: rgba(31,41,55,0.08);
    border: 1px solid rgba(31,41,55,0.06);
    box-shadow: inset 0 2px 5px rgba(31,41,55,0.16), inset 0 -1px 0 rgba(255,255,255,0.75);
  }
  .ts-toggle-thumb {
    position: absolute;
    top: 4px; bottom: 4px; left: 4px;
    width: calc(50% - 4px);
    border-radius: 999px;
    background: linear-gradient(180deg, #FFFFFF 0%, #F6F3EB 100%);
    border: 1px solid rgba(255,255,255,0.9);
    box-shadow: 0 2px 6px rgba(31,41,55,0.26), 0 1px 1px rgba(31,41,55,0.12), inset 0 1px 0 #FFFFFF;
    transition: transform 260ms cubic-bezier(0.22, 0.9, 0.3, 1);
  }
  .ts-toggle-btn {
    position: relative;
    z-index: 1;
    border-radius: 999px;
    color: #5B6474;
    transition: color 200ms ease;
  }
  .ts-toggle-btn:hover { color: #1F2937; }
  .ts-toggle-btn-active { color: #24406B; }
  .ts-toggle-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }

  .ts-btn-primary {
    color: #fff;
    border-radius: 10px;
    background: linear-gradient(180deg, #3E5D8F 0%, #24406B 55%, #17294A 100%);
    border: 1px solid rgba(23,41,74,0.6);
    border-top-color: rgba(255,255,255,0.45);
    box-shadow:
      0 8px 18px rgba(23,41,74,0.32),
      0 2px 4px rgba(23,41,74,0.24),
      inset 0 1px 0 rgba(255,255,255,0.35);
    text-shadow: 0 1px 1px rgba(0,0,0,0.28);
    transition: box-shadow 150ms ease, transform 80ms ease, filter 150ms ease;
  }
  .ts-btn-primary:hover:not(:disabled) { filter: brightness(1.07); }
  .ts-btn-primary:active:not(:disabled) {
    background: linear-gradient(180deg, #17294A 0%, #24406B 50%, #3E5D8F 100%);
    box-shadow: inset 0 3px 8px rgba(0,0,0,0.42), inset 0 -1px 0 rgba(255,255,255,0.15);
    transform: translateY(1px);
  }
  .ts-btn-primary:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(184,135,43,0.65), 0 8px 18px rgba(23,41,74,0.32);
  }
  .ts-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; filter: saturate(0.85); }

  .ts-btn-glass {
    color: #24406B;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.62) 100%);
    border: 1px solid #E3DFD2;
    border-top-color: rgba(255,255,255,1);
    box-shadow: 0 2px 5px rgba(31,41,55,0.12), inset 0 1px 0 rgba(255,255,255,0.95);
    transition: background 150ms ease, box-shadow 150ms ease, transform 80ms ease;
  }
  .ts-btn-glass:hover { background: linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0.8) 100%); }
  .ts-btn-glass:active { box-shadow: inset 0 2px 5px rgba(31,41,55,0.2); transform: translateY(1px); }
  .ts-btn-glass:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }
`;

export const SHARED_CSS = `
  .ts-page { position: relative; overflow-x: hidden; background: #24406B; }

  /* ONE sharp photo layer for the whole viewport. Nothing pre-blurs it —
     the glass layers below blur whatever sits behind them, so the image
     genuinely continues under the glass.
     FRAMING KNOB: background-position picks which part of the photo lands in
     the open area. Lower X% pushes a centred building rightward into the
     clear zone. Tune once the real photo is dropped in. */
  .ts-photo {
    position: fixed;
    inset: 0;
    z-index: 0;
    background-image: url('/ustp-cdo-campus.jpg'),
      linear-gradient(180deg, #A9C2DC 0%, #D8E1E8 40%, #93AC8E 66%, #4F7A6A 100%);
    background-size: cover;
    background-position: 38% center;
  }
  .ts-photo-tint {
    position: fixed;
    inset: 0;
    z-index: 0;
    background: linear-gradient(90deg, rgba(36,64,107,0.16) 0%, rgba(36,64,107,0.05) 55%, rgba(36,64,107,0.10) 100%);
  }

  /* PROGRESSIVE GLASS — the reason there is no seam.
     backdrop-filter can't be varied across an element, so three layers of
     increasing blur are stacked, each with its own mask gradient. The
     heaviest blur fades out earliest (nearest the form) and the lightest
     reaches furthest toward the photo, so blur and tint ramp up gradually
     instead of switching on at a boundary. */
  .ts-glass {
    position: absolute;
    z-index: 1;
    pointer-events: none;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
  }

  @media (min-width: 1024px) {
    /* FADE KNOB: this width plus the mask stops below decide how much of the
       photo the glass eats. Solid paper must reach ~40% (past the form text);
       everything right of ~56% should read as open photo. */
    .ts-glass { top: 0; bottom: 0; left: 0; width: 64%; }

    /* lightest blur, travels furthest right — softens only, never whitens */
    .ts-glass-a {
      backdrop-filter: blur(7px);
      -webkit-backdrop-filter: blur(7px);
      -webkit-mask-image: linear-gradient(to right, #000 0%, #000 48%, rgba(0,0,0,0) 100%);
      mask-image: linear-gradient(to right, #000 0%, #000 48%, rgba(0,0,0,0) 100%);
    }
    /* mid blur, carries the institutional-blue tint through the fade zone */
    .ts-glass-b {
      background: linear-gradient(to right,
        rgba(250,248,243,0.28) 0%,
        rgba(250,248,243,0.20) 45%,
        rgba(36,64,107,0.10) 74%,
        rgba(36,64,107,0.02) 100%);
      backdrop-filter: blur(15px) saturate(190%);
      -webkit-backdrop-filter: blur(15px) saturate(190%);
      -webkit-mask-image: linear-gradient(to right, #000 0%, #000 42%, rgba(0,0,0,0) 78%);
      mask-image: linear-gradient(to right, #000 0%, #000 42%, rgba(0,0,0,0) 78%);
    }
    /* heaviest blur + the paper frost the form actually sits on */
    .ts-glass-c {
      background: linear-gradient(to right,
        rgba(250,248,243,0.82) 0%,
        rgba(250,248,243,0.76) 45%,
        rgba(250,248,243,0.42) 74%,
        rgba(250,248,243,0) 100%);
      backdrop-filter: blur(26px) saturate(170%) brightness(1.03);
      -webkit-backdrop-filter: blur(26px) saturate(170%) brightness(1.03);
      -webkit-mask-image: linear-gradient(to right, #000 0%, #000 63%, rgba(0,0,0,0) 88%);
      mask-image: linear-gradient(to right, #000 0%, #000 63%, rgba(0,0,0,0) 88%);
    }
  }

  /* Narrow screens: the photo reads as a banner and the glass rises into it
     from below, fading upward on exactly the same principle. */
  @media (max-width: 1023px) {
    .ts-photo {
      background-size: auto 170%;
      background-position: 50% 74%;
    }
    .ts-glass { left: 0; right: 0; top: 18vh; bottom: 0; }

    .ts-glass-a {
      backdrop-filter: blur(7px);
      -webkit-backdrop-filter: blur(7px);
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 10%, #000 100%);
      mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 10%, #000 100%);
    }
    .ts-glass-b {
      background: linear-gradient(to bottom,
        rgba(36,64,107,0.08) 0%,
        rgba(250,248,243,0.20) 16%,
        rgba(250,248,243,0.28) 100%);
      backdrop-filter: blur(15px) saturate(190%);
      -webkit-backdrop-filter: blur(15px) saturate(190%);
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 1%, #000 13%, #000 100%);
      mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 1%, #000 13%, #000 100%);
    }
    .ts-glass-c {
      background: linear-gradient(to bottom,
        rgba(250,248,243,0) 0%,
        rgba(250,248,243,0.64) 12%,
        rgba(250,248,243,0.82) 22%,
        rgba(250,248,243,0.82) 100%);
      backdrop-filter: blur(26px) saturate(170%) brightness(1.03);
      -webkit-backdrop-filter: blur(26px) saturate(170%) brightness(1.03);
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 2%, #000 16%, #000 100%);
      mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 2%, #000 16%, #000 100%);
    }
  }

  ${COLOR_UTIL_CSS}
  ${FORM_CONTROL_CSS}
`;

/**
 * The split-screen scene both pages sit in: sharp photo on the right, glass
 * that fades into it on the left, form content directly on the glass with no
 * card. Content is passed as children.
 */
export function GlassScene({ children, maxWidth = '420px' }) {
  return (
    <div className="ts-page relative flex min-h-screen w-full flex-col lg:flex-row" style={FONT_SANS}>
      <style>{SHARED_CSS}</style>

      <div className="ts-photo" aria-hidden="true" />
      <div className="ts-photo-tint" aria-hidden="true" />
      <div className="ts-glass ts-glass-a" aria-hidden="true" />
      <div className="ts-glass ts-glass-b" aria-hidden="true" />
      <div className="ts-glass ts-glass-c" aria-hidden="true" />

      {/* Narrow viewports: photo banner across the top. */}
      <div className="h-[30vh] shrink-0 lg:hidden" aria-hidden="true" />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:w-[42%] lg:flex-none lg:px-12 lg:py-16 xl:px-16">
        <div className="mx-auto w-full" style={{ maxWidth }}>
          {children}
        </div>
      </div>

      <div className="hidden lg:block lg:flex-1" aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// App-shell pieces: for logged-in screens (dashboard, etc.), which live on
// the plain paper background rather than the auth pages' glass-over-photo
// treatment. Additive to SHARED_CSS above — GlassScene/login/signup don't
// use any of this.
// ---------------------------------------------------------------------------

export const APP_CSS = `
  ${COLOR_UTIL_CSS}
  ${FORM_CONTROL_CSS}

  /* Extremely subtle warm/sage glow behind everything — just enough that the
     glass cards have something to visibly float over. Kept at ~5% opacity
     specifically so it never competes with content. */
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

  /* ---- Sidebar: institutional-blue frosted glass, not a flat fill ---- */
  .ts-sidebar {
    background: linear-gradient(180deg, #35548F 0%, #24406B 45%, #17294A 100%);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.16),
      6px 0 28px -14px rgba(15,23,42,0.4);
  }
  /* Three visibly distinct states — inactive items are deliberately muted
     (52% opacity) so the active item reads instantly, rather than everything
     sitting at a similar near-white weight with only a faint tint apart. */
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
  /* Active = looks lit from within, not just a translucent rectangle: soft
     inset glow + top highlight + a thin gold accent bar (used sparingly,
     echoing the checkbox/focus-ring gold elsewhere in the app). */
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

  /* ---- Liquid glass cards: translucent paper over the shell's own subtle
     texture, not opaque white boxes. ---- */
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
  /* Only the stat cards lift on hover — they're informational, not pressable. */
  .ts-card-hoverable:hover {
    transform: translateY(-3px);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.9),
      0 26px 46px -22px rgba(31,41,55,0.34),
      0 4px 10px rgba(31,41,55,0.08);
  }

  /* Embossed/glowing number: a soft dark lift plus a faint institutional-blue
     halo, rather than flat serif text sitting on the glass. */
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

  /* ---- Quick action cards: same glass, but built to look pressable — they
     depress on hover already, and depress further on click, rather than
     lifting like the stat cards. ---- */
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

  /* ---- Status pills: small glossy enamel badges — a top-lit gradient +
     inner highlight instead of a flat fill. Colors per spec: Ready for
     pickup = sage, Processing (Submitted+Verified) = gold, Released = gray. ---- */
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
  /* Recessed surface for a read-only figure sitting inside a card - the
     amount owed, a booked release window. Inset shadow rather than a border
     so it reads as carved into the card instead of stacked on top of it. */
  .ts-well {
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(227,223,210,0.34) 0%, rgba(250,248,243,0.55) 100%);
    border: 1px solid rgba(227,223,210,0.9);
    box-shadow: inset 0 2px 5px rgba(31,41,55,0.07), inset 0 -1px 0 rgba(255,255,255,0.7);
  }

  /* Approved - Ready to Print. Institutional blue, because this is the one
     stage that is waiting on the student rather than on the office. */
  .ts-pill-blue {
    background: linear-gradient(180deg, rgba(36,64,107,0.22) 0%, rgba(36,64,107,0.10) 100%);
    color: #1E3559;
    border: 1px solid rgba(36,64,107,0.38);
  }
  /* Verified: Front Desk has signed off and it is with the Registrar.
     Teal rather than a second use of gold or blue, so the three
     "in the office's hands" stages stay tellable apart at a glance. */
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

  /* Toast: confirmation after a lifecycle transition. Fixed to the viewport
     foot so it stays visible after an action scrolls the page, and given the
     same glass construction as .ts-card rather than a flat notification bar. */
  .ts-toast {
    position: fixed; left: 50%; bottom: 24px; z-index: 60;
    transform: translateX(-50%);
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
  .ts-toast-error .ts-toast-accent { background: #E2857F; }
  @keyframes ts-toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) { .ts-toast { animation: none; } }

  .ts-row-hover:hover { background: rgba(36,64,107,0.03); }

  /* Soft inset line instead of a flat 1px border between rows. */
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

  /* ---- Mini calendar widget ---- */
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

  /* ---- Sidebar profile footer ---- */
  .ts-sidebar-footer { border-top: 1px solid rgba(255,255,255,0.12); }
  /* A profile photo in any avatar slot. Sits inside the same circle as
     the initials it replaces (the slot's own class supplies size and shape),
     and object-fit: cover is what keeps a non-square image from stretching. */
  .ts-avatar-photo {
    display: block;
    object-fit: cover;
    background: #E3DFD2;
  }

  /* The large avatar at the top of the Profile page. */
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

  /* Glossy camera button pinned to the avatar's lower-right edge. */
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

  /* ---- Nav extras: unread count, and an honest "not built yet" item ---- */
  .ts-nav-count {
    margin-left: auto;
    min-width: 20px; height: 20px; padding: 0 6px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff;
    background: #B91C1C;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
  }
  .ts-nav-item-soon { cursor: default; opacity: 0.55; }
  .ts-nav-item-soon:hover { background: transparent; }
  .ts-nav-soon {
    margin-left: auto;
    font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 2px 7px; border-radius: 999px;
    color: rgba(250,248,243,0.85);
    border: 1px solid rgba(250,248,243,0.3);
  }

  /* ---- HelpTip: the small "?" ---- */
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

  /* ---- Student top bar ---- */
  .ts-topbar {
    position: sticky; top: 0; z-index: 30;
    background: linear-gradient(180deg, rgba(250,248,243,0.9) 0%, rgba(250,248,243,0.72) 100%);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    backdrop-filter: blur(14px) saturate(1.2);
    border-bottom: 1px solid rgba(227,223,210,0.8);
  }
  @media (min-width: 1024px) {
    /* The sidebar already carries the brand on desktop; the bar only has to
       hold the bell, so it stays out of the way. */
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

  /* ---- Dropdowns (bell preview, mobile menu, help menu) ---- */
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

  /* ---- Floating help button ---- */
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

  /* ---- Guided tour ---- */
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

  /* ---- Readability for first-time users (student side only) ---- */
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

  /* ---- Wizard step indicator: glass badges, not flat filled circles ---- */
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

  /* ---- Step 1: selectable transaction-type cards ---- */
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

  /* ---- Step 3: on/off switch (distinct from the two-option segmented
     toggle used for role/category elsewhere) ---- */
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
    width: 20px; height: 20px;
    border-radius: 999px;
    background: linear-gradient(180deg, #FFFFFF, #F1EEE6);
    box-shadow: 0 1px 3px rgba(31,41,55,0.3), inset 0 1px 0 #fff;
    transition: transform 200ms cubic-bezier(0.22, 0.9, 0.3, 1);
  }
  .ts-switch-input:checked ~ .ts-switch-thumb { transform: translateX(20px); }

  /* ---- Gold-tinted glass warning card (Proxy Claimant Policy) ---- */
  .ts-warning-card {
    border-radius: 14px;
    background: linear-gradient(165deg, rgba(184,135,43,0.16) 0%, rgba(184,135,43,0.06) 100%);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border: 1px solid rgba(184,135,43,0.38);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 22px -16px rgba(184,135,43,0.4);
    color: #6B4E17;
  }

  /* ---- Step 4: review summary rows ---- */
  .ts-review-row { padding: 0.9rem 0; }
  .ts-review-row + .ts-review-row { border-top: 1px solid #E3DFD2; }
  .ts-review-label { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #5B6474; }
  .ts-review-value { color: #1F2937; font-weight: 600; margin-top: 2px; }

  /* ---- File upload dropzone (Board Exam photo) ---- */
  .ts-file-drop {
    border-radius: 12px;
    border: 1.5px dashed rgba(36,64,107,0.35);
    background: rgba(255,255,255,0.5);
    transition: border-color 150ms ease, background 150ms ease;
  }
  .ts-file-drop:hover { border-color: rgba(36,64,107,0.55); background: rgba(255,255,255,0.7); }
  .ts-file-drop-filled { border-style: solid; border-color: rgba(79,122,106,0.5); background: rgba(79,122,106,0.06); }

  /* ---- Track Requests: filter tabs ---- */
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

  /* ---- Track Requests: ticket-card (perforated stub, not a table row) ----
     Stub = colored block carrying the serif ticket code, separated from the
     body by a dashed seam with two circular "punch" notches at the top and
     bottom edges (background-colored circles clipped by the card's own
     overflow:hidden, so only the inward half of each shows). ---- */
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

  .ts-ticket-detail { border-top: 1px solid #E3DFD2; padding: 1.1rem 1.5rem 1.25rem; }
  /* Footer row of the expanded ticket: the helper line and the Download
     Receipt action. Stacks on phones so the button keeps a full-width tap
     target instead of being squeezed beside the text. */
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

  /* ---- Generic neutral tag pill — catalog fee/processing badges and
     "common purpose" tags, distinct from the semantic status .ts-pill-*
     colors used on Track Requests. ---- */
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

  /* ---- Credential Guide: clickable catalog card ---- */
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

  /* ---- Modal overlay for the catalog detail view — the app's first
     modal; a grid of cards suits a popup better than pushing siblings
     around the way TicketCard's inline expansion does for a linear list. ---- */
  .ts-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
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

  /* ---- More neutral tag variants (Credential Guide introduced .ts-tag /
     .ts-tag-sage; the Registrar Dashboard's stat-card labels need gold and
     muted too). ---- */
  .ts-tag-gold { color: #6B4E17; background: rgba(184,135,43,0.12); border-color: rgba(184,135,43,0.28); }
  .ts-tag-muted { color: #5B6474; background: rgba(91,100,116,0.08); border-color: rgba(91,100,116,0.18); }

  /* ---- Small gold "today" pill — same gold-glass language as
     .ts-cal-day-today's circle, just a text pill instead of a day number. ---- */
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

  /* ---- Small list-row avatar (Recent Submissions) — same gold-gradient
     glossy circle as the sidebar footer avatar, just sized for a row. ---- */
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

  /* ================================================================
     REGISTRAR (staff) SIDEBAR — deliberately charcoal + gold rather than
     the student side's institutional blue, so the two roles are
     unmistakable at a glance. Structurally identical to .ts-sidebar/
     .ts-nav-item (same card/pill/button primitives throughout the app),
     only the base gradient and accent treatment differ.
     ================================================================ */
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

  /* ---- Release Slots: interactive calendar day buttons ---- */
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

  /* ---- Release Slots: one card per slot within the day panel ---- */
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

  /* ---- Processing Queue: Verify & Approve (sage) / Reject (outline danger) —
     same glossy-button construction as .ts-btn-primary, different palette. ---- */
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
`;

export function DocumentIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M5 2.5h6.5L15 6v11a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-14a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.5 2.5V6H15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 10h5M6.5 12.5h5M6.5 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M5 8a5 5 0 0 1 10 0c0 3.5 1.2 4.5 1.2 4.5H3.8S5 11.5 5 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 15.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ArchiveIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="2.5" y="3" width="15" height="3.5" rx="0.75" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3.5 6.5V16a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 9.75h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function PlusCircleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.75v6.5M6.75 10h6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="8.75" cy="8.75" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16l-3.2-3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function InboxIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden="true">
      <rect x="5" y="12" width="30" height="22" rx="3" stroke="#E3DFD2" strokeWidth="1.75" fill="rgba(250,248,243,0.6)" />
      <path d="M5 22h9l2.2 4h7.6l2.2-4h9" stroke="#E3DFD2" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M13 12l3-6h8l3 6" stroke="#E3DFD2" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M3 9.5 10 3l7 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V16a.5.5 0 0 0 .5.5H8V13a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v3.5h2.5a.5.5 0 0 0 .5-.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v6A1.5 1.5 0 0 1 15.5 13H8l-3.5 3v-3H4.5A1.5 1.5 0 0 1 3 11.5v-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 8h7M6.5 10.2h4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function UserCircleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="8.3" r="2.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.8 15.2a5.6 5.6 0 0 1 10.4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M8 3.5H5.5A1.5 1.5 0 0 0 4 5v10a1.5 1.5 0 0 0 1.5 1.5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 13.5 17 10l-4-3.5M17 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TicketIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 17 7.5v1.1a1.4 1.4 0 0 0 0 2.8v1.1a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 12.5v-1.1a1.4 1.4 0 0 0 0-2.8V7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M11.5 6.3v7.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.4 2" />
    </svg>
  );
}

export function GridTableIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="3.5" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8.2h14M3 12.4h14M8.5 3.5v13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function GraduationCapIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M2 7.5 10 4l8 3.5-8 3.5-8-3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5.5 9.2v3.3c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V9.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17 7.8v4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BookIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M3 3.8c1.8-.7 4-.7 6 .4v11c-2-1.1-4.2-1.1-6-.4v-11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17 3.8c-1.8-.7-4-.7-6 .4v11c2-1.1 4.2-1.1 6-.4v-11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M10 2.5 16.5 5v4.8c0 4-2.7 6.7-6.5 8.2-3.8-1.5-6.5-4.2-6.5-8.2V5L10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.3 10 9.3 12l3.4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PaperPlaneIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M17.5 2.5 2.5 9.2l5.8 2.1L10.4 17l7.1-14.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17.5 2.5 8.3 11.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="6.2" cy="13.8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.4 11.6 15.5 4.5M12.7 7.3l2 2M15 5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M4.5 10.5 8 14l7.5-8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M10 2.5 18 16.5H2L10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 8v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="2.5" y="4" width="15" height="13.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Shared by both dashboards so "Good morning/afternoon/evening" logic lives
// in exactly one place rather than being copy-pasted per page.
export function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M13.5 3.5 16.5 6.5 6.5 16.5H3.5V13.5L13.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.5 5.5 14.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M10 3v9M10 12l-3.5-3.5M10 12l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 14v1.5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A small "?" that explains one thing in a sentence or two.
 *
 * Hover shows it on a desktop; a tap pins it open on a phone, where hover
 * does not exist; a tap elsewhere or Escape closes it. It is a real button,
 * so it is reachable by keyboard and announced by screen readers, and it
 * stops the click from reaching an enclosing <label> so tapping the "?" can
 * never toggle the checkbox or focus the field it sits beside.
 */
export function HelpTip({ children, label = 'What does this mean?' }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [shift, setShift] = useState(0);
  const wrapRef = useRef(null);
  const bubbleRef = useRef(null);
  const open = pinned || hover;

  useEffect(() => {
    if (!pinned) return undefined;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPinned(false);
    };
    const esc = (e) => e.key === 'Escape' && setPinned(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [pinned]);

  // Keep the bubble on screen: nudge it back in if it would hang off an edge.
  useEffect(() => {
    if (!open || !bubbleRef.current) return;
    const r = bubbleRef.current.getBoundingClientRect();
    const margin = 12;
    if (r.left < margin) setShift(margin - r.left);
    else if (r.right > window.innerWidth - margin) setShift(window.innerWidth - margin - r.right);
  }, [open]);

  useEffect(() => {
    if (!open) setShift(0);
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className="ts-helptip"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="ts-helptip-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        ?
      </button>
      {open && (
        <span
          ref={bubbleRef}
          role="tooltip"
          className="ts-helptip-bubble"
          style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
        >
          {children}
        </span>
      )}
    </span>
  );
}

export function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function QuestionIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden="true">
      <circle cx="10" cy="10" r="7.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.9 7.9a2.2 2.2 0 1 1 3.2 2c-.7.4-1.1.9-1.1 1.6v.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="14.1" r=".9" fill="currentColor" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M3 7.2A1.7 1.7 0 0 1 4.7 5.5h1.6l1.2-1.7h5l1.2 1.7h1.6A1.7 1.7 0 0 1 17 7.2v7.1A1.7 1.7 0 0 1 15.3 16H4.7A1.7 1.7 0 0 1 3 14.3V7.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.6" r="2.9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M10 13V4M10 4 6.5 7.5M10 4l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13.5V15a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shared app shell: sidebar (desktop) + slim top bar (mobile), used by every
// logged-in screen so the nav is identical wherever it appears. `active`
// picks which item gets the raised-glass highlight. Home, Request a form,
// Track requests, Credential Guide, Log out, and the avatar/name footer
// (which links to Profile) are all real; only Ask TrailSync remains a
// placeholder until that page exists.
// ---------------------------------------------------------------------------

export const NAV_ITEMS = [
  { key: 'home', href: '/portal', label: 'Home', Icon: HomeIcon },
  { key: 'request', href: '/request-form', label: 'Request a document', Icon: PlusCircleIcon },
  { key: 'track', href: '/track-requests', label: 'Track my requests', Icon: TicketIcon },
  { key: 'notifications', href: '/notifications', label: 'Notifications', Icon: BellIcon },
  { key: 'guide', href: '/credential-guide', label: 'Credential Guide', Icon: BookIcon },
  // Not built yet. Rendered as a labelled, non-navigating item rather than a
  // link to "#": a menu entry that silently does nothing reads to a
  // first-time user as the app being broken.
  { key: 'ask', href: null, label: 'Ask TrailSync', Icon: ChatIcon, soon: true },
];

export function initialsFor(me) {
  const a = (me?.first_name || '').charAt(0);
  const b = (me?.last_name || '').charAt(0);
  return (a + b).toUpperCase() || '?';
}

/** The photo URL for a user, straight from the API. Never assembled here. */
export function avatarUrlFor(user) {
  return user?.profile?.profile_picture_url || user?.profile_picture_url || null;
}

/**
 * The one photo-or-initials avatar. Every place that shows who someone is
 * renders this, so the fallback rule lives in exactly one spot.
 *
 * `className` is the slot's existing circle style (sidebar, list row, the
 * Profile page's large avatar); the photo is drawn into that same circle, so
 * swapping initials for a picture cannot shift the layout.
 *
 * Falls back to initials if the image fails to load - a photo removed from
 * another device, say - rather than leaving a broken-image icon in a circle.
 */
export function Avatar({ user, src, className = '', alt = '' }) {
  const url = src !== undefined ? src : avatarUrlFor(user);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (url && !failed) {
    return (
      <span className={className} style={{ padding: 0, overflow: 'hidden' }}>
        <img
          src={url}
          alt={alt}
          onError={() => setFailed(true)}
          className="ts-avatar-photo"
          style={{ width: '100%', height: '100%' }}
        />
      </span>
    );
  }
  return (
    <span className={className} aria-hidden={alt ? undefined : true}>
      {initialsFor(user)}
    </span>
  );
}

/**
 * `me` is optional — pages that haven't loaded /api/me/ yet (or don't need
 * it) simply render the sidebar without the profile footer rather than
 * requiring every caller to pass a stub.
 */
export function AppSidebar({ active, onLogout, me, unreadCount = 0 }) {
  const profile = me?.profile;
  const idLine = [profile?.school_id_number, profile?.course].filter(Boolean).join(' · ');

  return (
    <aside className="ts-sidebar hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-none lg:flex-col">
      <div className="flex items-center gap-2 px-6 pb-8 pt-7">
        <img
          src="/trailsync-logo.png"
          alt=""
          aria-hidden="true"
          style={{ height: '30px', width: 'auto', margin: '-6px 0' }}
        />
        <span className="text-lg font-semibold" style={{ ...FONT_SERIF, color: '#FAF8F3' }}>TrailSync</span>
      </div>

      <nav className="flex-1 space-y-2.5 px-3" aria-label="Main">
        {NAV_ITEMS.map(({ key, href, label, Icon, soon }) =>
          soon ? (
            <span
              key={key}
              data-tour={key}
              className="ts-nav-item ts-nav-item-soon px-3 py-2.5 text-sm font-medium"
              title="Coming soon"
            >
              <Icon />
              {label}
              <span className="ts-nav-soon">Soon</span>
            </span>
          ) : (
            <a
              key={key}
              href={href}
              data-tour={key}
              aria-current={key === active ? 'page' : undefined}
              className={`ts-nav-item px-3 py-2.5 text-sm font-medium ${key === active ? 'ts-nav-item-active' : ''}`}
            >
              <Icon />
              {label}
              {key === 'notifications' && unreadCount > 0 && (
                <span className="ts-nav-count" aria-label={`${unreadCount} unread`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </a>
          ),
        )}
      </nav>

      {me && (
        // Doubles as the sidebar's entry point to the Profile page — fits
        // the existing design better than a fifth nav-list item for
        // something that's about the account, not a section of the app.
        <a
          href="/profile"
          aria-current={active === 'profile' ? 'page' : undefined}
          className={`ts-sidebar-footer ts-nav-item px-4 py-4 ${active === 'profile' ? 'ts-nav-item-active' : ''}`}
        >
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
        </a>
      )}

      <div className="px-3 pb-6">
        <button type="button" onClick={onLogout} className="ts-nav-item w-full px-3 py-2.5 text-sm font-medium">
          <LogoutIcon />
          Log out
        </button>
      </div>
    </aside>
  );
}

export function AppMobileHeader({ onLogout }) {
  return (
    <header className="ts-app-header sticky top-0 z-10 lg:hidden">
      <div className="flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-2">
          <img
            src="/trailsync-logo.png"
            alt=""
            aria-hidden="true"
            style={{ height: '34px', width: 'auto', margin: '-7px 0' }}
          />
          <span className="ts-ink text-lg font-semibold" style={FONT_SERIF}>TrailSync</span>
        </div>
        <button type="button" onClick={onLogout} className="ts-link text-sm font-medium">
          Log out
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Registrar (staff) shell — same structure as AppSidebar/AppMobileHeader
// above, deliberately charcoal + gold instead of institutional blue so a
// staff member can never mistake which side of the app they're on. Only
// "Dashboard" is wired to a real page today; Processing Queue, Release
// Slots, and Notifications are placeholders until those pages exist.
// ---------------------------------------------------------------------------

const STAFF_NAV_ITEMS = [
  { key: 'dashboard', href: '/registrar/dashboard', label: 'Dashboard', Icon: GridIcon },
  { key: 'queue', href: '/registrar/queue', label: 'Processing Queue', Icon: DocumentIcon },
  { key: 'slots', href: '/registrar/release-slots', label: 'Release Slots', Icon: CalendarIcon },
  // No Notifications here: that inbox is student-only. The one staff-facing
  // alert (duplicate_flag) has its home on the Dashboard instead.
];

export function RegistrarSidebar({ active, onLogout, me }) {
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

      <div className="px-3 pb-6">
        <button type="button" onClick={onLogout} className="ts-staff-nav-item w-full px-3 py-2.5 text-sm font-medium">
          <LogoutIcon />
          Log out
        </button>
      </div>
    </aside>
  );
}

export function RegistrarMobileHeader({ onLogout }) {
  return (
    <header className="ts-staff-mobile-header sticky top-0 z-10 lg:hidden">
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
        <button
          type="button"
          onClick={onLogout}
          className="text-sm font-medium"
          style={{ color: '#E4B45C' }}
        >
          Log out
        </button>
      </div>
    </header>
  );
}


/**
 * Transient confirmation after a lifecycle transition.
 *
 * role="status" rather than an alert: these confirm something the user just
 * did deliberately, so a screen reader should mention it without cutting off
 * whatever it is currently reading.
 */
export function Toast({ message, tone = 'success', onDismiss }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onDismiss?.(), 4200);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className={`ts-toast ${tone === 'error' ? 'ts-toast-error' : ''}`}>
      <span className="ts-toast-accent" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
