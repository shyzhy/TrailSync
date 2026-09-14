import { useState } from 'react';
import { EyeIcon, EyeOffIcon, FieldError } from './trailsyncUI.jsx';

/**
 * A rough guide to how guessable a new password is. Only a hint: the server
 * runs Django's real password validators and has the final say.
 */
export function passwordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { label: 'Weak', className: 'ts-soft' };
  if (score <= 3) return { label: 'Medium', className: 'ts-gold' };
  return { label: 'Strong', className: 'ts-sage' };
}

/**
 * A password input with a show/hide button, used wherever someone chooses a
 * password (Create Account, Reset Password). The strength line shows under
 * a new password until there's an error to show there instead.
 */
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  autoComplete = 'new-password',
  showStrength = false,
  autoFocus = false,
}) {
  const [show, setShow] = useState(false);
  const strength = showStrength ? passwordStrength(value) : null;
  const describedBy = error ? `${id}-error` : strength ? `${id}-strength` : undefined;

  return (
    <div>
      <label htmlFor={id} className="ts-ink mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          placeholder={placeholder}
          className={`ts-input w-full py-2.5 pl-3.5 pr-12 text-sm ${error ? 'ts-input-error' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="ts-eye-btn"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <FieldError id={id}>{error}</FieldError>
      {!error && strength && (
        <p id={`${id}-strength`} className="ts-soft mt-1.5 text-xs">
          Password strength: <span className={`${strength.className} font-medium`}>{strength.label}</span>
        </p>
      )}
    </div>
  );
}
