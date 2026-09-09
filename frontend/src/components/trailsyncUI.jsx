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
`;

// Form-control skeuomorphic styling (inputs, selects, checkboxes, toggle
// switch, primary/glass buttons) — shared between the auth pages (glass over
// photo) and app-shell pages (opaque cards on paper), since none of these
// rules reference the photo/backdrop, only rgba overlays that read the same
// on both. One definition, included in both SHARED_CSS and APP_CSS, so a
// tweak to how an input looks never has to be made twice.
const FORM_CONTROL_CSS = `
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

// ---------------------------------------------------------------------------
// Shared app shell: sidebar (desktop) + slim top bar (mobile), used by every
// logged-in screen so the nav is identical wherever it appears. `active`
// picks which item gets the raised-glass highlight; only Home and the
// logout button do anything real right now — Track requests and Ask
// TrailSync are placeholders until those pages exist.
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { key: 'home', href: '/portal', label: 'Home', Icon: HomeIcon },
  { key: 'request', href: '/request-form', label: 'Request a form', Icon: PlusCircleIcon },
  { key: 'track', href: '#', label: 'Track requests', Icon: TicketIcon },
  { key: 'ask', href: '#', label: 'Ask TrailSync', Icon: ChatIcon },
];

export function AppSidebar({ active, onLogout }) {
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

      <nav className="flex-1 space-y-2.5 px-3">
        {NAV_ITEMS.map(({ key, href, label, Icon }) => (
          <a
            key={key}
            href={href}
            aria-current={key === active ? 'page' : undefined}
            className={`ts-nav-item px-3 py-2.5 text-sm font-medium ${key === active ? 'ts-nav-item-active' : ''}`}
          >
            <Icon />
            {label}
          </a>
        ))}
      </nav>

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
