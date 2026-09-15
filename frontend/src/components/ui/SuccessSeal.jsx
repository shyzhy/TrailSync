// A seal that draws itself, for the moments a toast would be too quiet.
export function SuccessSeal({ size = 64 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="26.5" fill="rgba(79,122,106,0.10)" />
      <circle
        className="ts-seal-circle"
        cx="32"
        cy="32"
        r="26.5"
        stroke="#4F7A6A"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
      <path
        className="ts-seal-check"
        d="M20.5 33.5 L28.5 41.5 L44 25"
        stroke="#33574A"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
