// Admin portal: the same glass and paper in deep plum and lilac, so it can't be mistaken for the student or staff side.
export const ADMIN_CSS = `
  .ts-admin-sidebar {
    background: linear-gradient(180deg, #4A2C5F 0%, #2F1B40 55%, #1F1129 100%);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 6px 0 28px -14px rgba(20,8,30,0.55);
  }
  .ts-admin-nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: rgba(250,248,243,0.58);
    border-radius: 10px;
    transition: color 150ms ease, background 150ms ease;
  }
  .ts-admin-nav-item:hover { color: #FAF8F3; background: rgba(255,255,255,0.08); }
  .ts-admin-nav-item:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(201,167,235,0.6); }
  .ts-admin-nav-item-active {
    color: #FAF8F3;
    background: linear-gradient(180deg, rgba(201,167,235,0.24) 0%, rgba(201,167,235,0.06) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.18),
      inset 0 0 0 1px rgba(201,167,235,0.30),
      0 2px 10px rgba(20,8,30,0.4);
  }
  .ts-admin-nav-item-active::before {
    content: '';
    position: absolute;
    left: -3px;
    top: 20%;
    bottom: 20%;
    width: 3px;
    border-radius: 2px;
    background: linear-gradient(180deg, #DCC2F5, #9B6DC9);
  }
  .ts-admin-sidebar-footer { border-top: 1px solid rgba(255,255,255,0.10); }
  .ts-admin-mobile-header {
    background: rgba(47,27,64,0.95);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }

  .ts-admin .ts-sidebar-avatar { background: linear-gradient(180deg, #B38BD9 0%, #7B55A0 100%); }
  .ts-admin .ts-btn-primary {
    background: linear-gradient(180deg, #7B55A0 0%, #56367A 55%, #3A2254 100%);
    border-color: rgba(58,34,84,0.65);
    border-top-color: rgba(255,255,255,0.42);
    box-shadow:
      0 8px 18px rgba(58,34,84,0.32),
      0 2px 4px rgba(58,34,84,0.24),
      inset 0 1px 0 rgba(255,255,255,0.32);
  }
  .ts-admin .ts-btn-primary:active:not(:disabled) {
    background: linear-gradient(180deg, #3A2254 0%, #56367A 50%, #7B55A0 100%);
  }
  .ts-admin .ts-btn-primary:focus-visible { box-shadow: 0 0 0 3px rgba(155,109,201,0.6), 0 8px 18px rgba(58,34,84,0.32); }
  .ts-admin .ts-link { color: #5A3780; }
  .ts-admin .ts-link:focus-visible,
  .ts-admin .ts-filter-tab:focus-visible,
  .ts-admin .ts-btn-glass:focus-visible { box-shadow: 0 0 0 3px rgba(155,109,201,0.55); }
  .ts-admin .ts-filter-tab-active,
  .ts-admin .ts-filter-tab-active:hover {
    background: linear-gradient(180deg, #7B55A0 0%, #56367A 60%, #3A2254 100%);
    border-color: rgba(58,34,84,0.5);
    box-shadow: 0 3px 8px rgba(58,34,84,0.3), inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .ts-admin .ts-input:focus {
    border-color: rgba(123,85,160,0.7);
    box-shadow: inset 0 2px 4px rgba(31,41,55,0.12), 0 0 0 3px rgba(155,109,201,0.42);
  }
  .ts-admin .ts-date-badge {
    color: #4A2C5F;
    background: linear-gradient(180deg, rgba(201,167,235,0.34) 0%, rgba(155,109,201,0.14) 100%);
    border-color: rgba(123,85,160,0.32);
  }

  .ts-stat-icon-plum { background: linear-gradient(180deg, rgba(123,85,160,0.18), rgba(123,85,160,0.06)); color: #5A3780; }
  .ts-tag-plum { color: #4A2C5F; background: rgba(123,85,160,0.12); border-color: rgba(123,85,160,0.28); }

  .ts-activity-dot {
    width: 10px; height: 10px; border-radius: 999px; flex-shrink: 0; margin-top: 6px;
    background: linear-gradient(180deg, #B38BD9, #7B55A0);
    box-shadow: 0 0 0 3px rgba(155,109,201,0.16);
  }
  .ts-activity-dot-staff { background: linear-gradient(180deg, #DCA948, #B8872B); box-shadow: 0 0 0 3px rgba(184,135,43,0.16); }
`;
