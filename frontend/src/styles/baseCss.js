// Text colour and link utilities shared by the auth pages and the app.
export const COLOR_UTIL_CSS = `
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

  /* Neutral informational note, distinct from error, success and pending. */
  .ts-info-note {
    border-radius: 10px;
    background: rgba(36,64,107,0.05);
    border: 1px solid rgba(36,64,107,0.15);
    color: #24406B;
  }
`;

// Form controls and buttons, included in both SHARED_CSS and APP_CSS so an input is only ever styled once.
export const FORM_CONTROL_CSS = `
  /* Busy buttons: both labels share one grid cell so the width never jumps. Here because the login pages need it too. */
  .ts-busy-label { display: inline-grid; align-items: center; justify-items: center; }
  .ts-busy-label > * { grid-area: 1 / 1; display: inline-flex; align-items: center; gap: 8px; }
  .ts-busy-label > .ts-busy-on { visibility: hidden; }
  .ts-busy-label[data-busy='1'] > .ts-busy-off { visibility: hidden; }
  .ts-busy-label[data-busy='1'] > .ts-busy-on { visibility: visible; }

  /* Phones: 16px stops iOS Safari zooming into a focused field, and 44px is a reliable thumb target. */
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
  /* The one look for a field-level problem on every form. */
  .ts-field-error { color: #B91C1C; margin-top: 0.375rem; font-size: 0.875rem; line-height: 1.4; }
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
  /* pointer-events: none so clicks reach the real input underneath. */
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
