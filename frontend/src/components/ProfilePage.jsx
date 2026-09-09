import { useEffect, useState } from 'react';
import {
  APP_CSS,
  AppMobileHeader,
  AppSidebar,
  ChevronIcon,
  FONT_SANS,
  FONT_SERIF,
  Spinner,
} from './trailsyncUI.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';

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

  // Personal information (editable)
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Change email
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSentMessage, setEmailSentMessage] = useState('');

  // Change password
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
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
        setProfileErrors(
          typeof data === 'object'
            ? Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.join(' ') : String(v)])
              )
            : { general: 'Could not save your changes.' }
        );
        return;
      }
      setMe(data);
      setProfileSuccess(true);
    } catch {
      setProfileErrors({ general: 'Unable to reach the server. Please try again.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
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
        setEmailError(data.new_email?.[0] || data.detail || 'Could not send a verification link.');
        return;
      }
      setEmailSentMessage(data.detail);
      setNewEmail('');
    } catch {
      setEmailError('Unable to reach the server. Please try again.');
    } finally {
      setEmailSending(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
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
        setPasswordErrors(
          typeof data === 'object'
            ? Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.join(' ') : String(v)])
              )
            : { general: 'Could not update your password.' }
        );
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch {
      setPasswordErrors({ general: 'Unable to reach the server. Please try again.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <AppSidebar active="profile" onLogout={handleLogout} me={me} />
      <AppMobileHeader onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 sm:py-10 lg:px-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Profile
        </h1>
        <p className="ts-soft mt-1.5 text-sm">View your account details and update the information you're able to self-edit.</p>

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mt-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>Something went wrong loading your profile.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Retry
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
            {/* ---- Account (mostly read-only: official records) ---- */}
            <div className="ts-card mt-6 p-6 sm:p-8">
              <h2 className="ts-ink text-sm font-semibold">Account</h2>
              <p className="ts-soft mt-1 text-xs">
                These are official university records. Changes to your course, category, or year level go through the
                registrar, not this page.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <ReadOnlyField label="School ID Number" value={profile?.school_id_number} />
                <ReadOnlyField label="Course" value={profile?.course} />
                <ReadOnlyField label="User Category" value={profile?.user_category} />
                {isStudent && <ReadOnlyField label="Year Level" value={profile?.year_level} />}
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
                  }}
                  className="ts-link shrink-0 text-sm font-medium"
                >
                  Change email
                </button>
              </div>

              {emailFormOpen && (
                <form onSubmit={handleRequestEmailChange} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <label htmlFor="newEmail" className="sr-only">
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
                      }}
                      placeholder="new.email@ustp.edu.ph"
                      className="ts-input w-full px-3.5 py-2.5 text-sm"
                    />
                    {emailError && <p className="ts-error-text mt-1.5 text-sm">{emailError}</p>}
                    {emailSentMessage && (
                      <p className="mt-1.5 text-sm" style={{ color: '#33574A' }}>
                        {emailSentMessage} Check that inbox for a confirmation link — this page's email won't change
                        until you click it.
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={emailSending}
                    className="ts-btn-primary flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium sm:shrink-0"
                  >
                    {emailSending && <Spinner />}
                    {emailSending ? 'Sending…' : 'Send verification link'}
                  </button>
                </form>
              )}
            </div>

            {/* ---- Personal Information (editable) ---- */}
            <form onSubmit={handleSaveProfile} className="ts-card mt-6 p-6 sm:p-8">
              <h2 className="ts-ink text-sm font-semibold">Personal Information</h2>

              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="ts-ink mb-1.5 block text-sm font-medium">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      clearProfileError('first_name');
                    }}
                    className={`ts-input w-full px-3.5 py-2.5 text-sm ${profileErrors.first_name ? 'ts-input-error' : ''}`}
                  />
                  {profileErrors.first_name && <p className="ts-error-text mt-1.5 text-sm">{profileErrors.first_name}</p>}
                </div>

                <div>
                  <label htmlFor="lastName" className="ts-ink mb-1.5 block text-sm font-medium">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      clearProfileError('last_name');
                    }}
                    className={`ts-input w-full px-3.5 py-2.5 text-sm ${profileErrors.last_name ? 'ts-input-error' : ''}`}
                  />
                  {profileErrors.last_name && <p className="ts-error-text mt-1.5 text-sm">{profileErrors.last_name}</p>}
                </div>

                <div>
                  <label htmlFor="middleName" className="ts-ink mb-1.5 block text-sm font-medium">
                    Middle Name <span className="ts-soft font-normal">(optional)</span>
                  </label>
                  <input
                    id="middleName"
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    className="ts-input w-full px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="contactNumber" className="ts-ink mb-1.5 block text-sm font-medium">
                    Contact Number
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

              {profileErrors.general && (
                <div role="alert" className="ts-banner ts-banner-error mt-5 px-3.5 py-2.5 text-sm">
                  {profileErrors.general}
                </div>
              )}
              {profileSuccess && (
                <div role="status" className="ts-banner ts-banner-success mt-5 px-3.5 py-2.5 text-sm">
                  Profile updated.
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="ts-btn-primary flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium"
                >
                  {profileSaving && <Spinner />}
                  {profileSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>

            {/* ---- Change Password (collapsible) ---- */}
            <div className="ts-card mt-6 overflow-hidden">
              <button
                type="button"
                onClick={() => setPasswordOpen((o) => !o)}
                className="flex w-full items-center justify-between px-6 py-5 text-left sm:px-8"
              >
                <div>
                  <h2 className="ts-ink text-sm font-semibold">Change Password</h2>
                  <p className="ts-soft mt-1 text-xs">Updates your login password only — nothing else on this page.</p>
                </div>
                <span className={`ts-soft shrink-0 transition-transform ${passwordOpen ? 'rotate-180' : ''}`}>
                  <ChevronIcon />
                </span>
              </button>

              {passwordOpen && (
                <form
                  onSubmit={handleChangePassword}
                  className="space-y-5 border-t px-6 pb-8 pt-5 sm:px-8"
                  style={{ borderColor: '#E3DFD2' }}
                >
                  <div>
                    <label htmlFor="currentPassword" className="ts-ink mb-1.5 block text-sm font-medium">
                      Current Password
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
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
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
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
                        Confirm New Password
                      </label>
                      <input
                        id="confirmNewPassword"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => {
                          setConfirmNewPassword(e.target.value);
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
                      Your password has been updated.
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="ts-btn-primary flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium"
                    >
                      {passwordSaving && <Spinner />}
                      {passwordSaving ? 'Updating…' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
