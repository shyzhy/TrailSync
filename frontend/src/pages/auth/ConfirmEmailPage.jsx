import { useEffect, useState } from 'react';
import { CheckSealIcon, Spinner } from '../../components/ui/index.js';
import { APP_CSS } from '../../styles/appCss.js';
import { FONT_SANS, FONT_SERIF } from '../../styles/fonts.js';
import { authFetch, getAccessToken } from '../../lib/auth.js';

// Where the change-email link leads. Confirming needs a session, because the token is checked against the logged-in user.
export default function ConfirmEmailPage() {
  const [state, setState] = useState('checking'); // checking | needs-login | confirming | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('error');
      setMessage('This link is missing its verification token.');
      return;
    }
    if (!getAccessToken()) {
      setState('needs-login');
      return;
    }

    setState('confirming');
    authFetch('/api/me/change-email/confirm/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState('error');
          setMessage(data.detail || 'This link is invalid or has expired.');
          return;
        }
        setState('success');
        setMessage(data.detail || 'Your email has been updated.');
      })
      .catch(() => {
        setState('error');
        setMessage('Unable to reach the server. Please try again.');
      });
  }, []);

  return (
    <div className="ts-app-shell flex min-h-screen items-center justify-center p-6" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <div className="ts-card w-full max-w-md p-8 text-center">
        <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
          Confirm Email Change
        </h1>

        {(state === 'checking' || state === 'confirming') && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <span className="ts-ink">
              <Spinner />
            </span>
            <p className="ts-soft text-sm">Confirming your new email…</p>
          </div>
        )}

        {state === 'needs-login' && (
          <>
            <p className="ts-soft mt-4 text-sm">Please log in to confirm this email change.</p>
            <a href="/login" className="ts-btn-primary mt-6 inline-flex px-6 py-2.5 text-sm font-medium">
              Log in
            </a>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="mt-4 flex justify-center">
              <CheckSealIcon />
            </div>
            <p className="ts-soft mt-3 text-sm">{message}</p>
            <a href="/profile" className="ts-btn-primary mt-6 inline-flex px-6 py-2.5 text-sm font-medium">
              Back to profile
            </a>
          </>
        )}

        {state === 'error' && (
          <>
            <div role="alert" className="ts-banner ts-banner-error mt-5 px-3.5 py-2.5 text-sm">
              {message}
            </div>
            <a href="/profile" className="ts-btn-glass mt-5 inline-flex px-6 py-2.5 text-sm font-medium">
              Back to profile
            </a>
          </>
        )}
      </div>
    </div>
  );
}
