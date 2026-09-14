import { useEffect, useState } from 'react';
import {
  API_BASE_URL,
  BusyLabel,
  EyeIcon,
  EyeOffIcon,
  FONT_SERIF,
  GlassScene,
  WarningIcon,
} from './trailsyncUI.jsx';
import ResendEmailButton from './ResendEmailButton.jsx';
import { STAFF_LOGIN_PATH, STUDENT_LOGIN_PATH, getAccessToken, getStoredUser, saveSession } from '../lib/auth.js';
import { NETWORK_ERROR, SERVER_ERROR, friendlyMessage } from '../lib/friendlyErrors.js';

/**
 * Two login pages sharing one form.
 *
 * There used to be a single page with a Student/Staff switch above one
 * "Log in" button, and it was never obvious who that button logged you in
 * as. Now each page's whole context says who it is for, and everything that
 * differs between them lives in this table rather than in conditionals
 * scattered through the markup.
 */
const AUDIENCES = {
  student: {
    roles: ['Student', 'Alumni'],
    home: '/portal',
    identifierLabel: 'Email or School ID number',
    placeholder: 'e.g. 2021300123 or juan.delacruz@ustp.edu.ph',
    submitLabel: 'Log in to your account',
    // Students can sign in with either, so the message names both.
    wrongDetails: "That email, School ID number or password doesn't match our records.",
    forgot:
      'You can’t reset your password online yet. Please ask at Window 6 in the Registrar’s Office, and bring your school ID.',
    otherPortal: {
      title: 'This is a staff account',
      body: 'Registrar staff log in through the Staff Portal instead.',
      href: STAFF_LOGIN_PATH,
      linkLabel: 'Go to the Staff Portal login',
    },
  },
  staff: {
    roles: ['Registrar Staff'],
    home: '/registrar/dashboard',
    identifierLabel: 'Staff email',
    placeholder: 'e.g. maria.santos@ustp.edu.ph',
    submitLabel: 'Log in to Staff Portal',
    wrongDetails: "That email or password doesn't match our records.",
    forgot: 'Staff passwords are reset by your administrator. Contact them and they can set a new one for you.',
    otherPortal: {
      title: 'This is a student account',
      body: 'Students and alumni log in on the student page instead.',
      href: STUDENT_LOGIN_PATH,
      linkLabel: 'Go to the student login',
    },
  },
};

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v4.2l2.8 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="5" width="14" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m3.8 6.2 6.2 4.6 6.2-4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Where a successfully signed-in student should land: onboarding if their
 * profile still has gaps (it resumes at the first one), otherwise the app.
 * Staff have no onboarding.
 */
