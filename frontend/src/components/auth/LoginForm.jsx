import { useEffect, useState } from 'react';
import { BusyLabel, CheckIcon, EyeIcon, EyeOffIcon, FieldError, WarningIcon } from '../ui/index.js';
import ResendEmailButton from './ResendEmailButton.jsx';
import {
  ADMIN_LOGIN_PATH,
  getAccessToken,
  getStoredUser,
  saveSession,
  STAFF_LOGIN_PATH,
  STUDENT_LOGIN_PATH,
  takeFlash,
} from '../../lib/auth.js';
import { API_BASE_URL } from '../../lib/config.js';
import { friendlyMessage, NETWORK_ERROR, SERVER_ERROR, SESSION_ENDED } from '../../lib/friendlyErrors.js';
import { IS_MOBILE_APP } from '../../lib/platform.js';

const STUDENT_AUDIENCE = {
  roles: ['Student', 'Alumni'],
  home: '/portal',
  identifierLabel: 'Email or School ID number',
  placeholder: 'e.g. 2021300123 or juan.delacruz@ustp.edu.ph',
  submitLabel: 'Log in to your account',
  // Students can sign in with either, so the message names both.
  wrongDetails: "That email, School ID number or password doesn't match our records.",
};

// The login pages share one form; everything that differs between them lives in this table. The app build has only
// the student login, so the staff and admin entries aren't part of it.
const AUDIENCES = IS_MOBILE_APP
  ? { student: STUDENT_AUDIENCE }
  : {
      student: STUDENT_AUDIENCE,
      staff: {
        roles: ['Registrar Staff'],
        home: '/registrar/dashboard',
        identifierLabel: 'Staff email',
        placeholder: 'e.g. maria.santos@ustp.edu.ph',
        submitLabel: 'Log in to Staff Portal',
        wrongDetails: "That email or password doesn't match our records.",
      },
      admin: {
        roles: ['Admin'],
        home: '/admin/dashboard',
        identifierLabel: 'Admin email',
        placeholder: 'e.g. admin@ustp.edu.ph',
        submitLabel: 'Log in to Admin Portal',
        wrongDetails: "That email or password doesn't match our records.",
      },
    };

// Right password, wrong door: point the person at the login for the account they actually have. The app is for
// students and alumni only, so there staff and admins are pointed at the website, with no link into it.
const PORTAL_FOR_ROLE = IS_MOBILE_APP
  ? {
      'Registrar Staff': { title: 'This is a staff account', body: 'The TrailSync app is for students and alumni. Registrar staff log in to the Staff Portal on the TrailSync website.' },
      Admin: { title: 'This is an administrator account', body: 'The TrailSync app is for students and alumni. Administrators log in to the Admin Portal on the TrailSync website.' },
    }
  : {
      Student: { title: 'This is a student account', body: 'Students and alumni log in on the student page instead.', href: STUDENT_LOGIN_PATH, linkLabel: 'Go to the student login' },
      Alumni: { title: 'This is an alumni account', body: 'Students and alumni log in on the student page instead.', href: STUDENT_LOGIN_PATH, linkLabel: 'Go to the student login' },
      'Registrar Staff': { title: 'This is a staff account', body: 'Registrar staff log in through the Staff Portal instead.', href: STAFF_LOGIN_PATH, linkLabel: 'Go to the Staff Portal login' },
      Admin: { title: 'This is an administrator account', body: 'Administrators log in through the Admin Portal instead.', href: ADMIN_LOGIN_PATH, linkLabel: 'Go to the Admin Portal login' },
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

// Where a signed-in student lands: onboarding while their profile has gaps, otherwise the app.
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

// Read once per page load and cached, because React's development double-render would otherwise consume the flash.
let arrivalFlash;
function readArrivalFlash() {
  if (arrivalFlash === undefined) arrivalFlash = takeFlash();
  return arrivalFlash;
}

const ARRIVAL_NOTICES = {
  session_expired: { kind: 'info', title: SESSION_ENDED },
  password_reset: {
    kind: 'success',
    title: 'Your password has been changed.',
    body: 'Log in with your new password.',
  },
  account_ready: {
    kind: 'success',
    title: 'Your account is ready.',
    body: 'Log in with the password you just chose.',
  },
};

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

// Each outcome gets its own colour, icon and wording, because each has a different next step.
function LoginNotice({ notice }) {
  const styles = {
    wrong: { className: 'ts-notice-wrong', Icon: WarningIcon, role: 'alert' },
    pending: { className: 'ts-notice-pending', Icon: ClockIcon, role: 'status' },
    unverified: { className: 'ts-notice-pending', Icon: MailIcon, role: 'status' },
    suspended: { className: 'ts-notice-suspended', Icon: LockIcon, role: 'alert' },
    'other-portal': { className: 'ts-notice-info', Icon: SwitchIcon, role: 'status' },
    info: { className: 'ts-notice-info', Icon: ClockIcon, role: 'status' },
    success: { className: 'ts-notice-success', Icon: CheckIcon, role: 'status' },
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

export function LoginForm({ audience }) {
  const config = AUDIENCES[audience];
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(() => ARRIVAL_NOTICES[readArrivalFlash()] || null);

  // Already signed in on this side? Skip the form. An expired session is sent back here by authFetch.
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
    if (loading) return; // A second Enter while the first is still in flight.

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
      // A crashed server answers with HTML, not JSON: that's "try again later", not "you can't reach us".
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
          // Right password, unconfirmed account: an email to go and open, with a way to get a new one.
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
          // Same wording whether or not the account exists, so the form can't reveal who has one.
          setNotice({ kind: 'wrong', title: config.wrongDetails, body: 'Check both and try again.' });
        } else {
          setNotice({ kind: 'error', title: detail ? friendlyMessage(detail) : SERVER_ERROR });
        }
        return;
      }

      const userRole = data.user?.role;
      if (!config.roles.includes(userRole)) {
        // Checked before saving the session, so a correct password on the wrong page never half signs anyone in.
        setNotice({
          kind: 'other-portal',
          ...(PORTAL_FOR_ROLE[userRole] || { title: 'This account has no portal yet', body: 'Please contact the Registrar\u2019s Office.' }),
        });
        return;
      }

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
        <FieldError id="identifier">{errors.identifier}</FieldError>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="ts-ink block text-sm font-medium">
            Password
          </label>
          <a href={`/forgot-password?from=${audience}`} className="ts-link -my-2 py-2 text-sm">
            Forgot password?
          </a>
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
        <FieldError id="password">{errors.password}</FieldError>
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

export function HomeLink() {
  if (IS_MOBILE_APP) {
    return (
      <a href={STUDENT_LOGIN_PATH} className="ts-link -ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-sm font-medium">
        <span aria-hidden="true">&larr;</span> Back to login
      </a>
    );
  }
  return (
    <a href="/" className="ts-link -ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-sm font-medium">
      <span aria-hidden="true">&larr;</span> TrailSync home
    </a>
  );
}
