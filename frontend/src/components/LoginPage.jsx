import { useState } from 'react';
import {
  API_BASE_URL,
  EyeIcon,
  EyeOffIcon,
  FONT_SERIF,
  GlassScene,
  Spinner,
} from './trailsyncUI.jsx';
import { saveSession } from '../lib/auth.js';
import { friendlyMessage, NETWORK_ERROR, SERVER_ERROR } from '../lib/friendlyErrors.js';

const STUDENT_ROLES = ['Student', 'Alumni'];
const ROLE_ROUTES = { Student: '/portal', Alumni: '/portal', 'Registrar Staff': '/registrar/dashboard' };

export default function LoginPage() {
  const [role, setRole] = useState('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [pendingApproval, setPendingApproval] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleRoleChange = (nextRole) => {
    if (nextRole === role) return;
    setRole(nextRole);
    setErrors({});
    setPendingApproval(false);
  };

  const validate = () => {
    const next = {};
    if (!identifier.trim()) next.identifier = 'Please enter your email or School ID number.';
    if (!password) next.password = 'Please enter your password.';
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPendingApproval(false);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
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

      if (!response.ok) {
        if (response.status === 403 && /pending admin approval/i.test(data.detail || '')) {
          setPendingApproval(true);
        } else {
          setErrors({ general: data.detail ? friendlyMessage(data.detail) : SERVER_ERROR });
        }
        return;
      }

      const userRole = data.user?.role;
      const expectedStudentTab = STUDENT_ROLES.includes(userRole);
      if ((role === 'student' && !expectedStudentTab) || (role === 'staff' && expectedStudentTab)) {
        setErrors({
          general: expectedStudentTab
            ? 'This is a student account. Choose “Student / Alumni” above, then log in again.'
            : 'This is a Registrar staff account. Choose “Registrar Staff” above, then log in again.',
        });
        return;
      }

      // "Remember me" controls whether the session survives closing the tab.
      saveSession(data, remember);

      window.location.href = ROLE_ROUTES[userRole] || '/portal';
    } catch {
      setErrors({ general: NETWORK_ERROR });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassScene maxWidth="420px">
      {/* Logo + wordmark lockup. The logo is decorative — the wordmark beside
          it already carries the name, so alt is empty to avoid a double read.
          SIZING NOTE: the supplied PNG is 300x300 with the mark filling only
          ~45% of its canvas, so the box is scaled up to bring the mark itself
          to the wordmark's cap height, and the negative margin keeps that
          transparent padding from inflating the row. Swap in a tightly
          cropped file and this becomes height ~26px with margin 0. */}
      <div className="flex items-center gap-1">
        <img
          src="/trailsync-logo.png"
          alt=""
          aria-hidden="true"
          className="ts-logo shrink-0"
          style={{ height: '56px', width: 'auto', margin: '-8px 0', transform: 'translateY(-2px)' }}
        />
        <h1 className="ts-ink text-4xl font-semibold tracking-tight" style={FONT_SERIF}>TrailSync</h1>
      </div>
      <div className="ts-rule mt-3" />
      <p className="ts-soft mt-3 text-sm">USTP–CDO Registrar · Window 6</p>
      {/* The AI assistant isn't built yet, so the old line promising "AI
          assistance every step of the way" came out until it is. */}
      <p className="ts-soft mt-1.5 text-sm leading-relaxed">
        Request documents from the Registrar online, follow their progress, and pick them up at Window 6.
      </p>

      {/* Role toggle — physical sliding switch */}
      <div role="tablist" aria-label="Log in as" className="ts-toggle-track relative mt-9 grid grid-cols-2">
        <div
          className="ts-toggle-thumb"
          style={{ transform: role === 'staff' ? 'translateX(100%)' : 'translateX(0%)' }}
          aria-hidden="true"
        />
        <button
          type="button"
          role="tab"
          aria-selected={role === 'student'}
          onClick={() => handleRoleChange('student')}
          className={`ts-toggle-btn py-2 text-sm font-medium ${role === 'student' ? 'ts-toggle-btn-active' : ''}`}
        >
          Student / Alumni
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={role === 'staff'}
          onClick={() => handleRoleChange('staff')}
          className={`ts-toggle-btn py-2 text-sm font-medium ${role === 'staff' ? 'ts-toggle-btn-active' : ''}`}
        >
          Registrar Staff
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
        <div>
          <label htmlFor="identifier" className="ts-ink mb-1.5 block text-sm font-medium">
            {role === 'staff' ? 'Email' : 'Email or School ID number'}
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-invalid={Boolean(errors.identifier || errors.general)}
            aria-describedby={errors.identifier ? 'identifier-error' : undefined}
            placeholder={role === 'staff' ? 'e.g. maria.santos@ustp.edu.ph' : 'e.g. 2021300123 or juan.delacruz@ustp.edu.ph'}
            className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.identifier ? 'ts-input-error' : ''}`}
          />
          {errors.identifier && (
            <p id="identifier-error" className="ts-error-text mt-1.5 text-sm">{errors.identifier}</p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="ts-ink block text-sm font-medium">Password</label>
            {/* There's no online reset yet; this used to be a link to "#"
                that did nothing. Now it at least says what to do. */}
            <button
              type="button"
              onClick={() => setForgotOpen((o) => !o)}
              aria-expanded={forgotOpen}
              className="ts-link text-sm"
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
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password || errors.general)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              placeholder="Enter your password"
              className={`ts-input w-full px-3.5 py-2.5 pr-11 text-sm ${errors.password ? 'ts-input-error' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="ts-icon-btn absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="ts-error-text mt-1.5 text-sm">{errors.password}</p>
          )}
          {forgotOpen && (
            <p className="ts-info-note mt-2 px-3.5 py-2.5 text-sm">
              You can&rsquo;t reset your password online yet. Please ask at Window 6 in the Registrar&rsquo;s Office,
              and bring your school ID.
            </p>
          )}
        </div>

        {errors.general && (
          <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
            {errors.general}
          </div>
        )}

        {/* Shown on either tab: gated to the staff tab, a pending account
            signing in from the student tab got no message at all. */}
        {pendingApproval && (
          <div role="status" className="ts-banner ts-banner-pending px-3.5 py-2.5 text-sm">
            Your staff account is still waiting for approval. You&rsquo;ll be able to log in once an administrator
            approves it.
          </div>
        )}

        <div className="flex items-center">
          <label htmlFor="remember" className="flex cursor-pointer select-none items-center gap-2.5">
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="ts-btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium"
        >
          {loading && <Spinner />}
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      {role === 'student' && (
        <p className="ts-soft mt-6 text-sm">
          New to TrailSync?{' '}
          <a href="/create-account" className="ts-link font-medium">Create an account</a>
        </p>
      )}

      <p className="ts-soft mt-10 text-xs">
        Window 6 · Registrar's Office · Open Mon–Fri, 8:00–5:00
      </p>
    </GlassScene>
  );
}
