import { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  avatarUrlFor,
  CameraIcon,
  ChevronIcon,
  FONT_SERIF,
  Spinner,
} from './trailsyncUI.jsx';
import StudentShell from './StudentShell.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser, updateStoredUser } from '../lib/auth.js';
import { friendlyFieldErrors, friendlySummary, NETWORK_ERROR } from '../lib/friendlyErrors.js';

const LOGIN_PATH = '/';

// Mirrors the server's rules in avatars.py. Checked here so a student hears
// "too big" instantly instead of after uploading 5 MB; the server checks
// again regardless, because the endpoint can be called without this page.
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 512;

/**
 * Centre-crop an image to a square and scale it to at most 512px, as a JPEG.
 *
 * Done before upload so what leaves the browser is already the shape and
 * size an avatar needs - a few tens of KB instead of a multi-megabyte phone
 * photo. Transparent areas are painted white, matching what the server does,
 * so the preview and the stored result look the same.
 *
 * Decoding through an <img> means the browser applies the photo's EXIF
 * orientation first, so a portrait shot is cropped upright.
 */
function cropToSquare(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const out = Math.min(side, AVATAR_OUTPUT_SIZE);
        const canvas = document.createElement('canvas');
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, out, out);
        ctx.drawImage(
          img,
          (img.naturalWidth - side) / 2,
          (img.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          out,
          out,
        );
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.9);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

/** First, middle, last - the same order the server prints on the official form (receipts._student_name). */
function printedName(first, middle, last) {
  return [first, middle, last].map((s) => (s || '').trim()).filter(Boolean).join(' ');
}

