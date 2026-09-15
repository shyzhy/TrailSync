import { GlassScene } from '../../components/layout/GlassScene.jsx';
import { HomeLink, LoginForm } from '../../components/auth/LoginForm.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';
import { STAFF_LOGIN_PATH, STUDENT_LOGIN_PATH } from '../../lib/auth.js';

// /admin/login: plum, and no sign-up link, because admin accounts are only ever provisioned directly.
export default function AdminLoginPage() {
  return (
    <GlassScene maxWidth="420px" variant="admin">
      <HomeLink />

      <div className="mt-3 flex items-center gap-2.5">
        <img
          src="/trailsync-logo.png"
          alt=""
          aria-hidden="true"
          className="ts-logo shrink-0"
          style={{ height: '46px', width: 'auto', margin: '-7px 0' }}
        />
        <span className="ts-admin-eyebrow">TrailSync · Admin</span>
      </div>
      <h1 className="ts-ink mt-5 text-4xl font-semibold tracking-tight" style={FONT_SERIF}>
        Admin Portal
      </h1>
      <div className="ts-rule mt-3" />
      <p className="ts-soft mt-3 text-sm leading-relaxed">
        For TrailSync administrators. Log in to see system-wide activity and manage accounts.
      </p>

      <LoginForm audience="admin" />

      <p className="ts-soft mt-6 text-sm">
        Looking for a different login?{' '}
        <a href={STAFF_LOGIN_PATH} className="ts-link font-medium">
          Staff Portal
        </a>{' '}
        &middot;{' '}
        <a href={STUDENT_LOGIN_PATH} className="ts-link font-medium">
          Student login
        </a>
      </p>

      <p className="ts-soft mt-10 text-xs">Office of the Registrar · USTP Cagayan de Oro</p>
    </GlassScene>
  );
}
