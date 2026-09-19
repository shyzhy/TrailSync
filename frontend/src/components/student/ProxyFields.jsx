import { ChevronIcon, FieldError, WarningIcon } from '../ui/index.js';

// The proxy form, shared by the request form's pickup step and the late change at Ready for Pickup.
export const RELATIONSHIP_OPTIONS = ['Parent', 'Sibling', 'Spouse', 'Friend', 'Other'];

function RequiredMark() {
  return <span className="ts-error-text"> *</span>;
}

// errorFor(field) returns the server's message for proxy_full_name, relationship or contact_number, if any.
export function ProxyFields({ fullName, setFullName, relationship, setRelationship, contactNumber, setContactNumber, errorFor, idPrefix = 'proxy' }) {
  const ids = { fullName: `${idPrefix}FullName`, relationship: `${idPrefix}Relationship`, contactNumber: `${idPrefix}ContactNumber` };
  const invalid = (key, id) => (errorFor(key) ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {});
  const errorClass = (key) => (errorFor(key) ? 'ts-input-error' : '');

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={ids.fullName} className="ts-ink mb-1.5 block text-sm font-medium">
          Their full name
          <RequiredMark />
        </label>
        <input
          id={ids.fullName}
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          {...invalid('proxy_full_name', ids.fullName)}
          className={`ts-input w-full px-3.5 py-2.5 text-sm ${errorClass('proxy_full_name')}`}
        />
        <FieldError id={ids.fullName}>{errorFor('proxy_full_name')}</FieldError>
      </div>
      <div>
        <label htmlFor={ids.relationship} className="ts-ink mb-1.5 block text-sm font-medium">
          How are they related to you?
          <RequiredMark />
        </label>
        <div className="relative">
          <select
            id={ids.relationship}
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            {...invalid('relationship', ids.relationship)}
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
        <FieldError id={ids.relationship}>{errorFor('relationship')}</FieldError>
      </div>
      <div>
        <label htmlFor={ids.contactNumber} className="ts-ink mb-1.5 block text-sm font-medium">
          Their mobile number
          <RequiredMark />
        </label>
        <input
          id={ids.contactNumber}
          type="tel"
          inputMode="tel"
          placeholder="09XX XXX XXXX"
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          {...invalid('contact_number', ids.contactNumber)}
          className={`ts-input w-full px-3.5 py-2.5 text-sm ${errorClass('contact_number')}`}
        />
        <FieldError id={ids.contactNumber}>{errorFor('contact_number')}</FieldError>
      </div>
    </div>
  );
}

// Word for word what FM-USTP-RGTR-09 (Reminder B) requires: a notarized letter and both people's IDs.
export function ProxyPolicyNotice({ className = '' }) {
  return (
    <div className={`ts-warning-card p-6 ${className}`}>
      <div className="flex items-center gap-2">
        <WarningIcon />
        <h2 className="text-sm font-semibold">They must bring all three</h2>
      </div>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
        <li>
          An authorization letter from you, <strong>notarized</strong> by a lawyer (a signed letter alone won&rsquo;t
          be accepted)
        </li>
        <li>A photocopy of <strong>your</strong> valid ID</li>
        <li>A photocopy of <strong>their own</strong> valid ID</li>
      </ol>
      <p className="mt-3 text-sm leading-relaxed">Without all three, Window 6 can&rsquo;t release your document to them.</p>
    </div>
  );
}
