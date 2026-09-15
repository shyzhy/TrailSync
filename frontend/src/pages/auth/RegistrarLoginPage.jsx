import { GlassScene } from '../../components/layout/GlassScene.jsx';
import { HomeLink, LoginForm } from '../../components/auth/LoginForm.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';
import { STUDENT_LOGIN_PATH } from '../../lib/auth.js';

// /registrar/login: staff colours, and no sign-up link because staff accounts are created by an administrator.
export default function RegistrarLoginPage() {
  return (
    <GlassScene maxWidth="420px" variant="staff">
      <HomeLink />

      <div className="mt-3 flex items-center gap-2.5">
        <img
          src="/trailsync-logo.png"
          alt=""
          aria-hidden="true"
          className="ts-logo shrink-0"
          style={{ height: '46px', width: 'auto', margin: '-7px 0' }}
        />
        <span className="ts-staff-eyebrow">TrailSync · Staff Portal</span>
      </div>
      <h1 className="ts-ink mt-5 text-4xl font-semibold tracking-tight" style={FONT_SERIF}>
        Window 6 Staff Portal
      </h1>
      <div className="ts-rule mt-3" />
      <p className="ts-soft mt-3 text-sm leading-relaxed">
        For USTP–CDO Registrar staff. Log in to review requests, record payments and release documents.
      </p>

      <LoginForm audience="staff" />

      <p className="ts-soft mt-6 text-sm">Don&rsquo;t have an account? Contact your administrator.</p>
      <p className="ts-soft mt-2 text-sm">
        Not staff?{' '}
        <a href={STUDENT_LOGIN_PATH} className="ts-link font-medium">
          Student login &rarr;
        </a>
      </p>

      <p className="ts-soft mt-10 text-xs">Office of the Registrar · USTP Cagayan de Oro</p>
    </GlassScene>
  );
}
