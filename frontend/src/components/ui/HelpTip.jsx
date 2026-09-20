import { useEffect, useRef, useState } from 'react';

// A small "?" with a one-sentence explanation: hover on desktop, tap on a phone, and never toggles the label it sits in.
export function HelpTip({ children, label = 'What does this mean?' }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [shift, setShift] = useState(0);
  const wrapRef = useRef(null);
  const bubbleRef = useRef(null);
  const open = pinned || hover;

  useEffect(() => {
    if (!pinned) return undefined;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPinned(false);
    };
    const esc = (e) => e.key === 'Escape' && setPinned(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [pinned]);

  // Keep the bubble on screen.
  useEffect(() => {
    if (!open || !bubbleRef.current) return;
    const r = bubbleRef.current.getBoundingClientRect();
    const margin = 12;
    if (r.left < margin) setShift(margin - r.left);
    else if (r.right > window.innerWidth - margin) setShift(window.innerWidth - margin - r.right);
  }, [open]);

  useEffect(() => {
    if (!open) setShift(0);
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className="ts-helptip"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="ts-helptip-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        ?
      </button>
      {open && (
        <span
          ref={bubbleRef}
          role="tooltip"
          className="ts-helptip-bubble"
          style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
