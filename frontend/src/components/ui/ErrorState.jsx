import { useState } from 'react';
import { BusyLabel } from './BusyLabel.jsx';
import { LockIcon, SearchIcon, WarningIcon, WifiOffIcon } from './icons.jsx';

// What each kind of failure says by default, and which icon it wears.
const ERROR_KINDS = {
  // Retryable: a caller's headline leads and the kind's sentence explains why.
  network: {
    Icon: 'wifi',
    title: 'Can’t connect right now',
    message: 'Check your connection and try again.',
    retry: true,
  },
  server: {
    Icon: 'warning',
    title: 'Something went wrong on our end',
    message: 'Please try again in a moment.',
    retry: true,
  },
  rate_limited: {
    Icon: 'warning',
    title: 'Too many tries just now',
    message: 'Please wait a moment, then try again.',
    retry: true,
  },
  conflict: {
    Icon: 'warning',
    title: 'This changed while the page was open',
    message: 'Try again to see the latest.',
    retry: true,
  },
  // Trying again won't change these, so their own headline stands.
  forbidden: {
    Icon: 'lock',
    title: 'You don’t have permission to see this',
    message: 'If you think this is a mistake, ask the Registrar’s office.',
    retry: false,
    fixed: true,
  },
  not_found: {
    Icon: 'search',
    title: 'We couldn’t find that',
    message: 'It may have been removed, or the link may be wrong.',
    retry: false,
    fixed: true,
  },
  validation: {
    Icon: 'warning',
    title: 'That didn’t work',
    message: 'Please check what you entered and try again.',
    retry: false,
  },
};

// The generic sentences lib/api.js falls back to; the kind's own wording says it better.
const GENERIC_ERROR_MESSAGES = new Set([
  "You don't have permission to do that.",
  "We couldn't find that. It may have been removed, or the link may be wrong.",
]);

// A failed section or page, deliberately distinguishable from EmptyState; retry is offered only when it could help.
export function ErrorState({ error, title, message, onRetry, action, inline = false, boxed = true, className = '' }) {
  const [retrying, setRetrying] = useState(false);
  const kind = ERROR_KINDS[error?.kind] || ERROR_KINDS.server;
  const headline = kind.fixed ? kind.title : title || kind.title;
  const specific = error?.message && !GENERIC_ERROR_MESSAGES.has(error.message) ? error.message : '';
  let body = message;
  if (!body) {
    if (kind.fixed) body = specific || kind.message;
    else if (error?.kind === 'validation' || error?.kind === 'conflict') body = specific || kind.message;
    // With a caller's headline, the full sentence keeps the reason; under the kind's headline, just the next step.
    else body = title && specific ? specific : kind.message;
  }
  const canRetry = Boolean(onRetry) && kind.retry;

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  const Icon = { wifi: WifiOffIcon, lock: LockIcon, search: SearchIcon, warning: WarningIcon }[kind.Icon];
  const retryButton = canRetry && (
    <button
      type="button"
      onClick={retry}
      disabled={retrying}
      aria-busy={retrying}
      className={inline ? 'ts-link shrink-0 text-sm font-semibold' : 'ts-btn-primary inline-flex min-h-[44px] items-center px-6 text-sm font-medium'}
    >
      <BusyLabel busy={retrying} busyLabel="Trying…">
        Try again
      </BusyLabel>
    </button>
  );

  if (inline) {
    return (
      <div role="alert" className={`ts-error-state-inline text-sm ${className}`}>
        <span className="min-w-0">
          <strong className="font-semibold">{headline}.</strong> {body}
        </span>
        {retryButton || action}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`flex flex-col items-center px-6 py-14 text-center ${boxed ? 'ts-card ts-error-state' : ''} ${className}`}
    >
      <span className="ts-error-icon" aria-hidden="true">
        <Icon />
      </span>
      <p className="ts-ink mt-4 text-base font-semibold">{headline}</p>
      <p className="ts-soft mt-1.5 max-w-sm text-sm leading-relaxed">{body}</p>
      {(retryButton || action) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {retryButton}
          {action}
        </div>
      )}
    </div>
  );
}
