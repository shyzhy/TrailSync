import { useCallback, useRef, useState } from 'react';
import { useDismiss } from './useDismiss.js';
import { CloseIcon, QuestionIcon } from '../ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';

// Always in the same corner, for the person who is stuck but wouldn't think to look in the navigation.
export function HelpButton({ onStartTour }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  const links = [
    { href: '/credential-guide', title: 'Which document do I need?', body: 'See what each document is for and what it costs.' },
    { href: '/request-form', title: 'How do I request a document?', body: 'Four short steps, and we check everything with you before sending.' },
    { href: '/track-requests', title: 'Where is my request?', body: 'See how far along each request is.' },
  ];

  return (
    <div ref={ref}>
      {open && (
        <div className="ts-popover" style={{ position: 'fixed', right: 20, bottom: 84, width: 'min(320px, calc(100vw - 40px))' }}>
          <div className="px-4 pb-2 pt-4">
            <p className="ts-ink text-base font-semibold" style={FONT_SERIF}>How can we help?</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onStartTour();
            }}
            className="ts-popover-row"
          >
            <span>
              <span className="ts-ink block text-sm font-semibold">Show me around</span>
              <span className="ts-soft block text-sm">A quick tour of where everything is.</span>
            </span>
          </button>
          {links.map((l) => (
            <a key={l.href} href={l.href} className="ts-popover-row">
              <span>
                <span className="ts-ink block text-sm font-semibold">{l.title}</span>
                <span className="ts-soft block text-sm">{l.body}</span>
              </span>
            </a>
          ))}
          <p className="ts-soft px-4 py-3 text-sm" style={{ borderTop: '1px solid rgba(227,223,210,0.8)', background: 'rgba(227,223,210,0.22)' }}>
            Still stuck? The Registrar&rsquo;s staff at Window 6 can help you in person.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ts-help-fab"
        aria-haspopup="true"
        aria-expanded={open}
        data-tour="help"
      >
        {open ? <CloseIcon /> : <QuestionIcon />}
        {open ? 'Close' : 'Need help?'}
      </button>
    </div>
  );
}
