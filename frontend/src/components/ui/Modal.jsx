import { useEffect, useRef } from 'react';
import { CloseIcon } from './icons.jsx';
import { useBackButton } from '../../lib/backButton.js';

// A dialog over a dimmed page: closes on Escape, the close button or a click outside, and takes focus when it opens.
export function Modal({ label, onClose, children, className = '' }) {
  const panelRef = useRef(null);
  // In the Android app, the back button closes the dialog rather than leaving the page under it.
  useBackButton(true, onClose, { overlay: true });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ts-modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`ts-modal-panel p-6 outline-none sm:p-8 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="ts-modal-close">
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
  );
}
