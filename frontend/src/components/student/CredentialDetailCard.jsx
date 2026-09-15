import { WarningIcon } from '../ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';

// required_documents is free text, split into a list for display here.
function splitRequirements(text) {
  if (!text) return [];
  return text
    .split(/[\n;,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    // Re-capitalize fragments that were mid-sentence in the stored text.
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

export function formatFee(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && amount != null && amount !== '' ? `₱${n.toFixed(2)}` : null;
}

// "₱50.00 per copy": a bare amount read as the whole price, when the server multiplies it.
export function formatFeeWithUnit(t) {
  const fee = formatFee(t.fee_amount);
  if (!fee || Number(t.fee_amount) === 0) return 'No fee';
  return `${fee} ${t.pricing_unit === 'per_page' ? 'per page' : 'per copy'}`;
}

// Full detail for one document type. Content only, not a modal, so it can be reused inside the Request Form.
export default function CredentialDetailCard({ transactionType, showRequestButton = true }) {
  const t = transactionType;
  const requirements = splitRequirements(t.required_documents);
  const fee = formatFeeWithUnit(t);

  return (
    <div>
      <h2 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
        {t.name}
      </h2>
      {t.description && <p className="ts-soft mt-2 text-sm leading-relaxed">{t.description}</p>}

      {t.common_purposes?.length > 0 && (
        <div className="mt-4">
          <p className="ts-review-label">Often requested for</p>
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
          <p className="ts-review-label">What you&rsquo;ll need to bring</p>
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

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="ts-review-label">Fee</p>
          <p className="ts-stat-number mt-1 text-2xl font-semibold" style={FONT_SERIF}>
            {fee}
          </p>
          {fee !== 'No fee' && (
            <p className="ts-soft mt-0.5 text-xs">You pay at the Cashier once the Registrar approves your request.</p>
          )}
        </div>
        {/* Hidden rather than a bare dash, which on a phone reads as something failing to load. */}
        {t.processing_time && (
          <div>
            <p className="ts-review-label">Usually takes</p>
            <p className="ts-review-value mt-1">{t.processing_time}</p>
          </div>
        )}
      </div>

      {t.special_notes && (
        <div className="ts-warning-card mt-5 p-4">
          <div className="flex items-center gap-2">
            <WarningIcon />
            <span className="text-sm font-semibold">Good to know</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{t.special_notes}</p>
        </div>
      )}

      {/* A paused document can still be read about, but the button would lead to a form that refuses it. */}
      {showRequestButton && t.is_available === false && (
        <p className="ts-banner ts-banner-pending mt-6 px-4 py-3 text-sm">
          This document type isn&rsquo;t currently available for request. Please check again later, or ask at Window 6.
        </p>
      )}
      {showRequestButton && t.is_available !== false && (
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
