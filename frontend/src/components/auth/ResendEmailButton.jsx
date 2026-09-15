import { useEffect, useState } from 'react';
import { BusyLabel } from '../ui/index.js';
import { API_BASE_URL } from '../../lib/config.js';
import { NETWORK_ERROR } from '../../lib/friendlyErrors.js';

const COOLDOWN_SECONDS = 60;

// "Resend email" with a one-minute visible cooldown, so an impatient second click doesn't make the first email look lost.
export default function ResendEmailButton({ email, className = '', variant = 'glass' }) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState(null); // { tone: 'ok' | 'error', text }

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/resend-activation/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setMessage({
          tone: 'error',
          text: 'We’ve sent quite a few emails already. Please wait a while, then try again.',
        });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setCooldown(COOLDOWN_SECONDS);
      setMessage({ tone: 'ok', text: 'Sent! It can take a minute or two — check your spam folder too.' });
    } catch {
      setMessage({ tone: 'error', text: NETWORK_ERROR });
    } finally {
      setSending(false);
    }
  };

  const label = cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={resend}
        disabled={sending || cooldown > 0 || !email}
        aria-busy={sending}
        className={
          variant === 'link'
            ? 'ts-link inline-flex min-h-[44px] items-center text-sm font-semibold underline underline-offset-2 disabled:no-underline disabled:opacity-70'
            : 'ts-btn-glass inline-flex min-h-[44px] items-center justify-center px-5 text-sm font-medium disabled:opacity-70'
        }
      >
        <BusyLabel busy={sending} busyLabel="Sending…">
          {label}
        </BusyLabel>
      </button>
      <p
        aria-live="polite"
        className="mt-1.5 min-h-[1.25rem] text-sm"
        style={{ color: message?.tone === 'error' ? '#991B1B' : '#2C4B3F' }}
      >
        {message?.text}
      </p>
    </div>
  );
}