/**
 * The "are you sure?" step shown in place of a form's submit button.
 * Nothing is sent until the student confirms, and "Go back" leaves every
 * field exactly as they typed it.
 */
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
          {busy && <Spinner />}
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </div>
  );
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

  // Profile picture
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null); // object URL while uploading
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarNotice, setAvatarNotice] = useState('');

  // Personal information (editable)
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
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

  const load = async () => {
    setStatus('loading');
    try {
      const res = await authFetch('/api/me/');
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (!res.ok) throw new Error('Request failed.');
      const data = await res.json();
      setMe(data);
      updateStoredUser(data);
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setContactNumber(data.contact_number || '');
      setMiddleName(data.profile?.middle_name || '');
      setStatus('ready');
    } catch {
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
  const isStudent = profile?.user_category === 'Student';

  const clearProfileError = (key) => setProfileErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const savedName = printedName(me?.first_name, me?.profile?.middle_name, me?.last_name);
  const draftName = printedName(firstName, middleName, lastName);
  const nameChanged = draftName !== savedName;

  // A name change gets a recap first: it's printed on every form the student
  // downloads, so a typo here ends up on paper at the Registrar. A contact
  // number alone saves straight away.
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    setProfileSuccess(false);
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
        }),
      });
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfileErrors(friendlyFieldErrors(data));
        return;
      }
      setMe(data);
      updateStoredUser(data);
      setProfileSuccess(true);
    } catch {
      setProfileErrors({ general: NETWORK_ERROR });
    } finally {
      setProfileSaving(false);
      setConfirmingName(false);
    }
  };

  // Clear the success note after a moment; errors stay until the next try.
  useEffect(() => {
    if (!avatarNotice) return undefined;
    const t = setTimeout(() => setAvatarNotice(''), 3200);
    return () => clearTimeout(t);
  }, [avatarNotice]);

  // Release the preview's object URL whenever it is replaced or dropped.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  /**
   * A new photo was picked.
   *
   * The preview appears the instant the file is chosen - from the file
   * itself, which the circle's object-fit crops visually - and the square
   * crop and upload run behind it with a spinner over the avatar. Whatever
   * the server returns then replaces the preview, so the photo on screen is
   * the one actually stored.
   */
  const handleAvatarPicked = async (e) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    e.target.value = '';
    if (!file) return;

    setAvatarError('');
    setAvatarNotice('');

    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError(
        `That image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is 5 MB.`,
      );
      return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    setAvatarBusy(true);
    try {
      let upload;
      try {
        upload = await cropToSquare(file);
      } catch {
        setAvatarError("That image couldn't be read. Try a different file.");
        setAvatarPreview(null);
        return;
      }

      const fd = new FormData();
      fd.append('image', upload, 'avatar.jpg');
      // No Content-Type header: the browser sets multipart with its boundary.
      const res = await authFetch('/api/me/avatar/', { method: 'PATCH', body: fd });
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError(friendlySummary(data, "We couldn't update your photo. Please try again."));
        setAvatarPreview(null);
        return;
      }
      setMe(data);
      updateStoredUser(data);
      setAvatarPreview(null);
      setAvatarNotice('Profile picture updated');
    } catch {
      setAvatarError(NETWORK_ERROR);
      setAvatarPreview(null);
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarError('');
    setAvatarNotice('');
    setAvatarBusy(true);
    try {
      const res = await authFetch('/api/me/avatar/', { method: 'DELETE' });
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError(friendlySummary(data, "We couldn't remove your photo. Please try again."));
        return;
      }
      setMe(data);
      updateStoredUser(data);
      setAvatarNotice('Profile picture removed');
    } catch {
      setAvatarError(NETWORK_ERROR);
    } finally {
      setAvatarBusy(false);
    }
  };

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailError(friendlySummary(data, "We couldn't send the link. Please try again."));
        return;
      }
      setEmailSentMessage(data.detail);
      setNewEmail('');
    } catch {
      setEmailError(NETWORK_ERROR);
    } finally {
      setEmailSending(false);
      setConfirmingEmail(false);
    }
  };

  // The obvious mistakes are caught before the recap, so "Yes, change my
  // password" isn't followed straight away by "those don't match". The
  // server still checks everything, including password strength.
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordErrors(friendlyFieldErrors(data));
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch {
      setPasswordErrors({ general: NETWORK_ERROR });
    } finally {
      setPasswordSaving(false);
      setConfirmingPassword(false);
    }
  };

  return (
    <StudentShell active="profile" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Profile
        </h1>
        <p className="ts-soft mt-1.5 text-base">Your account details. You can change your photo, name, contact number, email and password here.</p>

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mt-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>We couldn&rsquo;t load your profile. Please check your internet connection.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Try again
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="ts-card mt-6 space-y-4 p-6">
            <div className="ts-skeleton h-4 w-40" />
            <div className="ts-skeleton h-4 w-64" />
            <div className="ts-skeleton h-4 w-52" />
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* ---- Identity + profile picture ---- */}
            <div className="ts-card mt-6 p-6 sm:p-8">
              <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
                <div className="flex flex-col items-center gap-2.5">
                  {/* Plain positioning box: the circle and its ring come from
                      the Avatar's own ts-avatar-xl, and the veil and camera
                      button pin to this. */}
                  <div className="relative" style={{ width: 112, height: 112 }}>
                    <Avatar
                      user={me}
                      src={avatarPreview || avatarUrlFor(me)}
                      className="ts-avatar-xl"
                      alt={`${me?.first_name || ''} ${me?.last_name || ''}`.trim() || 'Profile picture'}
                    />
                    {avatarBusy && (
                      <span className="ts-avatar-busy" aria-hidden="true">
                        <Spinner />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarBusy}
                      className="ts-avatar-edit"
                      aria-label={avatarUrlFor(me) ? 'Change profile picture' : 'Add a profile picture'}
                    >
                      <CameraIcon />
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={AVATAR_TYPES.join(',')}
                    onChange={handleAvatarPicked}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  {avatarUrlFor(me) && !avatarBusy && (
                    <button type="button" onClick={handleRemoveAvatar} className="ts-link text-xs font-medium">
                      Remove photo
                    </button>
                  )}
                </div>

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

                  <div aria-live="polite" className="mt-2 min-h-[1.25rem]">
                    {avatarBusy && <p className="ts-soft text-xs">Uploading…</p>}
                    {avatarNotice && !avatarBusy && (
                      <p className="text-xs font-medium" style={{ color: '#2C4B3F' }}>
                        {avatarNotice}
                      </p>
                    )}
                  </div>
                  {avatarError && (
                    <p role="alert" className="text-xs font-medium" style={{ color: '#B91C1C' }}>
                      {avatarError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ---- Account (mostly read-only: official records) ---- */}
            <div className="ts-card mt-6 p-6 sm:p-8">
              <h2 className="ts-ink text-base font-semibold">Account</h2>
              <p className="ts-soft mt-1 text-sm">
                These come from your university records, so you can&rsquo;t change them here. If your course or year
                level is wrong, ask at Window 6.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <ReadOnlyField label="School ID number" value={profile?.school_id_number} />
                <ReadOnlyField label="Course" value={profile?.course} />
                <ReadOnlyField label="Student or alumnus" value={profile?.user_category} />
                {isStudent && <ReadOnlyField label="Year level" value={profile?.year_level} />}
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
                  className="ts-link shrink-0 text-sm font-medium"
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
                      className="ts-input w-full px-3.5 py-2.5 text-sm"
                    />
                    {emailError && <p className="ts-error-text mt-1.5 text-sm">{emailError}</p>}
                    {emailSentMessage && (
                      <p className="mt-1.5 text-sm" style={{ color: '#33574A' }}>
                        {emailSentMessage} Open the link in that email within 1 hour. Your email stays the same until
                        you do.
                      </p>
                    )}
                  </div>
                  {/* Secondary: "Save changes" below stays the page's one
                      main button. The recap's own button takes over once
                      this is pressed. */}
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

            {/* ---- Personal Information (editable) ---- */}
            <form onSubmit={handleProfileSubmit} className="ts-card mt-6 p-6 sm:p-8">
              <h2 className="ts-ink text-base font-semibold">Your name and contact number</h2>

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
                    className={`ts-input w-full px-3.5 py-2.5 text-sm ${profileErrors.first_name ? 'ts-input-error' : ''}`}
                  />
                  {profileErrors.first_name && <p className="ts-error-text mt-1.5 text-sm">{profileErrors.first_name}</p>}
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
                    className={`ts-input w-full px-3.5 py-2.5 text-sm ${profileErrors.last_name ? 'ts-input-error' : ''}`}
                  />
                  {profileErrors.last_name && <p className="ts-error-text mt-1.5 text-sm">{profileErrors.last_name}</p>}
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
                    className={`ts-input w-full px-3.5 py-2.5 text-sm ${
                      profileErrors.contact_number ? 'ts-input-error' : ''
                    }`}
                  />
                  {profileErrors.contact_number && (
                    <p className="ts-error-text mt-1.5 text-sm">{profileErrors.contact_number}</p>
                  )}
                </div>
              </div>

              {/* Live, so a student sees the effect of a middle name or a
                  spelling fix before saving rather than on a printed form. */}
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
                    {profileSaving && <Spinner />}
                    {profileSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              )}
            </form>

            {/* ---- Change Password (collapsible) ---- */}
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
                      className={`ts-input w-full px-3.5 py-2.5 text-sm ${
                        passwordErrors.current_password ? 'ts-input-error' : ''
                      }`}
                    />
                    {passwordErrors.current_password && (
                      <p className="ts-error-text mt-1.5 text-sm">{passwordErrors.current_password}</p>
                    )}
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
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${
                          passwordErrors.new_password ? 'ts-input-error' : ''
                        }`}
                      />
                      {passwordErrors.new_password && (
                        <p className="ts-error-text mt-1.5 text-sm">{passwordErrors.new_password}</p>
                      )}
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
                        className={`ts-input w-full px-3.5 py-2.5 text-sm ${
                          passwordErrors.confirm_new_password ? 'ts-input-error' : ''
                        }`}
                      />
                      {passwordErrors.confirm_new_password && (
                        <p className="ts-error-text mt-1.5 text-sm">{passwordErrors.confirm_new_password}</p>
                      )}
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
    </StudentShell>
  );
}
