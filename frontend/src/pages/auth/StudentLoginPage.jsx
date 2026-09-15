import { GlassScene } from '../../components/layout/GlassScene.jsx';
import { HomeLink, LoginForm } from '../../components/auth/LoginForm.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';
import { STAFF_LOGIN_PATH } from '../../lib/auth.js';

// /login: students and alumni.
export default function StudentLoginPage() {
  return (
    <GlassScene maxWidth="420px">
      <HomeLink />

      {/* The PNG's mark fills only ~45% of its canvas, so it is scaled up and the negative margin hides the padding. */}
      <div className="mt-3 flex items-center gap-1">
        <img
          src="/trailsync-logo.png"
          alt=""
          aria-hidden="true"
          className="ts-logo shrink-0"
          style={{ height: '56px', width: 'auto', margin: '-8px 0', transform: 'translateY(-2px)' }}
        />
        <span className="ts-ink text-4xl font-semibold tracking-tight" style={FONT_SERIF}>
          TrailSync
        </span>
      </div>
      <div className="ts-rule mt-3" />
      <h1 className="ts-ink mt-5 text-2xl font-semibold" style={FONT_SERIF}>
        Student &amp; alumni login
      </h1>
      <p className="ts-soft mt-1.5 text-sm leading-relaxed">
        Request documents from the USTP–CDO Registrar, follow their progress, and pick them up at Window 6.
      </p>

      <LoginForm audience="student" />

      <p className="ts-soft mt-6 text-sm">
        Don&rsquo;t have an account?{' '}
        <a href="/create-account" className="ts-link font-medium">
          Create one
        </a>
      </p>
      <p className="ts-soft mt-2 text-sm">
        Registrar staff?{' '}
        <a href={STAFF_LOGIN_PATH} className="ts-link font-medium">
          Staff Portal login &rarr;
        </a>
      </p>

      <p className="ts-soft mt-10 text-xs">Window 6 · Registrar&rsquo;s Office · Open Mon–Fri, 8:00–5:00</p>
    </GlassScene>
  );
}
