import { homeFor } from '../components/auth/LoginForm.jsx';
import Page from '../components/layout/Page.jsx';
import CreateAccountPage from '../pages/auth/CreateAccountPage.jsx';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.jsx';
import StudentLoginPage from '../pages/auth/StudentLoginPage.jsx';
import CredentialGuidePage from '../pages/student/CredentialGuidePage.jsx';
import NotificationsPage from '../pages/student/NotificationsPage.jsx';
import OnboardingPage from '../pages/student/OnboardingPage.jsx';
import ProfilePage from '../pages/student/ProfilePage.jsx';
import RequestFormPage from '../pages/student/request-form/RequestFormPage.jsx';
import StudentDashboard from '../pages/student/StudentDashboard.jsx';
import TrackRequestsPage from '../pages/student/TrackRequestsPage.jsx';
import { getAccessToken, getStoredUser, STUDENT_LOGIN_PATH } from '../lib/auth.js';

const STUDENT_ROLES = ['Student', 'Alumni'];

// The student app's routes. Registrar and Admin pages are never imported, so they aren't in the app bundle at all.
// Pages only reached from email links (activation, password reset, email change) open in the phone's browser instead.
export default function MobileApp() {
  const { pathname } = window.location;
  if (pathname === '/login' || pathname === '/login/') return <Page><StudentLoginPage /></Page>;
  if (pathname.startsWith('/create-account')) return <Page><CreateAccountPage /></Page>;
  if (pathname.startsWith('/forgot-password')) return <Page><ForgotPasswordPage /></Page>;
  if (pathname.startsWith('/onboarding')) return <Page><OnboardingPage /></Page>;
  if (pathname.startsWith('/request-form')) return <Page><RequestFormPage /></Page>;
  if (pathname.startsWith('/track-requests')) return <Page><TrackRequestsPage /></Page>;
  if (pathname.startsWith('/profile')) return <Page><ProfilePage /></Page>;
  if (pathname.startsWith('/notifications')) return <Page><NotificationsPage /></Page>;
  if (pathname.startsWith('/credential-guide')) return <Page><CredentialGuidePage /></Page>;
  if (pathname.startsWith('/portal')) return <Page><StudentDashboard /></Page>;

  // The app opens at "/", and any other address isn't part of it: Home when signed in, otherwise the login.
  const user = getStoredUser();
  const signedIn = Boolean(getAccessToken()) && STUDENT_ROLES.includes(user?.role);
  window.location.replace(signedIn ? homeFor(user, '/portal') : STUDENT_LOGIN_PATH);
  return null;
}
