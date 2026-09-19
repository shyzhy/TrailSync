import Page from './components/layout/Page.jsx';
import AccountSetupPage from './pages/auth/AccountSetupPage.jsx';
import ActivatePage from './pages/auth/ActivatePage.jsx';
import AdminLoginPage from './pages/auth/AdminLoginPage.jsx';
import ConfirmEmailPage from './pages/auth/ConfirmEmailPage.jsx';
import CreateAccountPage from './pages/auth/CreateAccountPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import RegistrarLoginPage from './pages/auth/RegistrarLoginPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import StudentLoginPage from './pages/auth/StudentLoginPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import DocumentTypesPage from './pages/admin/DocumentTypesPage.jsx';
import ManageAccountsPage from './pages/admin/ManageAccountsPage.jsx';
import ProcessingQueuePage from './pages/registrar/ProcessingQueuePage.jsx';
import RegistrarDashboardPage from './pages/registrar/RegistrarDashboardPage.jsx';
import ReleaseCalendarPage from './pages/registrar/ReleaseCalendarPage.jsx';
import ReleasedDocumentsPage from './pages/registrar/ReleasedDocumentsPage.jsx';
import RequestReviewPage from './pages/registrar/RequestReviewPage.jsx';
import CredentialGuidePage from './pages/student/CredentialGuidePage.jsx';
import NotificationsPage from './pages/student/NotificationsPage.jsx';
import OnboardingPage from './pages/student/OnboardingPage.jsx';
import ProfilePage from './pages/student/ProfilePage.jsx';
import RequestFormPage from './pages/student/request-form/RequestFormPage.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import TrackRequestsPage from './pages/student/TrackRequestsPage.jsx';

// Minimal path switch; replace with react-router when routing lands.
export default function App() {
  const { pathname } = window.location;
  // Exact match for /login; /registrar/login must be caught before the /registrar/* pages.
  if (pathname === '/login' || pathname === '/login/') return <Page><StudentLoginPage /></Page>;
  if (pathname.startsWith('/registrar/login')) return <Page><RegistrarLoginPage /></Page>;
  if (pathname.startsWith('/admin/login')) return <Page><AdminLoginPage /></Page>;
  if (pathname.startsWith('/admin/dashboard')) return <Page><AdminDashboardPage /></Page>;
  if (pathname.startsWith('/admin/accounts')) return <Page><ManageAccountsPage /></Page>;
  if (pathname.startsWith('/admin/document-types')) return <Page><DocumentTypesPage /></Page>;
  if (pathname.startsWith('/create-account')) return <Page><CreateAccountPage /></Page>;
  if (pathname.startsWith('/activate')) return <Page><ActivatePage /></Page>;
  // One pair of pages for both audiences; ?from= only picks the look and the back-to-login target.
  if (pathname.startsWith('/forgot-password')) return <Page><ForgotPasswordPage /></Page>;
  if (pathname.startsWith('/reset-password')) return <Page><ResetPasswordPage /></Page>;
  if (pathname.startsWith('/account-setup')) return <Page><AccountSetupPage /></Page>;
  if (pathname.startsWith('/onboarding')) return <Page><OnboardingPage /></Page>;
  if (pathname.startsWith('/request-form')) return <Page><RequestFormPage /></Page>;
  if (pathname.startsWith('/track-requests')) return <Page><TrackRequestsPage /></Page>;
  if (pathname.startsWith('/profile')) return <Page><ProfilePage /></Page>;
  if (pathname.startsWith('/notifications')) return <Page><NotificationsPage /></Page>;
  if (pathname.startsWith('/confirm-email')) return <Page><ConfirmEmailPage /></Page>;
  if (pathname.startsWith('/credential-guide')) return <Page><CredentialGuidePage /></Page>;
  if (pathname.startsWith('/registrar/dashboard')) return <Page><RegistrarDashboardPage /></Page>;
  // Matched before the bare queue path, which would otherwise swallow every review URL.
  const review = pathname.match(/^\/registrar\/queue\/(\d+)/);
  if (review) return <Page><RequestReviewPage requestId={review[1]} /></Page>;
  if (pathname.startsWith('/registrar/queue')) return <Page><ProcessingQueuePage /></Page>;
  if (pathname.startsWith('/registrar/calendar')) return <Page><ReleaseCalendarPage /></Page>;
  if (pathname.startsWith('/registrar/released')) return <Page><ReleasedDocumentsPage /></Page>;
  // Old Release Slots bookmarks go to its successor, the view-only calendar.
  if (pathname.startsWith('/registrar/release-slots')) {
    window.location.replace('/registrar/calendar');
    return null;
  }
  if (pathname.startsWith('/portal')) return <Page><StudentDashboard /></Page>;
  // Unknown addresses land on the landing page, which explains the app.
  return <Page><LandingPage /></Page>;
}
