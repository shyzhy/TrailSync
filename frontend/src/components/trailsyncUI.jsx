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

  .ts-banner { border-radius: 10px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.7); }
  .ts-banner-error { background: rgba(220,38,38,0.10); border: 1px solid rgba(220,38,38,0.35); color: #991B1B; }
  .ts-banner-pending { background: rgba(184,135,43,0.14); border: 1px solid rgba(184,135,43,0.45); color: #6B4E17; }
  .ts-banner-success { background: rgba(79,122,106,0.12); border: 1px solid rgba(79,122,106,0.42); color: #33574A; }

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
