import { useEffect, useState } from 'react';
import StudentShell from '../../components/layout/StudentShell.jsx';
import {
  BusyLabel,
  ChevronIcon,
  ErrorState,
  FieldError,
  Skeleton,
  SkeletonGroup,
  Toast,
} from '../../components/ui/index.js';
import { AvatarPicker, AvatarStatus, useAvatarUpload } from '../../components/student/AvatarUploader.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';
import { academicStatusLine, checkSemester, isAlumnus, SEMESTER_EXAMPLE } from '../../lib/academics.js';
import { errorFromResponse, formErrors, toApiError } from '../../lib/api.js';
import {
  authFetch,
  clearSession,
  getAccessToken,
  getStoredUser,
  STUDENT_LOGIN_PATH,
  updateStoredUser,
} from '../../lib/auth.js';

const LOGIN_PATH = STUDENT_LOGIN_PATH;

// First, middle, last: the order the official form prints (receipts._student_name).
function printedName(first, middle, last) {
  return [first, middle, last].map((s) => (s || '').trim()).filter(Boolean).join(' ');
}

// The "are you sure?" step shown in place of a form's submit button; "Go back" keeps everything typed.
function ConfirmPanel({ title, children, confirmLabel, busyLabel, busy, onConfirm, onCancel }) {
  return (
    <div role="group" aria-label={title} className="ts-info-note mt-5 block px-4 py-4 text-sm">
      <p className="ts-ink text-base font-semibold">{title}</p>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={busy} className="ts-btn-glass px-5 py-2.5 text-sm font-medium">
          Go back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="ts-btn-primary flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium"
        >
          <BusyLabel busy={busy} busyLabel={busyLabel}>
            {confirmLabel}
          </BusyLabel>
        </button>
      </div>
    </div>
  );
}

function formatGraduation(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="ts-review-label">{label}</p>
      <p className="ts-review-value">{value || '—'}</p>
    </div>
  );
}

