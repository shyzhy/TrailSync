import { useState } from 'react';
import { API_BASE_URL, BusyLabel, FieldError, FONT_SERIF, GlassScene } from './trailsyncUI.jsx';
import { STAFF_LOGIN_PATH, STUDENT_LOGIN_PATH } from '../lib/auth.js';
import { errorFromResponse, formErrors, toApiError } from '../lib/api.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Which login the person came from: ?from=staff, otherwise the student one.
 * It only decides where "Back to login" points and how the page is dressed -
 * the reset itself is the same for everyone.
 */
export function resetAudience() {
  return new URLSearchParams(window.location.search).get('from') === 'staff' ? 'staff' : 'student';
}

export const LOGIN_FOR = { staff: STAFF_LOGIN_PATH, student: STUDENT_LOGIN_PATH };

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden="true">
      <rect x="6" y="11" width="36" height="26" rx="5" fill="rgba(36,64,107,0.08)" stroke="#24406B" strokeWidth="2" />
      <path d="m8 14 16 12 16-12" stroke="#24406B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The logo lockup both password pages open with, in each audience's style. */
export function AuthHeader({ audience }) {
  if (audience === 'staff') {
    return (
      <div className="flex items-center gap-2.5">
        <img src="/trailsync-logo.png" alt="" aria-hidden="true" className="ts-logo shrink-0" style={{ height: '46px', width: 'auto', margin: '-7px 0' }} />
        <span className="ts-staff-eyebrow">TrailSync · Staff Portal</span>
      </div>
    );
  }
  return (
    <>
      <div className="flex items-center gap-1">
        <img src="/trailsync-logo.png" alt="" aria-hidden="true" className="ts-logo shrink-0" style={{ height: '48px', width: 'auto', margin: '-7px 0' }} />
        <span className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          TrailSync
        </span>
      </div>
      <div className="ts-rule mt-3" />
    </>
  );
}

export function BackToLogin({ audience, className = 'mt-8' }) {
  return (
    <p className={`ts-soft text-sm ${className}`}>
      <a href={LOGIN_FOR[audience]} className="ts-link inline-flex min-h-[44px] items-center gap-1 font-medium">
        <span aria-hidden="true">&larr;</span> Back to login
      </a>
    </p>
  );
}

/**
 * Ask for a reset link: one email field and one button.
 *
 * Whatever the address, the server gives the same answer, so this form never
 * reveals whether an account exists - and neither does anything shown after
 * it. Also used on the expired-link page to ask for a fresh link.
 */
export function ResetLinkRequestForm({ autoFocus = false, onSent, idPrefix = 'reset' }) {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const fieldId = `${idPrefix}Email`;

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const trimmed = email.trim();
    if (!trimmed) return setErrors({ email: 'Please enter your email address.' });
    if (!EMAIL_RE.test(trimmed)) return setErrors({ email: 'Please enter a valid email address, like juan@gmail.com.' });

    setErrors({});
    setSending(true);
    try {
      // A plain fetch, not authFetch: nobody is logged in here, and a stale
      // token from an old session must not be sent along.
      const res = await fetch(`${API_BASE_URL}/api/auth/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      onSent?.({ email: trimmed, detail: data.detail });
    } catch (error) {
      setErrors(formErrors(toApiError(error), ['email']));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <label htmlFor={fieldId} className="ts-ink mb-1.5 block text-sm font-medium">
          Email address
        </label>
        <input
          id={fieldId}
          name="email"
          type="email"
          autoComplete="email"
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email || errors.general) setErrors({});
          }}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${fieldId}-error` : undefined}
          placeholder="The email you use for TrailSync"
          className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.email ? 'ts-input-error' : ''}`}
        />
        <FieldError id={fieldId}>{errors.email}</FieldError>
      </div>

      {errors.general && (
        <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
          {errors.general}
        </div>
      )}

      <button
        type="submit"
        disabled={sending}
        aria-busy={sending}
        className="ts-btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-medium"
      >
        <BusyLabel busy={sending} busyLabel="Sending…">
          Send Reset Link
        </BusyLabel>
      </button>
    </form>
  );
}

/** What everyone sees after asking, account or not. */
export function ResetLinkSent({ sent, onAgain }) {
  return (
    <div role="status">
      <EnvelopeIcon />
      <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
        Check your email
      </h1>
      <p className="ts-soft mt-3 text-base leading-relaxed">{sent.detail}</p>
      <div className="ts-info-note mt-6 px-4 py-3 text-sm leading-relaxed">
        The link works for <strong>1 hour</strong> and can be used once. Can&rsquo;t find the email? Check your spam
        or promotions folder.
      </div>
      <p className="ts-soft mt-6 text-sm">
        Nothing arrived?{' '}
        <button type="button" onClick={onAgain} className="ts-link font-medium">
          Try again
        </button>
      </p>
    </div>
  );
}

/** /forgot-password?from=student|staff */
export default function ForgotPasswordPage() {
  const audience = resetAudience();
  const [sent, setSent] = useState(null);

  return (
    <GlassScene maxWidth="420px" variant={audience === 'staff' ? 'staff' : 'student'}>
      <AuthHeader audience={audience} />

      <div className="mt-8" aria-live="polite">
        {sent ? (
          <ResetLinkSent sent={sent} onAgain={() => setSent(null)} />
        ) : (
          <>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Forgot your password?
            </h1>
            <p className="ts-soft mt-2 text-sm leading-relaxed">
              Enter the email address you use for TrailSync and we&rsquo;ll send you a link to choose a new password.
            </p>
            <div className="mt-7">
              <ResetLinkRequestForm autoFocus onSent={setSent} />
            </div>
          </>
        )}
      </div>

      <BackToLogin audience={audience} />
    </GlassScene>
  );
}
