import { useEffect, useState } from 'react';
import {
  API_BASE_URL,
  CheckSealIcon,
  ChevronIcon,
  EyeIcon,
  EyeOffIcon,
  FONT_SERIF,
  GlassScene,
  Spinner,
} from './trailsyncUI.jsx';
import { friendlyMessage, NETWORK_ERROR } from '../lib/friendlyErrors.js';

// Placeholder program list — swap for the real USTP–CDO offerings.
const COURSES = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Computer Engineering',
  'BS Civil Engineering',
  'BS Electrical Engineering',
  'BS Electronics Engineering',
  'BS Mechanical Engineering',
  'BS Chemical Engineering',
  'BS Architecture',
  'BS Accountancy',
  'BS Business Administration',
  'BS Food Technology',
  'BS Environmental Science',
  'BS Secondary Education',
];

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USTP_DOMAIN_RE = /@ustp\.edu\.ph$/i;

// Redirect delay after a successful signup, long enough to read the message.
const REDIRECT_DELAY_MS = 2500;
const LOGIN_PATH = '/';

// DRF replies with {"<model_field>": ["message"]}. Translate those field names
// into this form's state keys so each message lands on its own input instead
// of in a generic alert.
const SERVER_FIELD_MAP = {
  email: 'email',
  password: 'password',
  confirm_password: 'confirmPassword',
  school_id_number: 'schoolId',
  first_name: 'firstName',
  last_name: 'lastName',
  course: 'course',
  year_level: 'yearLevel',
};

function mapServerErrors(data) {
  const fallback = { general: "We couldn't create your account just now. Please try again in a moment." };
  if (!data || typeof data !== 'object') return fallback;

  const mapped = {};
  const unattached = [];

  Object.entries(data).forEach(([key, value]) => {
    const message = Array.isArray(value)
      ? value.filter(Boolean).map(friendlyMessage).join(' ')
      : typeof value === 'string'
        ? friendlyMessage(value)
        : null;
    if (!message) return;

    const target = SERVER_FIELD_MAP[key];
    if (target) mapped[target] = message;
    // detail, non_field_errors, user_category, middle_name: no inline slot
    else unattached.push(message);
  });

  if (unattached.length) mapped.general = unattached.join(' ');
  return Object.keys(mapped).length ? mapped : fallback;
}