export default function ProfilePage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());

  // Personal information
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [lastSemester, setLastSemester] = useState('');
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [confirmingName, setConfirmingName] = useState(false);

  // Change email
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSentMessage, setEmailSentMessage] = useState('');
  const [confirmingEmail, setConfirmingEmail] = useState(false);

  // Change password
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [confirmingPassword, setConfirmingPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const load = async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const res = await authFetch('/api/me/');
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setMe(data);
      updateStoredUser(data);
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setContactNumber(data.contact_number || '');
      setMiddleName(data.profile?.middle_name || '');
      setLastSemester(data.profile?.last_semester_attended || '');
      setStatus('ready');
    } catch (error) {
      setLoadError(toApiError(error));
      setStatus('error');
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

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  const profile = me?.profile;

  const clearProfileError = (key) => setProfileErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const savedName = printedName(me?.first_name, me?.profile?.middle_name, me?.last_name);
  const draftName = printedName(firstName, middleName, lastName);
  const nameChanged = draftName !== savedName;

  // A name change gets a recap first, because it is printed on every form; a contact number alone saves straight away.
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    setProfileSuccess(false);
    const semester = checkSemester(lastSemester);
    if (semester.error) {
      setProfileErrors({ last_semester_attended: semester.error });
      return;
    }
    if (nameChanged && firstName.trim() && lastName.trim()) {
      setConfirmingName(true);
      return;
    }
    saveProfile();
  };

  const saveProfile = async () => {
    setProfileErrors({});
    setProfileSuccess(false);
    setProfileSaving(true);
    try {
      const res = await authFetch('/api/me/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          middle_name: middleName.trim(),
          last_name: lastName.trim(),
          contact_number: contactNumber.trim(),
          last_semester_attended: checkSemester(lastSemester).value,
        }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setMe(data);
      updateStoredUser(data);
      setLastSemester(data.profile?.last_semester_attended || '');
      setProfileSuccess(true);
      setToast({ message: 'Your changes are saved.' });
    } catch (error) {
      setProfileErrors(formErrors(error, ['first_name', 'last_name', 'contact_number', 'last_semester_attended']));
    } finally {
      setProfileSaving(false);
      setConfirmingName(false);
    }
  };

  const avatar = useAvatarUpload({
    onUpdated: (data, kind) => {
      setMe(data);
      updateStoredUser(data);
      setToast({ message: kind === 'removed' ? 'Profile picture removed.' : 'Profile picture updated.' });
    },
  });

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setEmailError('');
    setEmailSentMessage('');
    setConfirmingEmail(true);
  };

  const requestEmailChange = async () => {
    setEmailError('');
    setEmailSentMessage('');
    setEmailSending(true);
    try {
      const res = await authFetch('/api/me/change-email/request/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: newEmail.trim() }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setEmailSentMessage(data.detail);
      setNewEmail('');
    } catch (error) {
      setEmailError(toApiError(error).message);
    } finally {
      setEmailSending(false);
      setConfirmingEmail(false);
    }
  };

  // Obvious mistakes are caught before the recap; the server still checks everything, including strength.
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordSuccess(false);
    const problems = {};
    if (!currentPassword) problems.current_password = 'Please enter the password you use now.';
    if (!newPassword) problems.new_password = 'Please choose a new password.';
    if (newPassword && confirmNewPassword !== newPassword) {
      problems.confirm_new_password = "This doesn't match the new password above.";
    }
    setPasswordErrors(problems);
    if (Object.keys(problems).length === 0) setConfirmingPassword(true);
  };

  const changePassword = async () => {
    setPasswordErrors({});
    setPasswordSuccess(false);
    setPasswordSaving(true);
    try {
      const res = await authFetch('/api/me/change-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_new_password: confirmNewPassword,
        }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      setPasswordSuccess(true);
      setToast({ message: 'Your password is changed.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      setPasswordErrors(formErrors(error, ['current_password', 'new_password', 'confirm_new_password']));
    } finally {
      setPasswordSaving(false);
      setConfirmingPassword(false);
    }
  };

  return (
    <StudentShell active="profile" title="Profile" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Profile
        </h1>
        <p className="ts-soft mt-1.5 text-base">Your account details. You can change your photo, name, contact number, last semester, email and password here.</p>

        {status === 'error' && (
          <ErrorState className="mt-6" error={loadError} title="We couldn&rsquo;t load your profile" onRetry={load} />
        )}

        {status === 'loading' && (
          <SkeletonGroup label="Loading your profile" className="mt-6 space-y-6">
            {/* Same three cards this page renders, so nothing jumps. */}
            <div className="ts-skeleton-card flex items-center gap-5 p-6 sm:p-8">
              <Skeleton className="ts-avatar-frame shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-5 w-48 max-w-full" />
                <Skeleton className="h-3.5 w-40 max-w-full" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
            </div>
            <div className="ts-skeleton-card space-y-4 p-6 sm:p-8">
              <Skeleton className="h-4 w-24" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-36 max-w-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="ts-skeleton-card space-y-4 p-6 sm:p-8">
              <Skeleton className="h-4 w-44" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-11 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg" />
              </div>
            </div>
          </SkeletonGroup>
        )}

        {status === 'ready' && (
          <>
            {/* Identity and profile picture */}
            <div className="ts-card mt-6 p-6 sm:p-8">
              <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
                <AvatarPicker me={me} upload={avatar} />

                <div className="min-w-0 flex-1">
                  <p className="ts-ink text-xl font-semibold" style={FONT_SERIF}>
                    {[me?.first_name, me?.profile?.middle_name, me?.last_name].filter(Boolean).join(' ')}
                  </p>
                  <p className="ts-soft mt-1 text-sm">
                    {[me?.profile?.school_id_number, me?.profile?.course].filter(Boolean).join(' · ')}
                  </p>
                  <p className="ts-soft mt-3 text-xs">
                    JPEG, PNG, or WebP, up to 5 MB. Photos are cropped to a square.
                  </p>

                  <AvatarStatus upload={avatar} className="mt-2" />
                </div>
              </div>
            </div>

            {/* Account: official records, mostly read-only */}
            <div className="ts-card mt-6 p-6 sm:p-8">
              <h2 className="ts-ink text-base font-semibold">Account</h2>
              <p className="ts-soft mt-1 text-sm">
                These come from your university records, so you can&rsquo;t change them here. If your course or
                academic status is wrong, ask at Window 6.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <ReadOnlyField label="School ID number" value={profile?.school_id_number} />
                <ReadOnlyField label="Course" value={profile?.course} />
                <ReadOnlyField label="Academic status" value={academicStatusLine(profile?.academic_status)} />
                {isAlumnus(profile?.academic_status) && (
                  <ReadOnlyField label="Graduated" value={formatGraduation(profile?.graduation_date)} />
                )}
              </div>

              <div className="ts-hairline my-5 h-px" />

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="ts-review-label">Email</p>
                  <p className="ts-review-value truncate">{me?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmailFormOpen((o) => !o);
                    setEmailError('');
                    setEmailSentMessage('');
                    setConfirmingEmail(false);
                  }}
                  className="ts-link ts-tap shrink-0 text-sm font-medium"
                >
                  Change email
                </button>
              </div>

              {emailFormOpen && (
                <form onSubmit={handleEmailSubmit} className="mt-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <label htmlFor="newEmail" className="ts-ink mb-1.5 block text-sm font-medium">
                      New email address
                    </label>
                    <input
                      id="newEmail"
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value);
                        setEmailError('');
                        setConfirmingEmail(false);
                      }}
                      placeholder="new.email@ustp.edu.ph"
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={emailError ? 'newEmail-error' : undefined}
                      className={`ts-input w-full px-3.5 py-2.5 text-sm ${emailError ? 'ts-input-error' : ''}`}
                    />
                    <FieldError id="newEmail">{emailError}</FieldError>
                    {emailSentMessage && (
                      <p className="mt-1.5 text-sm" style={{ color: '#33574A' }}>
                        {emailSentMessage} Open the link in that email within 1 hour. Your email stays the same until
                        you do.
                      </p>
                    )}
                  </div>
                  {/* Secondary, so "Save changes" stays the page's one main button. */}
                  {!confirmingEmail && (
                    <button
                      type="submit"
                      className="ts-btn-glass flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium sm:mt-[1.625rem] sm:shrink-0"
                    >
                      Continue
                    </button>
                  )}
                  </div>
                  {confirmingEmail && (
                    <ConfirmPanel
                      title="Change your email?"
                      confirmLabel="Send the link"
                      busyLabel="Sending…"
                      busy={emailSending}
                      onConfirm={requestEmailChange}
                      onCancel={() => setConfirmingEmail(false)}
                    >
                      <p>
                        We&rsquo;ll email a link to <strong className="ts-ink break-all">{newEmail.trim()}</strong>.
                      </p>
                      <p>
                        Your email stays <strong className="ts-ink break-all">{me?.email}</strong> until you open that
                        link. It stops working after 1 hour.
                      </p>
                      <p>
                        After that, you&rsquo;ll log in with the new email or your School ID number, and TrailSync
                        emails will go to the new address.
                      </p>
                    </ConfirmPanel>
                  )}
                </form>
              )}
            </div>

            {/* Name and contact number */}
            <form onSubmit={handleProfileSubmit} className="ts-card mt-6 p-6 sm:p-8">
              <h2 className="ts-ink text-base font-semibold">Your name, contact number and last semester</h2>

              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="ts-ink mb-1.5 block text-sm font-medium">
                    First name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setConfirmingName(false);
                      clearProfileError('first_name');
                    }}
                    aria-invalid={Boolean(profileErrors.first_name)}
                    aria-describedby={profileErrors.first_name ? 'firstName-error' : undefined}
                    className={`ts-input w-full px-3.5 py-2.5 text-sm ${profileErrors.first_name ? 'ts-input-error' : ''}`}
                  />
                  <FieldError id="firstName">{profileErrors.first_name}</FieldError>
                </div>

                <div>
                  <label htmlFor="lastName" className="ts-ink mb-1.5 block text-sm font-medium">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setConfirmingName(false);
                      clearProfileError('last_name');
                    }}
                    aria-invalid={Boolean(profileErrors.last_name)}
                    aria-describedby={profileErrors.last_name ? 'lastName-error' : undefined}
                    className={`ts-input w-full px-3.5 py-2.5 text-sm ${profileErrors.last_name ? 'ts-input-error' : ''}`}
                  />
                  <FieldError id="lastName">{profileErrors.last_name}</FieldError>
                </div>

                <div>
                  <label htmlFor="middleName" className="ts-ink mb-1.5 block text-sm font-medium">
                    Middle name <span className="ts-soft font-normal">(optional)</span>
                  </label>
                  <input
                    id="middleName"
                    type="text"
                    value={middleName}
                    onChange={(e) => {
                      setMiddleName(e.target.value);
                      setConfirmingName(false);
                    }}
                    className="ts-input w-full px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="contactNumber" className="ts-ink mb-1.5 block text-sm font-medium">
                    Mobile number
                  </label>
                  <input
                    id="contactNumber"
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => {
                      setContactNumber(e.target.value);
                      clearProfileError('contact_number');
                    }}
                    placeholder="09XXXXXXXXX"
                    aria-invalid={Boolean(profileErrors.contact_number)}
                    aria-describedby={profileErrors.contact_number ? 'contactNumber-error' : undefined}
                    className={`ts-input w-full px-3.5 py-2.5 text-sm ${
                      profileErrors.contact_number ? 'ts-input-error' : ''
                    }`}
                  />
                  <FieldError id="contactNumber">{profileErrors.contact_number}</FieldError>
                </div>

                {/* Editable, unlike the records above: it moves on every term a student stays enrolled. */}
                <div className="sm:col-span-2">
                  <label htmlFor="lastSemester" className="ts-ink mb-1.5 block text-sm font-medium">
                    Last Semester You Attended (e.g. &lsquo;{SEMESTER_EXAMPLE}&rsquo;)
                  </label>
                  <input
                    id="lastSemester"
                    type="text"
                    value={lastSemester}
                    onChange={(e) => {
                      setLastSemester(e.target.value);
                      clearProfileError('last_semester_attended');
                    }}
                    onBlur={() => {
                      const { value } = checkSemester(lastSemester);
                      if (value) setLastSemester(value);
                    }}
                    placeholder={SEMESTER_EXAMPLE}
                    aria-invalid={Boolean(profileErrors.last_semester_attended)}
                    aria-describedby={profileErrors.last_semester_attended ? 'lastSemester-error' : 'lastSemester-hint'}
                    className={`ts-input w-full px-3.5 py-2.5 text-sm ${
                      profileErrors.last_semester_attended ? 'ts-input-error' : ''
                    }`}
                  />
                  {profileErrors.last_semester_attended ? (
                    <FieldError id="lastSemester">{profileErrors.last_semester_attended}</FieldError>
                  ) : (
                    <p id="lastSemester-hint" className="ts-soft mt-1.5 text-xs">
                      This helps Window 6 locate your records. Your next request starts with it filled in.
                    </p>
                  )}
                </div>
              </div>

              {/* Live preview, so a spelling fix is seen before it reaches a printed form. */}
              <div className="mt-5 rounded-lg border px-4 py-3" style={{ borderColor: '#E3DFD2', background: '#FAF8F3' }}>
                <p className="ts-soft text-xs font-medium uppercase tracking-wide">Printed on your forms as</p>
                <p className="ts-ink mt-1 text-base font-semibold" style={FONT_SERIF}>
                  {draftName || '—'}
                </p>
              </div>

              {profileErrors.general && (
                <div role="alert" className="ts-banner ts-banner-error mt-5 px-3.5 py-2.5 text-sm">
                  {profileErrors.general}
                </div>
              )}
              {profileSuccess && (
                <div role="status" className="ts-banner ts-banner-success mt-5 px-3.5 py-2.5 text-sm">
                  Your changes are saved.
                </div>
              )}

              {confirmingName ? (
                <ConfirmPanel
                  title="Is your new name spelled correctly?"
                  confirmLabel="Yes, save my name"
                  busyLabel="Saving…"
                  busy={profileSaving}
                  onConfirm={saveProfile}
                  onCancel={() => setConfirmingName(false)}
                >
                  <p>
                    <span className="ts-soft">From:</span> <strong className="ts-ink">{savedName || '—'}</strong>
                    <br />
                    <span className="ts-soft">To:</span> <strong className="ts-ink">{draftName}</strong>
                  </p>
                  <p>
                    This name is printed on the forms you download from TrailSync &mdash; including forms for requests
                    you&rsquo;ve already sent &mdash; so it should match your school records exactly.
                  </p>
                  <p className="ts-soft">
                    Changing it here doesn&rsquo;t change your school records. If your name is wrong on those, request
                    a Correction of Name instead.
                  </p>
                </ConfirmPanel>
              ) : (
                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="ts-btn-primary flex w-full items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium sm:w-auto"
                  >
                    <BusyLabel busy={profileSaving} busyLabel="Saving…">
                      Save changes
                    </BusyLabel>
                  </button>
                </div>
              )}
            </form>

            {/* Change password */}
            <div className="ts-card mt-6 overflow-hidden">
              <button
                type="button"
                onClick={() => setPasswordOpen((o) => !o)}
                className="flex w-full items-center justify-between px-6 py-5 text-left sm:px-8"
              >
                <div>
                  <h2 className="ts-ink text-base font-semibold">Change password</h2>
                  <p className="ts-soft mt-1 text-sm">Changes the password you log in with. Nothing else changes.</p>
                </div>
                <span className={`ts-soft shrink-0 transition-transform ${passwordOpen ? 'rotate-180' : ''}`}>
                  <ChevronIcon />
                </span>
              </button>

              {passwordOpen && (
                <form
                  onSubmit={handlePasswordSubmit}
                  className="space-y-5 border-t px-6 pb-8 pt-5 sm:px-8"
                  style={{ borderColor: '#E3DFD2' }}
                >
                  <div>
                    <label htmlFor="currentPassword" className="ts-ink mb-1.5 block text-sm font-medium">
                      Password you use now
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setConfirmingPassword(false);
                        setPasswordErrors((p) => ({ ...p, current_password: undefined }));
                      }}
                      aria-invalid={Boolean(passwordErrors.current_password)}
                      aria-describedby={passwordErrors.current_password ? 'currentPassword-error' : undefined}
                      className={`ts-input w-full px-3.5 py-2.5 text-sm ${
                        passwordErrors.current_password ? 'ts-input-error' : ''
                      }`}
                    />
                    <FieldError id="currentPassword">{passwordErrors.current_password}</FieldError>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="newPassword" className="ts-ink mb-1.5 block text-sm font-medium">
                        New password
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setConfirmingPassword(false);
                          setPasswordErrors((p) => ({ ...p, new_password: undefined }));
                        }}
                        aria-invalid={Boolean(passwordErrors.new_password)}
                        aria-describedby={passwordErrors.new_password ? 'newPassword-error' : undefined}
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${
                          passwordErrors.new_password ? 'ts-input-error' : ''
                        }`}
                      />
                      <FieldError id="newPassword">{passwordErrors.new_password}</FieldError>
                    </div>

                    <div>
                      <label htmlFor="confirmNewPassword" className="ts-ink mb-1.5 block text-sm font-medium">
                        Type the new password again
                      </label>
                      <input
                        id="confirmNewPassword"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => {
                          setConfirmNewPassword(e.target.value);
                          setConfirmingPassword(false);
                          setPasswordErrors((p) => ({ ...p, confirm_new_password: undefined }));
                        }}
                        aria-invalid={Boolean(passwordErrors.confirm_new_password)}
                        aria-describedby={passwordErrors.confirm_new_password ? 'confirmNewPassword-error' : undefined}
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${
                          passwordErrors.confirm_new_password ? 'ts-input-error' : ''
                        }`}
                      />
                      <FieldError id="confirmNewPassword">{passwordErrors.confirm_new_password}</FieldError>
                    </div>
                  </div>

                  {passwordErrors.general && (
                    <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
                      {passwordErrors.general}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div role="status" className="ts-banner ts-banner-success px-3.5 py-2.5 text-sm">
                      Your password is changed. Use the new one next time you log in.
                    </div>
                  )}

                  {confirmingPassword ? (
                    <ConfirmPanel
                      title="Change your password?"
                      confirmLabel="Yes, change my password"
                      busyLabel="Changing…"
                      busy={passwordSaving}
                      onConfirm={changePassword}
                      onCancel={() => setConfirmingPassword(false)}
                    >
                      <p>
                        From now on, you&rsquo;ll log in with your new password. Your old one will stop working.
                      </p>
                      <p className="ts-soft">You&rsquo;ll stay logged in on this device.</p>
                    </ConfirmPanel>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="ts-btn-glass flex w-full items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium sm:w-auto"
                      >
                        Continue
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          </>
        )}
      </main>

      <Toast message={toast?.message} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </StudentShell>
  );
}
