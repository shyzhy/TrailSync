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
  /* ---- Busy buttons -------------------------------------------------
     The idle and busy labels sit in the same grid cell, so the button is
     always as wide as the longer of the two and nothing beside it moves
     when the label changes. Lives here, in the sheet both the app AND the
     login/sign-up pages load: in the app-only sheet, the login button
     showed both of its labels stacked at all times. */
  .ts-busy-label { display: inline-grid; align-items: center; justify-items: center; }
  .ts-busy-label > * { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: 8px; }
  .ts-busy-label > .ts-busy-on { visibility: hidden; }
  .ts-busy-label[data-busy='1'] > .ts-busy-off { visibility: hidden; }
  .ts-busy-label[data-busy='1'] > .ts-busy-on { visibility: visible; }

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

  /* ---- Password show/hide: a real 44px thumb target ------------------ */
  .ts-eye-btn {
    position: absolute;
    top: 50%; right: 2px;
    transform: translateY(-50%);
    width: 44px; height: 44px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 10px;
    color: #5B6474;
    background: transparent;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease;
  }
  .ts-eye-btn:hover { color: #1F2937; background: rgba(31,41,55,0.05); }
  .ts-eye-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }

  /* ---- Login outcomes: one shape each, not one red box for all ------- */
  .ts-notice {
    display: flex; gap: 12px; align-items: flex-start;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid transparent;
  }
  .ts-notice-icon {
    flex-shrink: 0;
    width: 32px; height: 32px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .ts-notice-icon svg { width: 18px; height: 18px; }
  /* Wrong details: red, and something the person can fix right now. */
  .ts-notice-wrong { background: rgba(220,38,38,0.08); border-color: rgba(220,38,38,0.32); color: #991B1B; }
  .ts-notice-wrong .ts-notice-icon { background: rgba(220,38,38,0.12); color: #B91C1C; }
  /* Waiting on someone else: warm gold, a clock, nothing to retype. */
  .ts-notice-pending { background: rgba(184,135,43,0.12); border-color: rgba(184,135,43,0.48); color: #5E4413; }
  .ts-notice-pending .ts-notice-icon {
    color: #FAF8F3;
    background: linear-gradient(180deg, #DCA948 0%, #B8872B 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 5px rgba(140,102,32,0.35);
  }
  /* Blocked by the office: neutral and serious. */
  .ts-notice-suspended { background: rgba(31,41,55,0.06); border-color: rgba(31,41,55,0.24); color: #1F2937; }
  .ts-notice-suspended .ts-notice-icon { background: #1F2937; color: #FAF8F3; }
  /* Right password, wrong door: blue, with a way through. */
  .ts-notice-info { background: rgba(36,64,107,0.07); border-color: rgba(36,64,107,0.26); color: #1B3358; }
  .ts-notice-info .ts-notice-icon { background: rgba(36,64,107,0.12); color: #24406B; }

  /* ---- Staff scene: charcoal and gold ---------------------------------
     The same photo and glass as the student login, re-tinted to the staff
     side's colours so the two doors are told apart at a glance. */
  .ts-scene-staff { background: #1B1E23; }
  .ts-scene-staff .ts-photo { filter: saturate(0.55) brightness(0.9); }
  .ts-scene-staff .ts-photo-tint {
    background: linear-gradient(90deg, rgba(20,22,27,0.40) 0%, rgba(20,22,27,0.20) 55%, rgba(20,22,27,0.36) 100%);
  }
  @media (min-width: 1024px) {
    .ts-scene-staff .ts-glass-b {
      background: linear-gradient(to right,
        rgba(250,248,243,0.26) 0%,
        rgba(250,248,243,0.18) 45%,
        rgba(31,35,42,0.20) 74%,
        rgba(31,35,42,0.04) 100%);
    }
  }
  @media (max-width: 1023px) {
    .ts-scene-staff .ts-glass-b {
      background: linear-gradient(to bottom,
        rgba(31,35,42,0.18) 0%,
        rgba(250,248,243,0.20) 16%,
        rgba(250,248,243,0.28) 100%);
    }
  }
  .ts-scene-staff .ts-btn-primary {
    color: #FAF8F3;
    background: linear-gradient(180deg, #4A4F58 0%, #2B2F36 55%, #1B1E23 100%);
    border-color: rgba(20,22,27,0.75);
    border-top-color: rgba(228,180,92,0.6);
    box-shadow:
      0 8px 18px rgba(20,22,27,0.34),
      0 2px 4px rgba(20,22,27,0.26),
      inset 0 1px 0 rgba(228,180,92,0.38);
  }
  .ts-scene-staff .ts-btn-primary:active:not(:disabled) {
    background: linear-gradient(180deg, #1B1E23 0%, #2B2F36 50%, #4A4F58 100%);
    box-shadow: inset 0 3px 8px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(228,180,92,0.2);
  }
  .ts-scene-staff .ts-btn-primary:focus-visible {
    box-shadow: 0 0 0 3px rgba(228,180,92,0.7), 0 8px 18px rgba(20,22,27,0.34);
  }
  .ts-scene-staff .ts-link { color: #7A5719; }
  .ts-scene-staff .ts-input:focus { border-color: rgba(184,135,43,0.7); }
  .ts-staff-eyebrow {
    display: inline-flex; align-items: center;
    padding: 5px 11px;
    border-radius: 999px;
    font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
    color: #E4B45C;
    background: linear-gradient(180deg, #3A3F47 0%, #1F2329 100%);
    border: 1px solid rgba(228,180,92,0.35);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(20,22,27,0.25);
  }
`;

/**
 * The split-screen scene both pages sit in: sharp photo on the right, glass
 * that fades into it on the left, form content directly on the glass with no
 * card. Content is passed as children.
 */
export function GlassScene({ children, maxWidth = '420px', variant = 'student' }) {
  return (
    <div
      className={`ts-page relative flex min-h-screen w-full flex-col lg:flex-row ${variant === 'staff' ? 'ts-scene-staff' : ''}`}
      style={FONT_SANS}
    >
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
    /* One home for every confirmation in the app: top-right on anything
       tablet-sized or bigger. On a phone it spans the top instead, where a
       right-corner card would cover the bell. */
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
  /* Positioning box for the avatar plus its camera button; matches
     .ts-avatar-xl at both sizes. */
  .ts-avatar-frame { width: 112px; height: 112px; }

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


  /* ---- Phone bottom navigation (<768px) -------------------------------
     Replaces the sidebar below the tablet breakpoint. Same glass treatment
     as the sidebar's active item, so the app still looks like one thing.
     56px tall plus the device's own safe area, which is what the content
     spacer below is sized against. */
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
    /* Comfortably past the 44px thumb target even before the safe area. */
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
    /* Shrinks a little on a 360px Android so "Notifications" still fits
       without being cut; never grows past 11px. */
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
  .ts-bottom-nav-count {
    position: absolute;
    top: 4px; left: 50%; margin-left: 4px;
    min-width: 17px; height: 17px; padding: 0 4px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: #fff;
    background: #B91C1C;
    border: 2px solid #24406B;
  }
  @media (min-width: 768px) { .ts-bottom-nav { display: none; } }

  /* Nothing at the end of a page should hide behind the fixed bar. */
  @media (max-width: 767px) {
    .ts-student-main { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }
  }

  /* ---- "More" sheet: the nav items that don't fit five across ---- */
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

  /* ---- Horizontally swipeable filter rows ----------------------------
     Chips scroll sideways on a phone instead of wrapping onto three rows
     and pushing the list itself below the fold. This is the ONLY thing in
     the app meant to scroll horizontally. */
  .ts-tab-scroller {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    /* Room for the chips' focus ring, which would otherwise be clipped. */
    padding: 3px 0;
    /* Lets a chip row run to the screen edge, so it reads as scrollable. */
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

  /* =====================================================================
     LOADING, EMPTY AND MOTION
     ===================================================================== */

  /* Placeholder surfaces read as unlit glass: the same paper tone as a real
     card with a light sweep passing over it, rather than a grey box that
     belongs to some other app. The sweep is a pseudo-element transform, not
     an animated background-position, so it stays smooth on a long list. */
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

  /* A skeleton standing in for a whole card keeps the card's own glass
     edge, so the page does not visibly change shape when data lands. */
  .ts-skeleton-card {
    position: relative;
    border-radius: 14px;
    background: linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(250,248,243,0.70) 100%);
    border: 1px solid rgba(255,255,255,0.65);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 14px 30px -18px rgba(31,41,55,0.26);
  }

  /* ---- Empty states ---- */
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


  /* ---- Success seal: circle drawn, then the tick ---- */
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

  /* ---- Page and step transitions ----------------------------------
     The page wrapper fades and must NOT transform. Every fixed element in
     the app - the toast, the help button, the phone nav bar, the tour
     spotlight - is a descendant of this wrapper, and ANY transform on an
     ancestor (an identity matrix included, which is what animation-fill-mode
     leaves behind) makes position: fixed resolve against that ancestor
     instead of the viewport. They then scroll away with the page. Opacity
     creates a stacking context but not a containing block, so it is safe. */
  .ts-page-enter { animation: ts-page-fade 0.22s ease-out both; }
  @keyframes ts-page-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  /* The slight rise lives on the page's own content, which never contains a
     fixed element. */
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

  /* ---- The bell, when something new arrives ---- */
  .ts-bell-ring { animation: ts-ring 0.7s ease-in-out; transform-origin: 50% 12%; }
  @keyframes ts-ring {
    0%, 100% { transform: rotate(0); }
    12% { transform: rotate(-13deg); }
    26% { transform: rotate(11deg); }
    40% { transform: rotate(-8deg); }
    54% { transform: rotate(6deg); }
    68% { transform: rotate(-3deg); }
  }

  /* Every card that does something now also presses IN when clicked, not
     only up on hover: ts-quick-card had this, the document picker and the
     catalogue cards did not, so the same gesture felt different depending
     on which screen you were on. */
  .ts-select-card:active, .ts-guide-card:active, .ts-card-hoverable:active {
    transform: translateY(1px);
    box-shadow: inset 0 3px 9px rgba(31,41,55,0.15), inset 0 -1px 0 rgba(255,255,255,0.45);
  }
  .ts-card-hoverable { transition: transform 150ms ease, box-shadow 150ms ease; }

  /* Interactive rows lift the same way cards do, so "this does something"
     looks the same everywhere. */
  .ts-row-hover { transition: background 150ms ease, transform 150ms ease, box-shadow 150ms ease; }
  .ts-row-hover:hover {
    background: rgba(36,64,107,0.045);
    box-shadow: inset 3px 0 0 rgba(184,135,43,0.55);
  }
  .ts-row-hover:active { background: rgba(36,64,107,0.07); }

  /* ---- One switch for everything above ----------------------------- */
  @media (prefers-reduced-motion: reduce) {
    .ts-skeleton::after { animation: none; }
    .ts-seal-circle, .ts-seal-check { animation: none; stroke-dashoffset: 0; }
    .ts-page-enter, .ts-page-enter main, .ts-step-enter-fwd, .ts-step-enter-back, .ts-bell-ring { animation: none; }
    .ts-card-hoverable:hover, .ts-guide-card:hover, .ts-ticket-clickable:hover, .ts-row-hover:hover {
      transform: none;
    }
  }

  /* ---- Release calendar (registrar, view-only) ----------------------- */
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
  /* A day with releases reads as a raised tile, not just a number. */
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

  /* The Dashboard's mini version: same drawing, smaller. */
  .ts-relcal-mini .ts-relcal-grid { gap: 3px; }
  .ts-relcal-mini .ts-relcal-weekday { font-size: 10px; }
  .ts-relcal-mini .ts-relcal-day { min-height: 34px; border-radius: 9px; font-size: 12px; }
  .ts-relcal-mini .ts-relcal-num { width: 24px; height: 24px; }
  .ts-relcal-mini .ts-relcal-count { top: 1px; right: 1px; min-width: 15px; height: 15px; padding: 0 3px; font-size: 9.5px; }

  /* =====================================================================
     PHONE OVERRIDES — deliberately last in this sheet.
     Everything here overrides a rule defined above it. A media query adds
     no specificity, so source order is what makes these win.
     ===================================================================== */
  /* ---- Phone touch targets ---- */
  @media (max-width: 767px) {
    .ts-filter-tab { min-height: 44px; }
    .ts-icon-btn { height: 44px; min-width: 44px; }
    .ts-help-fab {
      /* Clear of the bottom bar rather than floating on top of it. */
      right: 16px;
      bottom: calc(56px + 14px + env(safe-area-inset-bottom, 0px));
      height: 48px;
    }
    /* A phone-width modal that stops short of the edges wastes the screen
       and reads as cramped; these become full-height sheets instead.
       Above the bottom nav (40) and the help button (50): a full-screen
       sheet with the tab bar still floating on top of it looks broken, and
       the tabs would be tappable through what is meant to be a modal. */
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

  /* ---- Ticket stub stacks on very narrow phones ----------------------
     Below ~400px the 104px stub leaves too little for the document name
     and the progress line, so the stub becomes a header strip instead. */
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
    /* The "?" chips are 20px by design - they sit inside a label and a
       bigger circle would shout. This gives them a 46px hit area without
       changing how they look. */
    .ts-helptip-btn::after { content: ''; position: absolute; inset: -13px; }

    /* Standalone text links and quiet buttons ("See all", "Remove photo",
       "Change email", "Try again") were sized for a mouse. Only ones that
       stand alone on their own line are padded out - an inline-flex link in
       the middle of a sentence would stop wrapping and overflow. */
    a.ts-tap, button.ts-tap {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }

    /* The avatar is the biggest thing on the Profile page; at 112px it
       takes a fifth of a 360px screen before any of the account details
       are read. */
    .ts-avatar-xl, .ts-avatar-frame { width: 96px; height: 96px; }
    .ts-avatar-xl { font-size: 32px; }
    /* Bigger for a thumb, and pushed further out so it covers less of a
       photo that is itself smaller on a phone. */
    .ts-avatar-edit { width: 44px; height: 44px; right: -6px; bottom: -6px; }
  }
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
    // From 768px up. Between 768 and 1023 it narrows to icons only, which
    // keeps the app's shape on a tablet without eating a third of the width;
    // below 768 it is replaced entirely by the bottom bar (StudentShell).
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
              {/* The label is the accessible name at every width; on a
                  tablet it is only visually hidden, not dropped. */}
              <span className="sr-only lg:not-sr-only">{label}</span>
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
// staff member can never mistake which side of the app they're on.
// ---------------------------------------------------------------------------

/**
 * Three items, and it should stay three. Window 6 is run by one person at a
 * counter: everything they do is either "what needs working on" (Queue),
 * "what happened" (Released Documents) or the overview. Release Slots used
 * to sit here, managing bookable windows with capacity limits for an office
 * that releases everything between 3:00 and 5:00 PM.
 *
 * No Notifications either: that inbox is student-only, and the one
 * staff-facing alert (duplicate_flag) lives on the Dashboard.
 */
const STAFF_NAV_ITEMS = [
  { key: 'dashboard', href: '/registrar/dashboard', label: 'Dashboard', Icon: GridIcon },
  { key: 'queue', href: '/registrar/queue', label: 'Processing Queue', Icon: DocumentIcon },
  // Between the work and the record: where releases are headed.
  { key: 'calendar', href: '/registrar/calendar', label: 'Release Calendar', Icon: CalendarIcon },
  { key: 'released', href: '/registrar/released', label: 'Released Documents', Icon: ArchiveIcon },
];

/**
 * Plain answers to the questions a new staff member actually asks, plus who
 * to contact when the answer isn't here. Opened from the sidebar footer and
 * from the phone menu, so it is reachable from every registrar screen.
 */
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

/**
 * The staff header on phones. This was a logo and a Log out button, with no
 * way to reach the Queue or anything else — the sidebar is desktop-only, so
 * a staff member on a phone could open one page and then log out. The menu
 * carries the same three items, plus help.
 */
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


/**
 * Transient confirmation after a lifecycle transition.
 *
 * role="status" rather than an alert: these confirm something the user just
 * did deliberately, so a screen reader should mention it without cutting off
 * whatever it is currently reading.
 */

// ---------------------------------------------------------------------------
// Loading placeholders
// ---------------------------------------------------------------------------

/**
 * One shimmering placeholder bar. Everything below is built from this, so
 * the loading look is defined in exactly one place.
 *
 * Shapes are deliberately close to the real content's: a stat card's
 * placeholder is a stat card, not a grey rectangle, so nothing jumps or
 * reflows when the data lands.
 */
export function Skeleton({ className = '', style }) {
  return <div className={`ts-skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** Wrapper that announces a loading region once, instead of every bar. */
export function SkeletonGroup({ label = 'Loading', children, className = '' }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}

/** Dashboard stat card: icon tile, big number, caption. */
export function StatCardSkeleton() {
  return (
    <div className="ts-skeleton-card p-5">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-4 h-8 w-14" />
      <Skeleton className="mt-2.5 h-3.5 w-28" />
    </div>
  );
}

/** A list row with an avatar/dot, a title line and a meta line. */
export function ListRowSkeleton({ avatar = true }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      {avatar && <Skeleton className="h-8 w-8 shrink-0 rounded-full" />}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40 max-w-full" />
        <Skeleton className="h-3 w-24 max-w-full" />
      </div>
    </div>
  );
}

/** The perforated ticket on Track Requests: stub block plus body. */
export function TicketSkeleton() {
  return (
    <div className="ts-skeleton-card flex overflow-hidden">
      <Skeleton className="m-3 h-20 w-24 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2.5 p-4">
        <Skeleton className="h-4 w-48 max-w-full" />
        <Skeleton className="h-3 w-32 max-w-full" />
        <Skeleton className="mt-3 h-2 w-full" />
      </div>
    </div>
  );
}

/** A Credential Guide catalogue card. */
export function GuideCardSkeleton() {
  return (
    <div className="ts-skeleton-card space-y-3 p-5">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <Skeleton className="h-4 w-40 max-w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** One row of a records table, sized by its column widths (in grid units). */
export function TableRowSkeleton({ widths = [2, 4, 2, 3, 1] }) {
  const total = widths.reduce((a, b) => a + b, 0);
  return (
    <div className="grid items-center gap-3 px-5 py-4" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
      {widths.map((w, i) => (
        <Skeleton key={i} className="h-4" style={{ gridColumn: `span ${w} / span ${w}` }} />
      ))}
    </div>
  );
}

/**
 * The Request Review page while its one request loads. Mirrors that page's
 * two-column shape so the real content lands in the same places.
 */
export function DetailPageSkeleton() {
  return (
    <SkeletonGroup label="Loading this request" className="mt-4">
      <Skeleton className="h-9 w-56 max-w-full" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="ts-skeleton-card space-y-4 p-6 lg:col-span-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-3 w-44 max-w-full" />
          <div className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32 max-w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="ts-skeleton-card space-y-4 p-6 lg:col-span-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-6 h-11 w-full rounded-lg" />
        </div>
      </div>
    </SkeletonGroup>
  );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

/**
 * What a list looks like when there is legitimately nothing in it.
 *
 * Always the same three parts in the same order - line-art icon, one
 * headline, one sentence - with an action only when there is something
 * useful to do. An empty list that explains itself reads as the app working;
 * a blank panel reads as the app broken.
 */
export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  message,
  action,
  className = '',
  boxed = true,
}) {
  return (
    <div
      className={`flex flex-col items-center px-6 py-14 text-center ${boxed ? 'ts-card' : ''} ${className}`}
    >
      <span className="ts-empty-icon" aria-hidden="true">
        <Icon />
      </span>
      <p className="ts-ink mt-4 text-base font-semibold">{title}</p>
      {message && <p className="ts-soft mt-1.5 max-w-sm text-sm leading-relaxed">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Busy buttons
// ---------------------------------------------------------------------------

/**
 * The label of a button that can be working.
 *
 * Both labels occupy the same grid cell, so the button keeps the width of
 * the longer one and nothing around it shifts when it starts working. Pair
 * it with disabled={busy}, which is what actually stops a second submit.
 */
export function BusyLabel({ busy, busyLabel, children }) {
  return (
    <span className="ts-busy-label" data-busy={busy ? '1' : '0'}>
      <span className="ts-busy-off">{children}</span>
      <span className="ts-busy-on">
        <Spinner />
        {busyLabel || children}
      </span>
    </span>
  );
}

/**
 * A seal that draws itself: the circle, then the tick.
 *
 * For the two moments worth marking - a request sent, an account created -
 * where a toast would be too quiet. Everything smaller uses a toast.
 */
export function SuccessSeal({ size = 64 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="26.5" fill="rgba(79,122,106,0.10)" />
      <circle
        className="ts-seal-circle"
        cx="32"
        cy="32"
        r="26.5"
        stroke="#4F7A6A"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
      <path
        className="ts-seal-check"
        d="M20.5 33.5 L28.5 41.5 L44 25"
        stroke="#33574A"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      <span className="flex-1">{message}</span>
      {/* Auto-dismiss is the normal path; this is for anyone who wants it
          gone now, or who cannot wait out the timer. */}
      <button type="button" onClick={() => onDismiss?.()} aria-label="Dismiss" className="ts-toast-close">
        <CloseIcon />
      </button>
    </div>
  );
}
