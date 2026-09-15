import { useEffect } from 'react';
import { CloseIcon } from './icons.jsx';

export function Toast({ message, tone = 'success', onDismiss }) {
  const isError = tone === 'error';
  useEffect(() => {
    if (!message) return undefined;
    // Errors stay up longer and are announced immediately.
    const timer = setTimeout(() => onDismiss?.(), isError ? 8000 : 4200);
    return () => clearTimeout(timer);
  }, [message, onDismiss, isError]);

  if (!message) return null;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`ts-toast ${isError ? 'ts-toast-error' : ''}`}
    >
      <span className="ts-toast-accent" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button type="button" onClick={() => onDismiss?.()} aria-label="Dismiss" className="ts-toast-close">
        <CloseIcon />
      </button>
    </div>
  );
}
