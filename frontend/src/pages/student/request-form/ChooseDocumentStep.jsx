import { CheckIcon } from '../../../components/ui/index.js';
import { FONT_SERIF } from '../../../styles/fonts.js';
import { descriptionForTransactionType, iconForTransactionType } from './requestFormOptions.js';
import { MissingHint, SubmitProblems } from './RequestFormParts.jsx';

// Step 1: choose the document; paused ones are shown but cannot be picked.
export default function ChooseDocumentStep({ form }) {
  const {
    deepLinkUnavailable,
    generalError,
    goToStep,
    problemsFor,
    setTransactionTypeId,
    step1Missing,
    step1Valid,
    transactionTypeId,
    transactionTypes,
  } = form;

  return (
    <>
      <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
        Which document do you need?
      </h1>
      <p className="ts-soft mt-1.5 text-base">
        Pick one. You&rsquo;ll collect it at Window 6 once it&rsquo;s ready. Not sure which?{' '}
        <a href="/credential-guide" className="ts-link font-medium">
          See what each one is for
        </a>
        .
      </p>

      {deepLinkUnavailable && !transactionTypeId && (
        <p className="ts-banner ts-banner-pending mt-4 px-3.5 py-2.5 text-sm">
          The document you chose isn&rsquo;t currently available for request. You can pick another one below.
        </p>
      )}
      <SubmitProblems general={generalError} {...problemsFor(1)} />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {transactionTypes.map((t) => {
          const Icon = iconForTransactionType(t.name);
          const unavailable = t.is_available === false;
          const selected = !unavailable && String(t.id) === String(transactionTypeId);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTransactionTypeId(String(t.id))}
              aria-pressed={selected}
              disabled={unavailable}
              className={`ts-select-card p-5 ${selected ? 'ts-select-card-selected' : ''}`}
            >
              {selected && (
                <span className="ts-select-card-check">
                  <CheckIcon />
                </span>
              )}
              <div className="ts-stat-icon ts-stat-icon-blue">
                <Icon />
              </div>
              <p className="ts-ink mt-3 text-sm font-semibold">{t.name}</p>
              <p className="ts-soft mt-1 text-xs leading-relaxed">{descriptionForTransactionType(t)}</p>
              {unavailable && <span className="ts-tag ts-tag-muted mt-2">Not available right now</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-end gap-2">
        <button
          type="button"
          disabled={!step1Valid}
          onClick={() => goToStep(2)}
          className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
        >
          Next
        </button>
        <MissingHint items={step1Missing} />
      </div>
    </>
  );
}
