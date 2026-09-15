import { ChevronIcon, FieldError, HelpTip, WarningIcon } from '../../../components/ui/index.js';
import { FONT_SERIF } from '../../../styles/fonts.js';
import { RELATIONSHIP_OPTIONS } from './requestFormOptions.js';
import { MissingHint, RequiredMark, SubmitProblems, Switch } from './RequestFormParts.jsx';

// Step 3: whether someone else will collect the document.
export default function PickupStep({ form }) {
  const {
    errorClass,
    errorFor,
    generalError,
    goToStep,
    invalidProps,
    problemsFor,
    proxyContactNumber,
    proxyEnabled,
    proxyFullName,
    proxyRelationship,
    setProxyContactNumber,
    setProxyEnabled,
    setProxyFullName,
    setProxyRelationship,
    step3Missing,
    step3Valid,
  } = form;

  return (
    <>
      <div className="flex items-center">
        <h1 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
          Who will pick it up?
        </h1>
        <HelpTip label="What's a proxy?">
          A proxy is someone you trust &mdash; like a parent or friend &mdash; who picks up the document for
          you if you can&rsquo;t go to Window 6 yourself.
        </HelpTip>
      </div>
      <p className="ts-soft mt-1.5 text-base">
        Most people collect their own document. If someone else will collect it for you, tell us who.
      </p>
      <SubmitProblems general={generalError} {...problemsFor(3)} />

      <div className="ts-card mt-6 flex items-center justify-between gap-4 p-5">
        <label htmlFor="proxyEnabled" className="cursor-pointer">
          <p className="ts-ink text-sm font-semibold">Someone else will pick it up for me</p>
          <p className="ts-soft mt-1 text-sm">
            {proxyEnabled ? 'On — tell us about them below.' : 'Off — you will pick it up yourself.'}
          </p>
        </label>
        <Switch id="proxyEnabled" checked={proxyEnabled} onChange={(e) => setProxyEnabled(e.target.checked)} />
      </div>

      {proxyEnabled && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Stacked, the requirements come first: reading what to bring after typing is reading it too late. */}
          <div className="ts-card order-2 p-6 lg:order-1">
            <h2 className="ts-ink text-sm font-semibold">About the person picking it up</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="proxyFullName" className="ts-ink mb-1.5 block text-sm font-medium">
                  Their full name
                  <RequiredMark />
                </label>
                <input
                  id="proxyFullName"
                  type="text"
                  value={proxyFullName}
                  onChange={(e) => setProxyFullName(e.target.value)}
                  {...invalidProps('proxy_full_name', 'proxyFullName')}
                  className={`ts-input w-full px-3.5 py-2.5 text-sm ${errorClass('proxy_full_name')}`}
                />
                <FieldError id="proxyFullName">{errorFor('proxy_full_name')}</FieldError>
              </div>
              <div>
                <label htmlFor="proxyRelationship" className="ts-ink mb-1.5 block text-sm font-medium">
                  How are they related to you?
                  <RequiredMark />
                </label>
                <div className="relative">
                  <select
                    id="proxyRelationship"
                    value={proxyRelationship}
                    onChange={(e) => setProxyRelationship(e.target.value)}
                    {...invalidProps('relationship', 'proxyRelationship')}
                    className={`ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm ${errorClass('relationship')}`}
                  >
                    <option value="">Choose one</option>
                    {RELATIONSHIP_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <ChevronIcon />
                  </span>
                </div>
                <FieldError id="proxyRelationship">{errorFor('relationship')}</FieldError>
              </div>
              <div>
                <label htmlFor="proxyContactNumber" className="ts-ink mb-1.5 block text-sm font-medium">
                  Their mobile number
                  <RequiredMark />
                </label>
                <input
                  id="proxyContactNumber"
                  type="tel"
                  inputMode="tel"
                  placeholder="09XX XXX XXXX"
                  value={proxyContactNumber}
                  onChange={(e) => setProxyContactNumber(e.target.value)}
                  {...invalidProps('contact_number', 'proxyContactNumber')}
                  className={`ts-input w-full px-3.5 py-2.5 text-sm ${errorClass('contact_number')}`}
                />
                <FieldError id="proxyContactNumber">{errorFor('contact_number')}</FieldError>
              </div>
            </div>
          </div>

          {/* Word for word what FM-USTP-RGTR-09 (Reminder B) requires: a notarized letter and both people's IDs. */}
          <div className="ts-warning-card order-1 p-6 lg:order-2">
            <div className="flex items-center gap-2">
              <WarningIcon />
              <h2 className="text-sm font-semibold">They must bring all three</h2>
            </div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                An authorization letter from you, <strong>notarized</strong> by a lawyer (a signed letter
                alone won&rsquo;t be accepted)
              </li>
              <li>A photocopy of <strong>your</strong> valid ID</li>
              <li>A photocopy of <strong>their own</strong> valid ID</li>
            </ol>
            <p className="mt-3 text-sm leading-relaxed">Without all three, Window 6 can&rsquo;t release your document to them.</p>
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between gap-3">
        <button type="button" onClick={() => goToStep(2)} className="ts-btn-glass self-start px-6 py-2.5 text-sm font-medium">
          Back
        </button>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            disabled={!step3Valid}
            onClick={() => goToStep(4)}
            className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
          >
            Next
          </button>
          <MissingHint items={step3Missing} />
        </div>
      </div>
    </>
  );
}
