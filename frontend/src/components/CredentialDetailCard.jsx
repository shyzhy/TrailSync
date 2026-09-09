import { FONT_SERIF, WarningIcon } from './trailsyncUI.jsx';

// TRANSACTION_TYPES.required_documents is free text (comma/semicolon/newline
// separated) rather than a structured list column, so it's split for display
// here — this is the only place that needs to know that, keeping the
// bulleted-list presentation independent of how the field is actually stored.
function splitRequirements(text) {
  if (!text) return [];
  return text
    .split(/[\n;,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    // required_documents is written as one comma-joined sentence, not an
    // actual list, so a mid-sentence fragment like "latest registration
    // form." reads oddly as its own bullet unless re-capitalized here.
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

export function formatFee(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && amount != null && amount !== '' ? `₱${n.toFixed(2)}` : null;
}

/**
 * Full detail for one TRANSACTION_TYPES row: description, common purposes,
 * requirements, fee, processing time, special notes, and an optional
 * "Request this document" deep-link. Deliberately just the content — not a
 * modal itself — so this same markup can be dropped into the Request Form's
 * Step 1 later without duplicating it; Credential Guide is what currently
 * wraps it in a popup (see CredentialGuidePage.jsx).
 */
export default function CredentialDetailCard({ transactionType, showRequestButton = true }) {
  const t = transactionType;
  const requirements = splitRequirements(t.required_documents);
  const fee = formatFee(t.fee_amount);

  return (
    <div>
      <h2 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
        {t.name}
      </h2>
      {t.description && <p className="ts-soft mt-2 text-sm leading-relaxed">{t.description}</p>}

      {t.common_purposes?.length > 0 && (
        <div className="mt-4">
          <p className="ts-review-label">Common Purpose(s)</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {t.common_purposes.map((p) => (
              <span key={p} className="ts-tag">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {requirements.length > 0 && (
        <div className="mt-5">
          <p className="ts-review-label">Requirements</p>
          <ul className="mt-2 space-y-1.5">
            {requirements.map((r, i) => (
              <li key={i} className="ts-ink flex items-start gap-2 text-sm leading-relaxed">
                <span className="mt-2 block h-1 w-1 shrink-0 rounded-full" style={{ background: '#B8872B' }} aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="ts-review-label">Fee</p>
          <p className="ts-stat-number mt-1 text-2xl font-semibold" style={FONT_SERIF}>
            {fee || 'No fee'}
          </p>
        </div>
        <div>
          <p className="ts-review-label">Standard Processing Time</p>
          <p className="ts-review-value mt-1">{t.processing_time || '—'}</p>
        </div>
      </div>

      {t.special_notes && (
        <div className="ts-warning-card mt-5 p-4">
          <div className="flex items-center gap-2">
            <WarningIcon />
            <span className="text-sm font-semibold">Special Notes</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed">{t.special_notes}</p>
        </div>
      )}

      {showRequestButton && (
        <a
          href={`/request-form?transaction_type=${t.id}`}
          className="ts-btn-primary mt-6 flex w-full items-center justify-center py-2.5 text-sm font-medium"
        >
          Request this document
        </a>
      )}
    </div>
  );
}
