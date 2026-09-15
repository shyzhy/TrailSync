// Red text under a field; give the input aria-invalid and aria-describedby={`${id}-error`}.
export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={`${id}-error`} className="ts-field-error">
      {children}
    </p>
  );
}
