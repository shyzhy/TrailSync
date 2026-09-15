import { useEffect } from 'react';
import { useBackButton } from '../../lib/backButton.js';

export function useDismiss(open, onClose, ref) {
  useBackButton(open, onClose, { overlay: true });
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, ref]);
}
