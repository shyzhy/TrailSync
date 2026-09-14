import { useState } from 'react';
import {
  API_BASE_URL,
  BusyLabel,
  EyeIcon,
  EyeOffIcon,
  FONT_SERIF,
  GlassScene,
} from './trailsyncUI.jsx';
import ResendEmailButton from './ResendEmailButton.jsx';
import { STUDENT_LOGIN_PATH } from '../lib/auth.js';
import { NETWORK_ERROR, friendlyMessage } from '../lib/friendlyErrors.js';

const LOGIN_PATH = STUDENT_LOGIN_PATH;

// Any well-formed address - Gmail included. There is deliberately no USTP
// domain rule: alumni in particular may no longer have a school mailbox.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { label: 'Weak', className: 'ts-soft' };
  if (score <= 3) return { label: 'Medium', className: 'ts-gold' };
  return { label: 'Strong', className: 'ts-sage' };
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden="true">
      <rect x="6" y="11" width="36" height="26" rx="5" fill="rgba(36,64,107,0.08)" stroke="#24406B" strokeWidth="2" />
      <path d="m8 14 16 12 16-12" stroke="#24406B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="38" cy="12" r="6" fill="#B8872B" />
      <path d="M35.6 12.1l1.6 1.6 3.2-3.3" stroke="#FAF8F3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The three stages ahead, so "just an email and password?" makes sense. */
function Journey({ current }) {
  const stages = ['Create account', 'Confirm email', 'Set up profile'];
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-medium" aria-label="Getting started">
      {stages.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              i === current ? 'ts-ink' : 'ts-soft'
            }`}
            style={{
              background: i === current ? 'rgba(36,64,107,0.10)' : 'rgba(31,41,55,0.05)',
              border: `1px solid ${i === current ? 'rgba(36,64,107,0.25)' : 'transparent'}`,
            }}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="tabular-nums">{i + 1}</span>
            {label}
          </span>
          {i < stages.length - 1 && (
            <span className="ts-soft" aria-hidden="true">
              &rsaquo;
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function PasswordField({ id, label, value, onChange, error, describedBy, placeholder, autoComplete = 'new-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="ts-ink mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : describedBy}
          placeholder={placeholder}
          className={`ts-input w-full py-2.5 pl-3.5 pr-12 text-sm ${error ? 'ts-input-error' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="ts-eye-btn"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="ts-error-text mt-1.5 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * /create-account — an email and a password, nothing else.
 *
 * Name, School ID, course and the rest come later, in onboarding, once the
 * address has been confirmed. So signing up takes seconds, and nobody types
 * a whole profile into an account whose confirmation email never arrives.
 */
export default function CreateAccountPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [sentTo, setSentTo] = useState(null);

  const strength = passwordStrength(password);

  const clear = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = 'Please enter your email address.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Please enter a valid email address, like juan@gmail.com.';
    if (!password) next.password = 'Please choose a password.';
    else if (password.length < 8) next.password = 'Please use at least 8 characters.';
    if (!confirmPassword) next.confirmPassword = 'Please type your password again.';
    else if (password && confirmPassword !== password) next.confirmPassword = "This doesn't match the password above.";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, confirm_password: confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setErrors({ general: 'Too many sign-up attempts from here. Please wait a while and try again.' });
        return;
      }
      if (!res.ok) {
        const pick = (v) => (Array.isArray(v) ? v.map(friendlyMessage).join(' ') : v ? friendlyMessage(v) : undefined);
        setErrors({
          email: pick(data.email),
          password: pick(data.password),
          confirmPassword: pick(data.confirm_password),
          general: pick(data.detail) || pick(data.non_field_errors),
        });
        return;
      }
      setSentTo(data.email || email.trim());
    } catch {
      setErrors({ general: NETWORK_ERROR });
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 2 of the journey: go and open the email --------------------
  if (sentTo) {
    return (
      <GlassScene maxWidth="440px">
        <a href="/" className="ts-link -ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-sm font-medium">
          <span aria-hidden="true">&larr;</span> TrailSync home
        </a>
        <Journey current={1} />
        <div className="mt-8" role="status">
          <EnvelopeIcon />
          <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
            Check your email to activate your account
          </h1>
          <p className="ts-soft mt-3 text-base leading-relaxed">
            We sent a link to <strong className="ts-ink break-words">{sentTo}</strong>. Open it to confirm it&rsquo;s
            you — then we&rsquo;ll help you finish setting up.
          </p>
        </div>

        <div className="ts-info-note mt-6 px-4 py-3 text-sm leading-relaxed">
          The link works for <strong>24 hours</strong>. Can&rsquo;t find the email? Check your spam or promotions
          folder.
        </div>

        <ResendEmailButton email={sentTo} className="mt-6" />

        <p className="ts-soft mt-4 text-sm">
          Wrong email?{' '}
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setPassword('');
              setConfirmPassword('');
            }}
            className="ts-link font-medium"
          >
            Start over
          </button>
        </p>
        <p className="ts-soft mt-2 text-sm">
          Already confirmed?{' '}
          <a href={LOGIN_PATH} className="ts-link font-medium">
            Log in
          </a>
        </p>
      </GlassScene>
    );
  }

  // ---- Step 1: the form -------------------------------------------------
  return (
    <GlassScene maxWidth="420px">
      <a href="/" className="ts-link -ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-sm font-medium">
        <span aria-hidden="true">&larr;</span> TrailSync home
      </a>

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
        Create your account
      </h1>
      <p className="ts-soft mt-1.5 text-sm leading-relaxed">
        It only takes a minute. You&rsquo;ll add your name and school details after you confirm your email.
      </p>
      <Journey current={0} />

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
        <div>
          <label htmlFor="email" className="ts-ink mb-1.5 block text-sm font-medium">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clear('email');
            }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : 'email-hint'}
            placeholder="juan.delacruz@gmail.com"
            className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.email ? 'ts-input-error' : ''}`}
          />
          {errors.email ? (
            <p id="email-error" className="ts-error-text mt-1.5 text-sm">
              {errors.email}
              {/already an account/i.test(errors.email) && (
                <>
                  {' '}
                  <a href={LOGIN_PATH} className="font-semibold underline">
                    Log in
                  </a>
                </>
              )}
            </p>
          ) : (
            <p id="email-hint" className="ts-soft mt-1.5 text-xs">
              Any email you check often works — Gmail is fine. We&rsquo;ll send your confirmation link here.
            </p>
          )}
        </div>

        <div>
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clear('password');
            }}
            error={errors.password}
            describedBy="password-strength"
            placeholder="At least 8 characters"
          />
          {!errors.password && strength && (
            <p id="password-strength" className="ts-soft mt-1.5 text-xs">
              Password strength: <span className={`${strength.className} font-medium`}>{strength.label}</span>
            </p>
          )}
        </div>

        <PasswordField
          id="confirmPassword"
          label="Type your password again"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clear('confirmPassword');
          }}
          error={errors.confirmPassword}
          placeholder="Re-enter your password"
        />

        {errors.general && (
          <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
            {errors.general}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="ts-btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-medium"
        >
          <BusyLabel busy={loading} busyLabel="Creating your account…">
            Create account
          </BusyLabel>
        </button>
      </form>

      <p className="ts-soft mt-6 text-sm">
        Already have an account?{' '}
        <a href={LOGIN_PATH} className="ts-link font-medium">
          Log in
        </a>
      </p>

      <p className="ts-soft mt-10 text-xs">Window 6 · Registrar&rsquo;s Office · Open Mon–Fri, 8:00–5:00</p>
    </GlassScene>
  );
}
