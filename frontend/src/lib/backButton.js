import { useEffect, useRef } from 'react';
import { IS_MOBILE_APP } from './platform.js';

// Android's back button in the app: whatever is open on top (a sheet, a popover, the tour) closes first, then a
// multi-step page steps back, and only then does the app navigate back. On the web this is inert.
const overlays = [];
const pages = [];

export function handleBackButton() {
  const handler = overlays[overlays.length - 1] || pages[pages.length - 1];
  if (!handler) return false;
  handler.current();
  return true;
}

// Registers `onBack` while `active` is true. `overlay` handlers (things drawn over the page) win over page handlers.
export function useBackButton(active, onBack, { overlay = false } = {}) {
  const ref = useRef(onBack);
  ref.current = onBack;

  useEffect(() => {
    if (!IS_MOBILE_APP || !active) return undefined;
    const stack = overlay ? overlays : pages;
    stack.push(ref);
    return () => {
      const i = stack.lastIndexOf(ref);
      if (i !== -1) stack.splice(i, 1);
    };
  }, [active, overlay]);
}
