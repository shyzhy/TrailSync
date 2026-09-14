import { useEffect, useMemo, useState } from 'react';
import {
  APP_CSS,
  avatarUrlFor,
  BusyLabel,
  ChevronIcon,
  ErrorState,
  FieldError,
  FONT_SANS,
  FONT_SERIF,
  Skeleton,
  SkeletonGroup,
  SuccessSeal,
} from './trailsyncUI.jsx';
import { AvatarPicker, AvatarStatus, useAvatarUpload } from './AvatarUploader.jsx';
import { ACADEMIC_LEVELS, COURSES, USER_CATEGORIES, YEAR_LEVELS } from '../lib/academics.js';
import {
  STUDENT_LOGIN_PATH,
  authFetch,
  clearSession,
  getAccessToken,
  getStoredUser,
  updateStoredUser,
} from '../lib/auth.js';
import { errorFromResponse, formErrors, toApiError } from '../lib/api.js';

const LOGIN_PATH = STUDENT_LOGIN_PATH;

/**
 * The four steps, and the words each one opens with. Warmer than the
 * request form on purpose: this is someone's first real moment in the app.
 */
const STEPS = [
  {
    n: 1,
    label: 'About you',
    title: 'Let’s get to know you',
    lead: 'Tell us your name so we know who’s requesting documents.',
  },
  {
    n: 2,
    label: 'School details',
    title: 'Your academic details',
    lead: 'This is how Window 6 finds your records.',
  },
  {
    n: 3,
    label: 'Contact',
    title: 'How can we reach you?',
    lead: 'We’ll only use this to notify you about your requests — never for anything else.',
  },
  {
    n: 4,
    label: 'Photo',
    title: 'Add a profile picture',
    lead: 'Add a photo so staff can recognize you — or skip this and add one anytime later.',
  },
];
const TOTAL = STEPS.length;
const DONE = TOTAL + 1;