export function homeFor(user, fallback) {
  const onboarding = user?.profile?.onboarding;
  if (onboarding && !onboarding.complete) return '/onboarding';
  return fallback;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="4.5" y="9" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V6.8a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 7h11m0 0-3-3m3 3-3 3M16 13H5m0 0 3-3m-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * What went wrong, in a shape that matches what to do about it.
 *
 * A wrong password and an account still waiting for approval are different
 * problems with different next steps - retype, versus wait for someone else
 * - so they get different colours, icons and wording rather than the same
 * red box with different text inside.
 */
function LoginNotice({ notice }) {
  const styles = {
    wrong: { className: 'ts-notice-wrong', Icon: WarningIcon, role: 'alert' },
    pending: { className: 'ts-notice-pending', Icon: ClockIcon, role: 'status' },
    unverified: { className: 'ts-notice-pending', Icon: MailIcon, role: 'status' },
    suspended: { className: 'ts-notice-suspended', Icon: LockIcon, role: 'alert' },
    'other-portal': { className: 'ts-notice-info', Icon: SwitchIcon, role: 'status' },
    error: { className: 'ts-notice-wrong', Icon: WarningIcon, role: 'alert' },
  };
  const { className, Icon, role } = styles[notice.kind] || styles.error;

  return (
    <div role={role} className={`ts-notice ${className}`} data-kind={notice.kind}>
      <span className="ts-notice-icon">
        <Icon />
      </span>
      <div className="min-w-0 text-sm leading-relaxed">
        <p className="font-semibold">{notice.title}</p>
        {notice.body && <p className="mt-0.5">{notice.body}</p>}
        {notice.resendEmail && <ResendEmailButton email={notice.resendEmail} variant="link" className="mt-1" />}
        {notice.href && (
          <a href={notice.href} className="mt-1.5 inline-flex min-h-[44px] items-center font-semibold underline underline-offset-2">
            {notice.linkLabel} &rarr;
          </a>
        )}
      </div>
    </div>
  );
}

function LoginForm({ audience }) {
  const config = AUDIENCES[audience];
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Already signed in on this side? Skip the form. The stored user is only a
  // hint: if its session has expired, the destination page gets a 401,
  // clears the session and sends the person straight back here.
  useEffect(() => {
    const user = getStoredUser();
    if (getAccessToken() && user && config.roles.includes(user.role)) {
      window.location.replace(homeFor(user, config.home));
    }
  }, [config]);

  const validate = () => {
    const next = {};
    if (!identifier.trim()) {
      next.identifier =
        audience === 'staff' ? 'Please enter your staff email.' : 'Please enter your email or School ID number.';
    }
    if (!password) next.password = 'Please enter your password.';
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // a second Enter while the first is still in flight

    const validationErrors = validate();
    setErrors(validationErrors);
    setNotice(null);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      // A crashed server answers with an HTML page, not JSON - that's "try
      // again later", not "you can't reach us".
      const data = await response.json().catch(() => ({}));
      const detail = data.detail || '';

      if (!response.ok) {
        if (response.status === 403 && /pending admin approval/i.test(detail)) {
          setNotice({
            kind: 'pending',
            title: 'Your account is waiting for approval',
            body: 'Your password is correct. An administrator still needs to approve this staff account — you’ll be able to log in as soon as they do.',
          });
        } else if (response.status === 403 && data.code === 'email_unverified') {
          // Right password, account not confirmed yet: not an error to fix
          // here, but an email to go and open - with a way to get a new one.
          setNotice({
            kind: 'unverified',
            title: 'Please confirm your email before logging in',
            body: `We sent a confirmation link to ${data.email || 'your email'}. Open it to activate your account — it works for 24 hours.`,
            resendEmail: data.email,
          });
        } else if (response.status === 403 && /suspended/i.test(detail)) {
          setNotice({
            kind: 'suspended',
            title: 'This account is suspended',
            body: 'Please contact the Registrar’s Office to have it reactivated.',
          });
        } else if (response.status === 401 || /invalid credentials/i.test(detail)) {
          // Same wording whether the account exists or not: the server never
          // says which, and neither does this, so the form can't be used to
          // find out who has an account.
          setNotice({ kind: 'wrong', title: config.wrongDetails, body: 'Check both and try again.' });
        } else {
          setNotice({ kind: 'error', title: detail ? friendlyMessage(detail) : SERVER_ERROR });
        }
        return;
      }

      const userRole = data.user?.role;
      if (!config.roles.includes(userRole)) {
        // Deliberately checked BEFORE saving the session, so a correct
        // password on the wrong page never leaves anyone half signed in.
        setNotice({ kind: 'other-portal', ...config.otherPortal });
        return;
      }

      // "Keep me logged in" controls whether the session survives closing the tab.
      saveSession(data, remember);
      window.location.href = homeFor(data.user, config.home);
    } catch {
      setNotice({ kind: 'error', title: NETWORK_ERROR });
    } finally {
      setLoading(false);
    }
  };

  const wrong = notice?.kind === 'wrong';

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
      <div>
        <label htmlFor="identifier" className="ts-ink mb-1.5 block text-sm font-medium">
          {config.identifierLabel}
        </label>
        <input
          id="identifier"
          name="identifier"
          type={audience === 'staff' ? 'email' : 'text'}
          autoComplete="username"
          // Someone arriving here came to type this; don't make them click first.
          autoFocus
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: undefined }));
          }}
          aria-invalid={Boolean(errors.identifier || wrong)}
          aria-describedby={errors.identifier ? 'identifier-error' : undefined}
          placeholder={config.placeholder}
          className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.identifier || wrong ? 'ts-input-error' : ''}`}
        />
        {errors.identifier && (
          <p id="identifier-error" className="ts-error-text mt-1.5 text-sm">
            {errors.identifier}
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="ts-ink block text-sm font-medium">
            Password
          </label>
          <button
            type="button"
            onClick={() => setForgotOpen((o) => !o)}
            aria-expanded={forgotOpen}
            className="ts-link -my-2 py-2 text-sm"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            aria-invalid={Boolean(errors.password || wrong)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            placeholder="Enter your password"
            className={`ts-input w-full py-2.5 pl-3.5 pr-12 text-sm ${errors.password || wrong ? 'ts-input-error' : ''}`}
          />
          {/* 44px square: a thumb target, not a mouse-sized icon. */}
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="ts-eye-btn"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="ts-error-text mt-1.5 text-sm">
            {errors.password}
          </p>
        )}
        {forgotOpen && <p className="ts-info-note mt-2 px-3.5 py-2.5 text-sm">{config.forgot}</p>}
      </div>

      {notice && <LoginNotice notice={notice} />}

      <label htmlFor="remember" className="flex min-h-[44px] cursor-pointer select-none items-center gap-2.5">
        <span className="ts-checkbox-wrap">
          <input
            id="remember"
            name="remember"
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="ts-checkbox-input"
          />
          <span className="ts-checkbox-well" aria-hidden="true">
            <svg viewBox="0 0 12 10" fill="none" className="ts-checkbox-check">
              <path d="M1 5.2 4.3 8.5 11 1.5" stroke="#FAF8F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
        <span className="ts-soft text-sm">Keep me logged in on this device</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="ts-btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-medium"
      >
        <BusyLabel busy={loading} busyLabel="Logging in…">
          {config.submitLabel}
        </BusyLabel>
      </button>
    </form>
  );
}

function HomeLink() {
  return (
    <a href="/" className="ts-link -ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-sm font-medium">
      <span aria-hidden="true">&larr;</span> TrailSync home
    </a>
  );
}

/** /login — students and alumni. */
export default function StudentLoginPage() {
  return (
    <GlassScene maxWidth="420px">
      <HomeLink />

      {/* Logo + wordmark lockup. The logo is decorative — the wordmark beside
          it already carries the name, so alt is empty to avoid a double read.
          SIZING NOTE: the supplied PNG is 300x300 with the mark filling only
          ~45% of its canvas, so the box is scaled up to bring the mark itself
          to the wordmark's cap height, and the negative margin keeps that
          transparent padding from inflating the row. */}
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

/**
 * /registrar/login — Window 6 staff.
 *
 * Charcoal and gold like the rest of the staff side, so it reads as a
 * different door before a word of it is read. No sign-up link: staff
 * accounts are created by an administrator and never self-registered.
 */
export function RegistrarLoginPage() {
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

      {/* Informational, not a link: there is nothing to sign up for here. */}
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
