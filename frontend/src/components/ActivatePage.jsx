import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL, FONT_SERIF, GlassScene, Spinner, SuccessSeal } from './trailsyncUI.jsx';
import ResendEmailButton from './ResendEmailButton.jsx';
import { STUDENT_LOGIN_PATH, saveSession } from '../lib/auth.js';
import { NETWORK_ERROR } from '../lib/friendlyErrors.js';

function LinkIcon({ tone }) {
  const color = tone === 'warn' ? '#8C6620' : '#24406B';
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill={tone === 'warn' ? 'rgba(184,135,43,0.12)' : 'rgba(36,64,107,0.08)'} />
      <path d="M24 14v12" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="32.5" r="1.8" fill={color} />
    </svg>
  );
}

/**
 * /activate?uid=…&token=… — where the confirmation email's button leads.
 *
 * The page POSTs the token rather than the link doing it with a GET, because
 * many mail providers open every link in an incoming message to scan it; a
 * GET that activated the account and signed someone in would be triggered by
 * the scanner. On success the session is saved and the student goes straight
 * into onboarding - not to a login form asking for the password they chose
 * a minute ago.
 */
export default function ActivatePage() {
  const [state, setState] = useState({ phase: 'working' });
  const ran = useRef(false);

  useEffect(() => {
    // React's development double-mount would otherwise post twice, and the
    // second post would find the account already active.
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    const token = params.get('token');
    if (!uid || !token) {
      setState({ phase: 'invalid' });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/activate/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, token }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.access) {
          // Not "remember me": this could be a shared computer at school.
          // Onboarding saves every step, so a closed tab loses nothing.
          saveSession(data, false);
          setState({ phase: 'done', firstName: data.user?.first_name });
          // Long enough for the seal to draw, short enough not to be a wait.
          setTimeout(() => window.location.replace('/onboarding'), 1400);
          return;
        }
        if (data.code === 'already_active') setState({ phase: 'already', email: data.email });
        else if (data.code === 'expired') setState({ phase: 'expired', email: data.email });
        else if (res.status === 429) setState({ phase: 'throttled' });
        else setState({ phase: 'invalid' });
      } catch {
        setState({ phase: 'network' });
      }
    })();
  }, []);

  const { phase } = state;

  return (
    <GlassScene maxWidth="440px">
      <div className="flex items-center gap-1">
        <img
          src="/trailsync-logo.png"
          alt=""
          aria-hidden="true"
          className="ts-logo shrink-0"
          style={{ height: '48px', width: 'auto', margin: '-7px 0' }}
        />
        <span className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          TrailSync
        </span>
      </div>
      <div className="ts-rule mt-3" />

      <div className="mt-10" aria-live="polite">
        {phase === 'working' && (
          <div role="status" className="flex items-center gap-3">
            <span className="ts-ink">
              <Spinner />
            </span>
            <p className="ts-ink text-lg font-medium">Activating your account…</p>
          </div>
        )}

        {phase === 'done' && (
          <div role="status">
            <SuccessSeal />
            <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Your email is confirmed!
            </h1>
            <p className="ts-soft mt-3 text-base leading-relaxed">
              Taking you to set up your profile…
            </p>
            <a href="/onboarding" className="ts-link mt-4 inline-flex min-h-[44px] items-center text-sm font-medium">
              Continue now &rarr;
            </a>
          </div>
        )}

        {phase === 'expired' && (
          <div>
            <LinkIcon tone="warn" />
            <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              This link has expired
            </h1>
            <p className="ts-soft mt-3 text-base leading-relaxed">
              Confirmation links only work for 24 hours. No problem — we can send you a fresh one
              {state.email ? (
                <>
                  {' '}
                  to <strong className="ts-ink break-words">{state.email}</strong>
                </>
              ) : null}
              .
            </p>
            <ResendEmailButton email={state.email} className="mt-6" />
          </div>
        )}

        {phase === 'already' && (
          <div>
            <SuccessSeal />
            <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Your account is already active
            </h1>
            <p className="ts-soft mt-3 text-base leading-relaxed">
              This link was used before, so there&rsquo;s nothing more to confirm. Log in to carry on.
            </p>
            <a href={STUDENT_LOGIN_PATH} className="ts-btn-primary mt-6 inline-flex min-h-[48px] items-center px-7 text-sm font-medium">
              Log in
            </a>
          </div>
        )}

        {(phase === 'invalid' || phase === 'throttled' || phase === 'network') && (
          <div>
            <LinkIcon tone="warn" />
            <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              {phase === 'network' ? 'We couldn’t reach TrailSync' : 'This link isn’t working'}
            </h1>
            <p className="ts-soft mt-3 text-base leading-relaxed">
              {phase === 'network'
                ? NETWORK_ERROR
                : phase === 'throttled'
                  ? 'There have been a lot of attempts from here. Please wait a little while, then open the link again.'
                  : 'It may be incomplete — sometimes an email app cuts a long link short — or a newer email may have replaced it. Try the button in your most recent TrailSync email.'}
            </p>
            {phase === 'network' ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ts-btn-primary mt-6 inline-flex min-h-[48px] items-center px-7 text-sm font-medium"
              >
                Try again
              </button>
            ) : (
              <NewLinkForm />
            )}
          </div>
        )}
      </div>

      <p className="ts-soft mt-10 text-sm">
        Already set up?{' '}
        <a href={STUDENT_LOGIN_PATH} className="ts-link font-medium">
          Log in
        </a>
      </p>
    </GlassScene>
  );
}

/**
 * For a link too broken to say whose account it was: ask for the email and
 * send a new one. The server answers the same way for every address.
 */
function NewLinkForm() {
  const [email, setEmail] = useState('');
  const trimmed = email.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);

  return (
    <div className="mt-6">
      <label htmlFor="resendEmail" className="ts-ink mb-1.5 block text-sm font-medium">
        Send a new link to
      </label>
      <input
        id="resendEmail"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="The email you signed up with"
        className="ts-input w-full px-3.5 py-2.5 text-sm"
      />
      {/* Disabled until the address is well-formed; one tap sends. */}
      <ResendEmailButton email={valid ? trimmed : null} className="mt-3" />
    </div>
  );
}