/** Local YYYY-MM-DD for today, for the date pickers' max. */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Field({ id, label, optional, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="ts-ink mb-1.5 block text-sm font-medium">
        {label} {optional && <span className="ts-soft font-normal">(optional)</span>}
      </label>
      {children}
      {error ? (
        <FieldError id={id}>{error}</FieldError>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="ts-soft mt-1.5 text-sm leading-relaxed">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function Select({ id, value, onChange, error, disabled, children }) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`ts-input ts-select w-full py-2.5 pl-3.5 pr-10 text-sm ${error ? 'ts-input-error' : ''} disabled:opacity-70`}
      >
        {children}
      </select>
      <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <ChevronIcon />
      </span>
    </div>
  );
}

/**
 * /onboarding — the setup wizard after a student confirms their email.
 *
 * Every Continue saves that step to the server straight away, so closing
 * the tab halfway loses nothing: the next visit (or login) opens on the
 * first step the server still reports as missing. Which step that is comes
 * from profile.onboarding, computed from the data itself, so the page never
 * keeps its own idea of "done" that could disagree with what's saved.
 */
export default function OnboardingPage() {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [me, setMe] = useState(() => getStoredUser());
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState('fwd');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState(null);

  const [values, setValues] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    schoolId: '',
    course: '',
    userCategory: '',
    academicLevel: '',
    yearLevel: '',
    graduationDate: '',
    birthDate: '',
    contactNumber: '',
  });

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((prev) => (prev[key] || prev.general ? { ...prev, [key]: undefined, general: undefined } : prev));
  };

  const logOut = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  // ---- Load, and decide where to start --------------------------------
  const load = async () => {
    setStatus('loading');
    setLoadError(null);
    {
      try {
        const res = await authFetch('/api/me/');
        if (!res.ok) throw await errorFromResponse(res);
        const data = await res.json();
        const p = data.profile;
        if (!p?.onboarding) {
          // Staff have no student profile to set up.
          window.location.replace('/registrar/dashboard');
          return;
        }
        if (p.onboarding.complete) {
          // Arriving here with nothing left to do: straight to the app.
          window.location.replace('/portal');
          return;
        }
        setMe(data);
        updateStoredUser(data);
        setValues({
          firstName: data.first_name || '',
          middleName: p.middle_name || '',
          lastName: data.last_name || '',
          schoolId: p.school_id_number || '',
          course: p.course || '',
          userCategory: p.user_category || '',
          academicLevel: p.academic_level || '',
          yearLevel: p.year_level || '',
          graduationDate: p.graduation_date || '',
          birthDate: p.birth_date || '',
          contactNumber: data.contact_number || '',
        });
        setStep(p.onboarding.next_step || 1);
        setStatus('ready');
      } catch (error) {
        setLoadError(toApiError(error));
        setStatus('error');
      }
    }
  };

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locked = Boolean(me?.profile?.onboarding?.academic_locked);
  const levelOptions = useMemo(() => ACADEMIC_LEVELS[values.userCategory] || [], [values.userCategory]);

  const go = (n) => {
    setErrors({});
    setDirection(n >= step ? 'fwd' : 'back');
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- Per-step checks, in the same plain words as the server's --------
  const validate = (n) => {
    const e = {};
    if (n === 1) {
      if (!values.firstName.trim()) e.firstName = 'Please enter your first name.';
      if (!values.lastName.trim()) e.lastName = 'Please enter your last name.';
    }
    if (n === 2) {
      if (!values.schoolId.trim()) e.schoolId = 'Please enter your School ID number.';
      if (!values.userCategory) e.userCategory = 'Please choose Student or Alumni.';
      if (!values.course) e.course = 'Please choose your course.';
      if (!values.academicLevel) e.academicLevel = 'Please choose your academic level.';
      if (values.userCategory === 'Student' && !values.yearLevel) e.yearLevel = 'Please choose your year level.';
      if (values.userCategory === 'Alumni') {
        if (!values.graduationDate) e.graduationDate = 'Please enter your graduation date.';
        else if (values.graduationDate > todayIso()) e.graduationDate = 'Your graduation date can’t be in the future.';
      }
    }
    if (n === 3) {
      if (!values.birthDate) e.birthDate = 'Please enter your birth date.';
      else if (values.birthDate >= todayIso()) e.birthDate = 'Your birth date has to be in the past.';
      const digits = values.contactNumber.replace(/[\s()-]/g, '');
      if (!digits) e.contactNumber = 'Please enter your mobile number.';
      else if (!/^\+?\d{10,13}$/.test(digits)) e.contactNumber = 'Please enter a valid mobile number, like 09171234567.';
    }
    return e;
  };

  const payloadFor = (n) => {
    if (n === 1) {
      return { step: 'name', first_name: values.firstName, middle_name: values.middleName, last_name: values.lastName };
    }
    if (n === 2) {
      return {
        step: 'academic',
        school_id_number: values.schoolId,
        course: values.course,
        user_category: values.userCategory,
        academic_level: values.academicLevel,
        year_level: values.userCategory === 'Student' ? values.yearLevel : '',
        graduation_date: values.userCategory === 'Alumni' ? values.graduationDate : null,
      };
    }
    return { step: 'contact', birth_date: values.birthDate, contact_number: values.contactNumber };
  };

  // Server field names -> this page's state keys, for inline errors.
  const FIELD_KEYS = {
    first_name: 'firstName',
    middle_name: 'middleName',
    last_name: 'lastName',
    school_id_number: 'schoolId',
    course: 'course',
    user_category: 'userCategory',
    academic_level: 'academicLevel',
    year_level: 'yearLevel',
    graduation_date: 'graduationDate',
    birth_date: 'birthDate',
    contact_number: 'contactNumber',
  };

  const saveAndContinue = async () => {
    if (saving) return;
    const found = validate(step);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const res = await authFetch('/api/me/onboarding/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFor(step)),
      });
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setMe(data);
      updateStoredUser(data);
      go(step + 1);
    } catch (error) {
      // Nothing on this step was saved, and what they typed stays put.
      setErrors(formErrors(error, FIELD_KEYS));
    } finally {
      setSaving(false);
    }
  };

  const avatar = useAvatarUpload({
    onUpdated: (data) => {
      setMe(data);
      updateStoredUser(data);
    },
  });

  const current = STEPS[step - 1];
  const hasPhoto = Boolean(avatarUrlFor(me));

  return (
    <div className="ts-app-shell" style={FONT_SANS}>
      <style>{APP_CSS + ONBOARDING_CSS}</style>

      {/* No app navigation yet: the one way forward is finishing setup. Log
          out stays available, because a shared computer might need it. */}
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-6 sm:px-6">
        <span className="flex items-center gap-1">
          <img src="/trailsync-logo.png" alt="" aria-hidden="true" style={{ height: 40, width: 'auto', margin: '-7px -2px' }} />
          <span className="ts-ink text-xl font-semibold tracking-tight" style={FONT_SERIF}>
            TrailSync
          </span>
        </span>
        <button type="button" onClick={logOut} className="ts-link inline-flex min-h-[44px] items-center px-2 text-sm font-medium">
          Log out
        </button>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pb-16 pt-8 sm:px-6">
        {status === 'loading' && (
          <SkeletonGroup label="Loading your setup">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-2 w-full rounded-full" />
            <div className="ts-skeleton-card mt-8 space-y-4 p-8">
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <Skeleton className="mt-4 h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </SkeletonGroup>
        )}

        {status === 'error' && (
          <ErrorState error={loadError} title="We couldn&rsquo;t load your setup" onRetry={load} />
        )}

        {status === 'ready' && step <= TOTAL && (
          <>
            {/* ---- Progress: one line and one bar, not a dense stepper ---- */}
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="ts-ink text-sm font-semibold">
                  Step {step} of {TOTAL} <span className="ts-soft font-normal">· {current.label}</span>
                </p>
                <p className="ts-soft text-xs">Saved as you go</p>
              </div>
              <div
                className="ts-onb-track mt-2.5"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={TOTAL}
                aria-valuenow={step}
                aria-label={`Step ${step} of ${TOTAL}`}
              >
                <div className="ts-onb-fill" style={{ width: `${(step / TOTAL) * 100}%` }} />
              </div>
            </div>

            <section key={`step-${step}`} className={`ts-card mt-7 p-6 sm:p-9 ts-step-enter-${direction}`} aria-labelledby="onb-title">
              <h1 id="onb-title" className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
                {current.title}
              </h1>
              <p className="ts-soft mt-2 text-base leading-relaxed">{current.lead}</p>

              <div className="mt-7 space-y-5">
                {/* ======================== 1 · Name ======================== */}
                {step === 1 && (
                  <>
                    <Field id="firstName" label="First name" error={errors.firstName}>
                      <input
                        id="firstName"
                        autoFocus
                        autoComplete="given-name"
                        value={values.firstName}
                        onChange={set('firstName')}
                        aria-invalid={Boolean(errors.firstName)}
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.firstName ? 'ts-input-error' : ''}`}
                        placeholder="Juan"
                      />
                    </Field>
                    <Field id="middleName" label="Middle name" optional>
                      <input
                        id="middleName"
                        autoComplete="additional-name"
                        value={values.middleName}
                        onChange={set('middleName')}
                        className="ts-input w-full px-3.5 py-2.5 text-sm"
                        placeholder="Santos"
                      />
                    </Field>
                    <Field
                      id="lastName"
                      label="Last name"
                      error={errors.lastName}
                      hint="Type it exactly as it is on your school records — it’s printed on the forms you request."
                    >
                      <input
                        id="lastName"
                        autoComplete="family-name"
                        value={values.lastName}
                        onChange={set('lastName')}
                        aria-invalid={Boolean(errors.lastName)}
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.lastName ? 'ts-input-error' : ''}`}
                        placeholder="Dela Cruz"
                      />
                    </Field>
                  </>
                )}

                {/* ====================== 2 · Academics ====================== */}
                {step === 2 && (
                  <>
                    {locked && (
                      <p className="ts-info-note px-4 py-3 text-sm leading-relaxed">
                        Your School ID number, course and category are already on file with a request, so they
                        can&rsquo;t be changed here. If something&rsquo;s wrong, ask at Window 6.
                      </p>
                    )}

                    <Field
                      id="schoolId"
                      label="School ID number"
                      error={errors.schoolId}
                      hint="This is the ID number on your USTP registration — we use it to match your records at Window 6."
                    >
                      <input
                        id="schoolId"
                        autoFocus={!locked}
                        inputMode="numeric"
                        value={values.schoolId}
                        onChange={set('schoolId')}
                        disabled={locked && Boolean(me?.profile?.school_id_number)}
                        aria-invalid={Boolean(errors.schoolId)}
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.schoolId ? 'ts-input-error' : ''} disabled:opacity-70`}
                        placeholder="e.g. 2021300123"
                      />
                    </Field>

                    <fieldset>
                      <legend className="ts-ink mb-1.5 block text-sm font-medium">Are you a student or alumni?</legend>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {USER_CATEGORIES.map((c) => {
                          const on = values.userCategory === c.value;
                          return (
                            <button
                              key={c.value}
                              type="button"
                              aria-pressed={on}
                              disabled={locked && Boolean(me?.profile?.user_category)}
                              onClick={() => {
                                set('userCategory')(c.value);
                                // A level that doesn't exist for the new
                                // category would otherwise stay selected.
                                if (!ACADEMIC_LEVELS[c.value].includes(values.academicLevel)) set('academicLevel')('');
                              }}
                              className={`ts-select-card px-4 py-3.5 text-left disabled:opacity-70 ${on ? 'ts-select-card-selected' : ''}`}
                            >
                              <span className="ts-ink block text-base font-semibold">{c.label}</span>
                              <span className="ts-soft mt-0.5 block text-sm">{c.hint}</span>
                            </button>
                          );
                        })}
                      </div>
                      <FieldError id="userCategory">{errors.userCategory}</FieldError>
                    </fieldset>

                    <Field id="course" label="Course" error={errors.course}>
                      <Select
                        id="course"
                        value={values.course}
                        onChange={set('course')}
                        error={errors.course}
                        disabled={locked && Boolean(me?.profile?.course)}
                      >
                        <option value="">Choose your course</option>
                        {/* Keep a saved course visible even if the list changes. */}
                        {values.course && !COURSES.includes(values.course) && <option value={values.course}>{values.course}</option>}
                        {COURSES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <Field id="academicLevel" label="Academic level" error={errors.academicLevel}>
                        <Select
                          id="academicLevel"
                          value={values.academicLevel}
                          onChange={set('academicLevel')}
                          error={errors.academicLevel}
                          disabled={!values.userCategory}
                        >
                          <option value="">{values.userCategory ? 'Choose a level' : 'Choose student or alumni first'}</option>
                          {levelOptions.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      {values.userCategory === 'Student' && (
                        <Field id="yearLevel" label="Year level" error={errors.yearLevel}>
                          <Select id="yearLevel" value={values.yearLevel} onChange={set('yearLevel')} error={errors.yearLevel}>
                            <option value="">Choose your year</option>
                            {YEAR_LEVELS.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      )}

                      {values.userCategory === 'Alumni' && (
                        <Field id="graduationDate" label="Graduation date" error={errors.graduationDate}>
                          <input
                            id="graduationDate"
                            type="date"
                            max={todayIso()}
                            value={values.graduationDate}
                            onChange={set('graduationDate')}
                            aria-invalid={Boolean(errors.graduationDate)}
                            className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.graduationDate ? 'ts-input-error' : ''}`}
                          />
                        </Field>
                      )}
                    </div>
                  </>
                )}

                {/* ======================= 3 · Contact ======================= */}
                {step === 3 && (
                  <>
                    <Field id="birthDate" label="Birth date" error={errors.birthDate}>
                      <input
                        id="birthDate"
                        type="date"
                        autoFocus
                        max={todayIso()}
                        autoComplete="bday"
                        value={values.birthDate}
                        onChange={set('birthDate')}
                        aria-invalid={Boolean(errors.birthDate)}
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.birthDate ? 'ts-input-error' : ''}`}
                      />
                    </Field>
                    <Field
                      id="contactNumber"
                      label="Mobile number"
                      error={errors.contactNumber}
                      hint="The number we can text or call if there’s an update about your request."
                    >
                      <input
                        id="contactNumber"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={values.contactNumber}
                        onChange={set('contactNumber')}
                        aria-invalid={Boolean(errors.contactNumber)}
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${errors.contactNumber ? 'ts-input-error' : ''}`}
                        placeholder="09XX XXX XXXX"
                      />
                    </Field>
                  </>
                )}

                {/* ======================== 4 · Photo ======================== */}
                {step === 4 && (
                  <div className="flex flex-col items-center py-2 text-center">
                    <AvatarPicker me={me} upload={avatar} />
                    <p className="ts-soft mt-4 text-sm">JPEG, PNG or WebP, up to 5 MB. We&rsquo;ll crop it to a circle.</p>
                    <AvatarStatus upload={avatar} className="mt-2" />
                  </div>
                )}
              </div>

              {errors.general && (
                <div role="alert" className="ts-banner ts-banner-error mt-6 px-3.5 py-2.5 text-sm">
                  {errors.general}
                </div>
              )}

              {/* ---- Navigation ---- */}
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => go(step - 1)}
                    disabled={saving || avatar.busy}
                    className="ts-btn-glass inline-flex min-h-[48px] items-center justify-center px-6 text-sm font-medium"
                  >
                    Back
                  </button>
                ) : (
                  <span className="hidden sm:block" />
                )}

                {step < 4 && (
                  <button
                    type="button"
                    onClick={saveAndContinue}
                    disabled={saving}
                    aria-busy={saving}
                    className="ts-btn-primary inline-flex min-h-[48px] items-center justify-center px-8 text-sm font-medium"
                  >
                    <BusyLabel busy={saving} busyLabel="Saving…">
                      Continue
                    </BusyLabel>
                  </button>
                )}

                {step === 4 && (
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    {/* Always visible: a photo must never be what stops
                        someone finishing setup. */}
                    {!hasPhoto && (
                      <button
                        type="button"
                        onClick={() => go(DONE)}
                        disabled={avatar.busy}
                        className="ts-btn-glass inline-flex min-h-[48px] items-center justify-center px-6 text-sm font-medium"
                      >
                        Skip for now
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={hasPhoto ? () => go(DONE) : avatar.choose}
                      disabled={avatar.busy}
                      className="ts-btn-primary inline-flex min-h-[48px] items-center justify-center px-8 text-sm font-medium"
                    >
                      <BusyLabel busy={avatar.busy} busyLabel="Uploading…">
                        {hasPhoto ? 'Continue' : 'Choose a photo'}
                      </BusyLabel>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ============================ All set ============================ */}
        {status === 'ready' && step === DONE && (
          <section className="ts-card ts-step-enter-fwd mt-4 px-6 py-12 text-center sm:px-10" aria-live="polite">
            <div className="flex justify-center">
              <SuccessSeal size={76} />
            </div>
            <h1 className="ts-ink mt-6 text-3xl font-semibold tracking-tight sm:text-4xl" style={FONT_SERIF}>
              You&rsquo;re all set!
            </h1>
            <p className="ts-ink mt-3 text-lg">
              Welcome, {me?.first_name || 'there'}! You&rsquo;re ready to start requesting documents.
            </p>
            {!me?.profile?.tour_completed_at && (
              <p className="ts-soft mx-auto mt-3 max-w-sm text-sm leading-relaxed">
                When you get to your dashboard, we&rsquo;ll show you around &mdash; it takes less than a minute, and you
                can skip it.
              </p>
            )}
            <a
              href="/portal"
              className="ts-btn-primary mt-8 inline-flex min-h-[48px] items-center justify-center px-8 text-base font-medium"
            >
              Go to Dashboard
            </a>
          </section>
        )}
      </main>
    </div>
  );
}

const ONBOARDING_CSS = `
  .ts-onb-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(31,41,55,0.08);
    box-shadow: inset 0 1px 2px rgba(31,41,55,0.14);
    overflow: hidden;
  }
  .ts-onb-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #DCA948 0%, #B8872B 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.45);
    transition: width 0.45s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  @media (prefers-reduced-motion: reduce) { .ts-onb-fill { transition: none; } }
`;
