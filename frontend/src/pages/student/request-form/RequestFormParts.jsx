import { CheckIcon } from '../../../components/ui/index.js';
import { STEP_LABELS } from './requestFormOptions.js';

// "a", "a and b", "a, b and c".
function joinList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// Says why Next is greyed out, as guidance rather than an error.
export function MissingHint({ items }) {
  if (!items.length) return null;
  const [first, ...rest] = items;
  const text = items.length === 1 && first.startsWith('choose') ? `${first[0].toUpperCase()}${first.slice(1)} to continue.` : `To continue, add ${joinList([first, ...rest])}.`;
  return (
    <p className="ts-soft text-right text-sm" aria-live="polite">
      {text}
    </p>
  );
}

// Four numbered badges; below 768px only the badges show, with the current step named underneath.
export function Stepper({ current }) {
  return (
    <div className="mb-9">
      <div className="flex items-start">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const state = num < current ? 'done' : num === current ? 'current' : 'upcoming';
        return (
          <div key={label} className={`flex items-center ${num < STEP_LABELS.length ? 'flex-1' : ''}`}>
            <div className="flex w-11 flex-col items-center md:w-[84px]">
              <span className={`ts-step-badge ts-step-badge-${state}`}>
                {state === 'done' ? <CheckIcon /> : num}
              </span>
              <span
                className={`mt-2 hidden text-center text-xs leading-snug md:block ${
                  state === 'current' ? 'ts-ink font-semibold' : 'ts-soft'
                }`}
              >
                {label}
              </span>
            </div>
            {num < STEP_LABELS.length && (
              <div className={`ts-step-connector mx-1 sm:mx-2 ${state === 'done' ? 'ts-step-connector-done' : ''}`} />
            )}
          </div>
        );
      })}
      </div>

      <p className="ts-ink mt-3 text-center text-sm font-semibold md:hidden">
        <span className="ts-soft font-normal">Step {current} of {STEP_LABELS.length}: </span>
        {STEP_LABELS[current - 1]}
      </p>
    </div>
  );
}

// Top-of-step note after the server turned the request down, listing problems with no field of their own.
export function SubmitProblems({ general, loose, hasInline }) {
  const fieldProblems = loose.length > 0 || hasInline;
  if (!general && !fieldProblems) return null;
  return (
    <div role="alert" className="ts-banner ts-banner-error mt-4 px-3.5 py-2.5 text-sm">
      {fieldProblems && <p className="font-semibold">Your request hasn&rsquo;t been sent yet.</p>}
      {general && <p className={fieldProblems ? 'mt-1' : ''}>{general}</p>}
      {loose.map((m) => (
        <p key={m} className="mt-1">
          {m}
        </p>
      ))}
      {hasInline && <p className="mt-1">Please fix the answers marked in red below, then send it again.</p>}
    </div>
  );
}

export function RequiredMark() {
  return <span className="ts-error-text"> *</span>;
}

export function Switch({ checked, onChange, id }) {
  return (
    <span className="ts-switch-wrap">
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="ts-switch-input" />
      <span className="ts-switch-track" aria-hidden="true" />
      <span className="ts-switch-thumb" aria-hidden="true" />
    </span>
  );
}
