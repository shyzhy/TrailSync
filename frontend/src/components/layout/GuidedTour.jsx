import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FONT_SERIF } from '../../styles/fonts.js';

// Each step lists targets in order of preference; the first one visible wins, so one tour works on desktop and phone.
const TOUR_STEPS = [
  {
    targets: ['[data-tour="home"]', '[data-tour="menu"]'],
    title: 'This is your home page',
    body: 'It shows your latest requests at a glance, so you always know how things are going.',
  },
  {
    targets: ['[data-tour="request"]', '[data-tour="menu"]'],
    title: 'Request a document',
    body: 'Start here whenever you need something from the Registrar, like a Transcript of Records.',
  },
  {
    targets: ['[data-tour="track"]', '[data-tour="menu"]'],
    title: 'Track your requests',
    body: 'See how far along each request is, and download your forms when they are ready.',
  },
  {
    // The only way into notifications, so the tour points it out.
    targets: ['[data-tour="bell"]'],
    title: 'Updates come to the bell',
    body: 'A red number here means news about a request. Tap the bell, then "View all notifications" to see every update.',
  },
  {
    targets: ['[data-tour="guide"]', '[data-tour="menu"]'],
    title: 'Not sure what you need?',
    body: 'The Credential Guide explains each document, what it is for, and what it costs.',
  },
  {
    targets: ['[data-tour="help"]'],
    title: 'Help is always here',
    body: 'Tap "Need help?" any time you are stuck, or to see this tour again.',
  },
];

function visibleTarget(selectors) {
  for (const sel of selectors) {
    // The sidebar and bottom bar both carry the same data-tour values, and only one is visible at any width.
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

export function GuidedTour({ onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [viaMenu, setViaMenu] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef(null);
  const primaryRef = useRef(null);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  const measure = useCallback(() => {
    const el = visibleTarget(step.targets);
    setViaMenu(Boolean(el && el.getAttribute('data-tour') === 'menu' && !step.targets[0].includes('menu')));
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  // Place the card beside the highlighted element, to its right when there's room, always on screen.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 16;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    if (!rect) {
      setPos({ top: (vh - ch) / 2, left: (vw - cw) / 2 });
      return;
    }
    if (rect.right + m + cw < vw - m) {
      setPos({ top: clamp(rect.top - 10, m, vh - ch - m), left: rect.right + m });
    } else if (rect.bottom + m + ch < vh - m) {
      setPos({ top: rect.bottom + m, left: clamp(rect.left + rect.width / 2 - cw / 2, m, vw - cw - m) });
    } else {
      setPos({ top: clamp(rect.top - ch - m, m, vh - ch - m), left: clamp(rect.right - cw, m, vw - cw - m) });
    }
  }, [rect, index]);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, onClose]);

  const pad = 6;
  return (
    <div className="ts-tour-layer" role="dialog" aria-modal="true" aria-labelledby="ts-tour-title">
      {rect ? (
        <div
          className="ts-tour-spot"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="ts-tour-dim" />
      )}

      <div ref={cardRef} className="ts-tour-card" style={{ top: pos.top, left: pos.left }}>
        <div className="flex items-center justify-between gap-3">
          <p className="ts-soft text-sm">
            Step {index + 1} of {TOUR_STEPS.length}
          </p>
          <button type="button" onClick={onClose} className="ts-link text-sm font-medium">
            Skip tour
          </button>
        </div>
        <h2 id="ts-tour-title" className="ts-ink mt-2 text-lg font-semibold" style={FONT_SERIF}>
          {step.title}
        </h2>
        <p className="ts-soft mt-1.5 text-base leading-relaxed">{step.body}</p>
        {viaMenu && (
          <p className="ts-soft mt-2 text-sm">
            On your phone, you&rsquo;ll find this under <strong className="ts-ink">More</strong>.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="ts-tour-dots" aria-hidden="true">
            {TOUR_STEPS.map((_, i) => (
              <span key={i} data-on={i === index ? '1' : '0'} />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex((i) => i - 1)} className="ts-btn-glass px-4 py-2 text-sm font-medium">
                Back
              </button>
            )}
            <button
              ref={primaryRef}
              type="button"
              onClick={() => (last ? onClose() : setIndex((i) => i + 1))}
              className="ts-btn-primary px-5 py-2 text-sm font-medium"
            >
              {last ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
