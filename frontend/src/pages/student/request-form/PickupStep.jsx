import { HelpTip } from '../../../components/ui/index.js';
import { ProxyFields, ProxyPolicyNotice } from '../../../components/student/ProxyFields.jsx';
import { FONT_SERIF } from '../../../styles/fonts.js';
import { MissingHint, SubmitProblems, Switch } from './RequestFormParts.jsx';

// Step 3: whether someone else will collect the document.
export default function PickupStep({ form }) {
  const {
    errorFor,
    generalError,
    goToStep,
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
            <div className="mt-4">
              <ProxyFields
                fullName={proxyFullName}
                setFullName={setProxyFullName}
                relationship={proxyRelationship}
                setRelationship={setProxyRelationship}
                contactNumber={proxyContactNumber}
                setContactNumber={setProxyContactNumber}
                errorFor={errorFor}
              />
            </div>
          </div>

          <ProxyPolicyNotice className="order-1 lg:order-2" />
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
