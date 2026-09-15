import { COLOR_UTIL_CSS, FORM_CONTROL_CSS } from './baseCss.js';

export const SHARED_CSS = `
  .ts-page { position: relative; overflow-x: hidden; background: #24406B; }

  /* One sharp photo layer; the glass layers blur whatever is behind them. Lower X% pushes the building right, into the open area. */
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

  /* backdrop-filter can't vary across an element, so three blur layers with their own masks ramp up without a seam. */
  .ts-glass {
    position: absolute;
    z-index: 1;
    pointer-events: none;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
  }

  @media (min-width: 1024px) {
    /* This width and the mask stops decide how much photo the glass covers: solid paper past the form, open photo right of ~56%. */
    .ts-glass { top: 0; bottom: 0; left: 0; width: 64%; }

    /* Lightest blur, travels furthest right. */
    .ts-glass-a {
      backdrop-filter: blur(7px);
      -webkit-backdrop-filter: blur(7px);
      -webkit-mask-image: linear-gradient(to right, #000 0%, #000 48%, rgba(0,0,0,0) 100%);
      mask-image: linear-gradient(to right, #000 0%, #000 48%, rgba(0,0,0,0) 100%);
    }
    /* Mid blur, carries the blue tint through the fade. */
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
    /* Heaviest blur, plus the paper frost the form sits on. */
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

  /* Narrow screens: the photo becomes a banner and the glass rises into it from below. */
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

  /* Password show/hide: a real 44px thumb target */
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

  /* Login outcomes: one shape each */
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
  /* Wrong details: something to fix right now. */
  .ts-notice-wrong { background: rgba(220,38,38,0.08); border-color: rgba(220,38,38,0.32); color: #991B1B; }
  .ts-notice-wrong .ts-notice-icon { background: rgba(220,38,38,0.12); color: #B91C1C; }
  /* Waiting on someone else: nothing to retype. */
  .ts-notice-pending { background: rgba(184,135,43,0.12); border-color: rgba(184,135,43,0.48); color: #5E4413; }
  .ts-notice-pending .ts-notice-icon {
    color: #FAF8F3;
    background: linear-gradient(180deg, #DCA948 0%, #B8872B 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 5px rgba(140,102,32,0.35);
  }
  /* Blocked by the office. */
  .ts-notice-suspended { background: rgba(31,41,55,0.06); border-color: rgba(31,41,55,0.24); color: #1F2937; }
  .ts-notice-suspended .ts-notice-icon { background: #1F2937; color: #FAF8F3; }
  /* Right password, wrong door. */
  .ts-notice-info { background: rgba(36,64,107,0.07); border-color: rgba(36,64,107,0.26); color: #1B3358; }
  .ts-notice-info .ts-notice-icon { background: rgba(36,64,107,0.12); color: #24406B; }
  /* Something finished, such as a password change. */
  .ts-notice-success { background: rgba(79,122,106,0.10); border-color: rgba(79,122,106,0.36); color: #2C4B3F; }
  .ts-notice-success .ts-notice-icon { background: rgba(79,122,106,0.16); color: #33574A; }

  /* Staff scene: the same photo and glass, re-tinted charcoal and gold. */
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
  /* Admin scene: the same photo and glass in deep plum. */
  .ts-scene-admin { background: #1E1128; }
  .ts-scene-admin .ts-photo { filter: saturate(0.5) brightness(0.88); }
  .ts-scene-admin .ts-photo-tint {
    background: linear-gradient(90deg, rgba(38,18,52,0.44) 0%, rgba(38,18,52,0.22) 55%, rgba(38,18,52,0.40) 100%);
  }
  @media (min-width: 1024px) {
    .ts-scene-admin .ts-glass-b {
      background: linear-gradient(to right,
        rgba(250,248,243,0.26) 0%,
        rgba(250,248,243,0.18) 45%,
        rgba(58,34,84,0.22) 74%,
        rgba(58,34,84,0.05) 100%);
    }
  }
  @media (max-width: 1023px) {
    .ts-scene-admin .ts-glass-b {
      background: linear-gradient(to bottom,
        rgba(58,34,84,0.20) 0%,
        rgba(250,248,243,0.20) 16%,
        rgba(250,248,243,0.28) 100%);
    }
  }
  .ts-scene-admin .ts-btn-primary {
    color: #FAF8F3;
    background: linear-gradient(180deg, #7B55A0 0%, #56367A 55%, #3A2254 100%);
    border-color: rgba(58,34,84,0.7);
    border-top-color: rgba(220,194,245,0.55);
    box-shadow:
      0 8px 18px rgba(58,34,84,0.34),
      0 2px 4px rgba(58,34,84,0.26),
      inset 0 1px 0 rgba(220,194,245,0.4);
  }
  .ts-scene-admin .ts-btn-primary:active:not(:disabled) {
    background: linear-gradient(180deg, #3A2254 0%, #56367A 50%, #7B55A0 100%);
    box-shadow: inset 0 3px 8px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(220,194,245,0.2);
  }
  .ts-scene-admin .ts-btn-primary:focus-visible {
    box-shadow: 0 0 0 3px rgba(201,167,235,0.7), 0 8px 18px rgba(58,34,84,0.34);
  }
  .ts-scene-admin .ts-link { color: #5A3780; }
  .ts-scene-admin .ts-input:focus { border-color: rgba(123,85,160,0.7); box-shadow: inset 0 2px 4px rgba(31,41,55,0.12), 0 0 0 3px rgba(155,109,201,0.42); }
  .ts-scene-admin .ts-checkbox-input:checked + .ts-checkbox-well { background: linear-gradient(180deg, #7B55A0 0%, #3A2254 100%); border-color: rgba(58,34,84,0.7); }
  .ts-admin-eyebrow {
    display: inline-flex; align-items: center;
    padding: 5px 11px;
    border-radius: 999px;
    font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
    color: #DCC2F5;
    background: linear-gradient(180deg, #4E3066 0%, #2A1838 100%);
    border: 1px solid rgba(201,167,235,0.38);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(38,18,52,0.3);
  }
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
