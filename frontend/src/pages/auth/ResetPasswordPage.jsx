import { useCallback, useEffect, useState } from 'react';
import { GlassScene } from '../../components/layout/GlassScene.jsx';
import { BusyLabel, PasswordField, Spinner } from '../../components/ui/index.js';
import {
  AuthHeader,
  BackToLogin,
  LOGIN_FOR,
  resetAudience,
  ResetLinkRequestForm,
  ResetLinkSent,
} from '../../components/auth/ResetLink.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, formErrors, toApiError } from '../../lib/api.js';
import { clearSession, setFlash } from '../../lib/auth.js';
import { API_BASE_URL } from '../../lib/config.js';

// Expired and used links are one case: either way, the answer is a new link.
const DEAD_LINK_CODES = ['expired', 'invalid'];

function BrokenLinkIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(184,135,43,0.12)" />
      <path d="M24 14v12" stroke="#8C6620" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="32.5" r="1.8" fill="#8C6620" />
    </svg>
  );
}

function post(path, body) {
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Where the reset email leads. The link is checked on arrival, and success sends the person to log in rather than signing them in.
export default function ResetPasswordPage() {
  const [audience] = useState(resetAudience);
  const [{ uid, token }] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { uid: params.get('uid'), token: params.get('token') };
  });

  const [phase, setPhase] = useState('checking'); // checking | form | dead | unreachable
  const [checkError, setCheckError] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(null);

  const check = useCallback(async () => {
    if (!uid || !token) {
      setPhase('dead');
      return;
    }
    setPhase('checking');
    try {
      const res = await post('/api/auth/password-reset/validate/', { uid, token });
      if (res.ok) {
        setPhase('form');
        return;
      }
      const error = await errorFromResponse(res);
      if (error.kind === 'validation') {
        setPhase('dead');
        return;
      }
      throw error;
    } catch (error) {
      setCheckError(toApiError(error));
      setPhase('unreachable');
    }
  }, [uid, token]);

  useEffect(() => {
    check();
  }, [check]);

  const clear = (key) => setErrors((prev) => (prev[key] || prev.general ? { ...prev, [key]: undefined, general: undefined } : prev));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const found = {};
    if (!newPassword) found.newPassword = 'Please choose a new password.';
    else if (newPassword.length < 8) found.newPassword = 'Please use at least 8 characters.';
    if (!confirmPassword) found.confirmPassword = 'Please type your new password again.';
    else if (newPassword && confirmPassword !== newPassword) found.confirmPassword = "This doesn't match the password above.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const res = await post('/api/auth/password-reset/confirm/', {
        uid,
        token,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      // Any session this browser still holds belongs to the old password.
      clearSession();
      setFlash('password_reset');
      window.location.replace(LOGIN_FOR[data.login] || LOGIN_FOR[audience]);
    } catch (error) {
      const apiError = toApiError(error);
      // The link died while the form was open: that's the expired page, not a form error.
      if (apiError.kind === 'validation' && DEAD_LINK_CODES.includes(apiError.data?.code)) {
        setPhase('dead');
        return;
      }
      setErrors(formErrors(apiError, { new_password: 'newPassword', confirm_new_password: 'confirmPassword' }));
      setSaving(false);
    }
  };

  return (
    <GlassScene maxWidth="420px" variant={audience === 'staff' ? 'staff' : 'student'}>
      <AuthHeader audience={audience} />

      <div className="mt-8" aria-live="polite">
        {phase === 'checking' && (
          <div role="status" className="flex items-center gap-3">
            <span className="ts-ink">
              <Spinner />
            </span>
            <p className="ts-ink text-lg font-medium">Checking your reset link…</p>
          </div>
        )}

        {phase === 'unreachable' && (
          <div role="alert">
            <BrokenLinkIcon />
            <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              We couldn&rsquo;t check your link
            </h1>
            <p className="ts-soft mt-3 text-base leading-relaxed">{checkError?.message}</p>
            <button
              type="button"
              onClick={check}
              className="ts-btn-primary mt-6 inline-flex min-h-[48px] items-center px-7 text-sm font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {phase === 'dead' &&
          (sent ? (
            <ResetLinkSent sent={sent} onAgain={() => setSent(null)} />
          ) : (
            <div>
              <BrokenLinkIcon />
              <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
                This reset link has expired or already been used
              </h1>
              <p className="ts-soft mt-3 text-base leading-relaxed">
                Reset links work for 1 hour and only once. Enter your email and we&rsquo;ll send you a new one.
              </p>
              <div className="mt-6">
                <ResetLinkRequestForm idPrefix="newLink" onSent={setSent} />
              </div>
            </div>
          ))}

        {phase === 'form' && (
          <>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Choose a new password
            </h1>
            <p className="ts-soft mt-2 text-sm leading-relaxed">
              Pick something you haven&rsquo;t used before. Once it&rsquo;s saved, you&rsquo;ll log in with it.
            </p>

            <form onSubmit={submit} noValidate className="mt-7 space-y-5">
              <PasswordField
                id="newPassword"
                label="New password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  clear('newPassword');
                }}
                error={errors.newPassword}
                placeholder="At least 8 characters"
                showStrength
                autoFocus
              />
              <PasswordField
                id="confirmPassword"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clear('confirmPassword');
                }}
                error={errors.confirmPassword}
                placeholder="Type it again"
              />

              {errors.general && (
                <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
                  {errors.general}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="ts-btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm font-medium"
              >
                <BusyLabel busy={saving} busyLabel="Saving…">
                  Save new password
                </BusyLabel>
              </button>
            </form>
          </>
        )}
      </div>

      <BackToLogin audience={audience} />
    </GlassScene>
  );
}