function passwordStrength(pw) {
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

export default function CreateAccountPage() {
  const [userCategory, setUserCategory] = useState('Student');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const strength = passwordStrength(password);

  // Let the confirmation actually be read, then hand off to the login page.
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => {
      window.location.href = LOGIN_PATH;
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [success]);

  // Drop a field's error as soon as the user starts fixing it — otherwise a
  // stale error lingers (and, on the password field, hides the strength hint).
  const clearError = (key) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const bind = (key, setter) => (e) => {
    setter(e.target.value);
    clearError(key);
  };

  const handleCategoryChange = (nextCategory) => {
    if (nextCategory === userCategory) return;
    setUserCategory(nextCategory);
    // Year level only applies to students.
    if (nextCategory === 'Alumni') setYearLevel('');
    setErrors((prev) => ({ ...prev, yearLevel: undefined }));
  };

  const validate = () => {
    const next = {};

    if (!firstName.trim()) next.firstName = 'Please enter your first name.';
    if (!lastName.trim()) next.lastName = 'Please enter your last name.';
    if (!schoolId.trim()) next.schoolId = 'Please enter your School ID number.';
    if (!course) next.course = 'Please choose your course.';
    if (userCategory === 'Student' && !yearLevel) next.yearLevel = 'Please choose your year level.';

    if (!email.trim()) {
      next.email = 'Please enter your USTP email.';
    } else if (!EMAIL_RE.test(email.trim()) || !USTP_DOMAIN_RE.test(email.trim())) {
      next.email = 'Please use your USTP email — the one ending in @ustp.edu.ph.';
    }

    if (!password) {
      next.password = 'Please choose a password.';
    } else if (password.length < 8) {
      next.password = 'Please use at least 8 characters.';
    }

    if (!confirmPassword) {
      next.confirmPassword = 'Please type your password again.';
    } else if (password !== confirmPassword) {
      next.confirmPassword = "This doesn't match the password above.";
    }

    if (!agreed) next.agreed = 'Please tick the box to agree before creating your account.';

    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Flat payload matching RegisterSerializer's fields exactly.
        body: JSON.stringify({
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
          school_id_number: schoolId.trim(),
          first_name: firstName.trim(),
          middle_name: middleName.trim(),
          last_name: lastName.trim(),
          course,
          year_level: userCategory === 'Student' ? yearLevel : '',
          user_category: userCategory,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrors(mapServerErrors(data));
        return;
      }

      setSuccess(true);
    } catch {
      setErrors({ general: NETWORK_ERROR });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <GlassScene maxWidth="440px">
        <h1 className="ts-ink text-4xl font-semibold tracking-tight" style={FONT_SERIF}>TrailSync</h1>
        <div className="ts-rule mt-3" />

        <div className="mt-10">
          <CheckSealIcon />
          <h2 className="ts-ink mt-5 text-2xl font-semibold" style={FONT_SERIF}>
            Account created!
          </h2>
          {/* Was followed by a green banner repeating "Account created!" word for word. */}
          <p role="status" className="ts-soft mt-3 text-base leading-relaxed">
            You can log in now with your USTP email or School ID number and the password you just chose. No
            approval needed.
          </p>

          <a
            href={LOGIN_PATH}
            className="ts-btn-primary mt-7 flex w-full items-center justify-center py-2.5 text-sm font-medium"
          >
            Go to log in
          </a>
          <p className="ts-soft mt-3 text-center text-xs">Taking you there automatically…</p>
        </div>

        <p className="ts-soft mt-10 text-xs">
          Window 6 · Registrar's Office · Open Mon–Fri, 8:00–5:00
        </p>
      </GlassScene>
    );
  }

  return (
    <GlassScene maxWidth="440px">
      <h1 className="ts-ink text-4xl font-semibold tracking-tight" style={FONT_SERIF}>TrailSync</h1>
      <div className="ts-rule mt-3" />
      <p className="ts-soft mt-3 text-base">Create your account to request documents from the Registrar.</p>
      <p className="ts-soft mt-6 text-sm font-medium">Are you still studying at USTP, or have you graduated?</p>

      {/* User category — decides Year Level visibility, and the role assigned server-side */}
      <div
        role="radiogroup"
        aria-label="I am a"
        className="ts-toggle-track relative mt-2 grid grid-cols-2"
      >
        <div
          className="ts-toggle-thumb"
          style={{ transform: userCategory === 'Alumni' ? 'translateX(100%)' : 'translateX(0%)' }}
          aria-hidden="true"
        />
        <button
          type="button"
          role="radio"
          aria-checked={userCategory === 'Student'}
          onClick={() => handleCategoryChange('Student')}
          className={`ts-toggle-btn py-2 text-sm font-medium ${userCategory === 'Student' ? 'ts-toggle-btn-active' : ''}`}
        >
          Student
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={userCategory === 'Alumni'}
          onClick={() => handleCategoryChange('Alumni')}
          className={`ts-toggle-btn py-2 text-sm font-medium ${userCategory === 'Alumni' ? 'ts-toggle-btn-active' : ''}`}
        >
          Alumni
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="ts-ink mb-1.5 block text-sm font-medium">First name</label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={bind('firstName', setFirstName)}
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              placeholder="Juan"
              className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.firstName ? 'ts-input-error' : ''}`}
            />
            {errors.firstName && (
              <p id="firstName-error" className="ts-error-text mt-1.5 text-sm">{errors.firstName}</p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="ts-ink mb-1.5 block text-sm font-medium">Last name</label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={bind('lastName', setLastName)}
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              placeholder="Dela Cruz"
              className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.lastName ? 'ts-input-error' : ''}`}
            />
            {errors.lastName && (
              <p id="lastName-error" className="ts-error-text mt-1.5 text-sm">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="middleName" className="ts-ink mb-1.5 block text-sm font-medium">
            Middle name <span className="ts-soft font-normal">(optional)</span>
          </label>
          <input
            id="middleName"
            name="middleName"
            type="text"
            autoComplete="additional-name"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            placeholder="Santos"
            className="ts-input w-full px-3.5 py-2.5 text-sm"
          />
          <p className="ts-soft mt-1.5 text-xs">
            Type your name exactly as it is on your school records. It&rsquo;s printed on the forms you request.
          </p>
        </div>

        <div>
          <label htmlFor="schoolId" className="ts-ink mb-1.5 block text-sm font-medium">School ID number</label>
          <input
            id="schoolId"
            name="schoolId"
            type="text"
            value={schoolId}
            onChange={bind('schoolId', setSchoolId)}
            aria-invalid={Boolean(errors.schoolId)}
            aria-describedby={errors.schoolId ? 'schoolId-error' : undefined}
            placeholder="e.g. 2021300123"
            className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.schoolId ? 'ts-input-error' : ''}`}
          />
          {errors.schoolId && (
            <p id="schoolId-error" className="ts-error-text mt-1.5 text-sm">{errors.schoolId}</p>
          )}
        </div>

        <div className={`grid grid-cols-1 gap-5 ${userCategory === 'Student' ? 'sm:grid-cols-2' : ''}`}>
          <div>
            <label htmlFor="course" className="ts-ink mb-1.5 block text-sm font-medium">Course</label>
            <div className="relative">
              <select
                id="course"
                name="course"
                value={course}
                onChange={bind('course', setCourse)}
                aria-invalid={Boolean(errors.course)}
                aria-describedby={errors.course ? 'course-error' : undefined}
                className={`ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm ${errors.course ? 'ts-input-error' : ''}`}
              >
                <option value="">Choose your course</option>
                {COURSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <ChevronIcon />
              </span>
            </div>
            {errors.course && (
              <p id="course-error" className="ts-error-text mt-1.5 text-sm">{errors.course}</p>
            )}
          </div>

          {/* Year level is a student-only field. */}
          {userCategory === 'Student' && (
            <div>
              <label htmlFor="yearLevel" className="ts-ink mb-1.5 block text-sm font-medium">Year level</label>
              <div className="relative">
                <select
                  id="yearLevel"
                  name="yearLevel"
                  value={yearLevel}
                  onChange={bind('yearLevel', setYearLevel)}
                  aria-invalid={Boolean(errors.yearLevel)}
                  aria-describedby={errors.yearLevel ? 'yearLevel-error' : undefined}
                  className={`ts-input ts-select w-full px-3.5 py-2.5 pr-10 text-sm ${errors.yearLevel ? 'ts-input-error' : ''}`}
                >
                  <option value="">Choose your year</option>
                  {YEAR_LEVELS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <ChevronIcon />
                </span>
              </div>
              {errors.yearLevel && (
                <p id="yearLevel-error" className="ts-error-text mt-1.5 text-sm">{errors.yearLevel}</p>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="email" className="ts-ink mb-1.5 block text-sm font-medium">USTP email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={bind('email', setEmail)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            placeholder="juan.delacruz@ustp.edu.ph"
            className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.email ? 'ts-input-error' : ''}`}
          />
          {errors.email && (
            <p id="email-error" className="ts-error-text mt-1.5 text-sm">{errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="ts-ink mb-1.5 block text-sm font-medium">Password</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={bind('password', setPassword)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : 'password-strength'}
              placeholder="At least 8 characters"
              className={`ts-input w-full px-3.5 py-2.5 pr-11 text-sm ${errors.password ? 'ts-input-error' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="ts-icon-btn absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password ? (
            <p id="password-error" className="ts-error-text mt-1.5 text-sm">{errors.password}</p>
          ) : (
            strength && (
              <p id="password-strength" className="ts-soft mt-1.5 text-xs">
                Password strength: <span className={`${strength.className} font-medium`}>{strength.label}</span>
              </p>
            )
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="ts-ink mb-1.5 block text-sm font-medium">Type your password again</label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={bind('confirmPassword', setConfirmPassword)}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
              placeholder="Re-enter your password"
              className={`ts-input w-full px-3.5 py-2.5 pr-11 text-sm ${errors.confirmPassword ? 'ts-input-error' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              aria-pressed={showConfirm}
              className="ts-icon-btn absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
            >
              {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p id="confirmPassword-error" className="ts-error-text mt-1.5 text-sm">{errors.confirmPassword}</p>
          )}
        </div>

        {errors.general && (
          <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="agreed" className="flex cursor-pointer select-none items-start gap-2.5">
            <span className="ts-checkbox-wrap mt-0.5">
              <input
                id="agreed"
                name="agreed"
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  if (e.target.checked) setErrors((prev) => ({ ...prev, agreed: undefined }));
                }}
                aria-invalid={Boolean(errors.agreed)}
                aria-describedby={errors.agreed ? 'agreed-error' : undefined}
                className="ts-checkbox-input"
              />
              <span className="ts-checkbox-well" aria-hidden="true">
                <svg viewBox="0 0 12 10" fill="none" className="ts-checkbox-check">
                  <path d="M1 5.2 4.3 8.5 11 1.5" stroke="#FAF8F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
            <span className="ts-soft text-sm leading-relaxed">
              I agree to the <a href="#" className="ts-link font-medium">Terms &amp; Conditions</a> and{' '}
              <a href="#" className="ts-link font-medium">Privacy Policy</a>.
            </span>
          </label>
          {errors.agreed && (
            <p id="agreed-error" className="ts-error-text mt-1.5 text-sm">{errors.agreed}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="ts-btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium"
        >
          {loading && <Spinner />}
          {loading ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p className="ts-soft mt-6 text-sm">
        Already have an account?{' '}
        <a href="/" className="ts-link font-medium">Log in</a>
      </p>

      <p className="ts-soft mt-10 text-xs">
        Window 6 · Registrar's Office · Open Mon–Fri, 8:00–5:00
      </p>
    </GlassScene>
  );
}
