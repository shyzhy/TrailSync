import LoginPage from './components/LoginPage.jsx';
import CreateAccountPage from './components/CreateAccountPage.jsx';
import StudentDashboard from './components/StudentDashboard.jsx';
import RequestFormPage from './components/RequestFormPage.jsx';
import TrackRequestsPage from './components/TrackRequestsPage.jsx';
import ProfilePage from './components/ProfilePage.jsx';
import NotificationsPage from './components/NotificationsPage.jsx';
import ConfirmEmailPage from './components/ConfirmEmailPage.jsx';
import CredentialGuidePage from './components/CredentialGuidePage.jsx';
import RegistrarDashboardPage from './components/RegistrarDashboardPage.jsx';
import ProcessingQueuePage from './components/ProcessingQueuePage.jsx';
import ReleasedDocumentsPage from './components/ReleasedDocumentsPage.jsx';
import RequestReviewPage from './components/RequestReviewPage.jsx';

// Minimal path switch so all screens are reachable without pulling in a
// router. Replace with react-router when routing lands.
export default function App() {
  const { pathname } = window.location;
  if (pathname.startsWith('/create-account')) return <CreateAccountPage />;
  if (pathname.startsWith('/request-form')) return <RequestFormPage />;
  if (pathname.startsWith('/track-requests')) return <TrackRequestsPage />;
  if (pathname.startsWith('/profile')) return <ProfilePage />;
  if (pathname.startsWith('/notifications')) return <NotificationsPage />;
  if (pathname.startsWith('/confirm-email')) return <ConfirmEmailPage />;
  if (pathname.startsWith('/credential-guide')) return <CredentialGuidePage />;
  if (pathname.startsWith('/registrar/dashboard')) return <RegistrarDashboardPage />;
  // /registrar/queue/<id> is matched before the bare queue path, otherwise
  // startsWith would swallow every review URL into the list page.
  const review = pathname.match(/^\/registrar\/queue\/(\d+)/);
  if (review) return <RequestReviewPage requestId={review[1]} />;
  if (pathname.startsWith('/registrar/queue')) return <ProcessingQueuePage />;
  if (pathname.startsWith('/registrar/released')) return <ReleasedDocumentsPage />;
  // Release Slots is gone. A staff member with it bookmarked would otherwise
  // land on the unknown-path fallback below, which is the login screen — an
  // alarming thing to see while you are already logged in.
  if (pathname.startsWith('/registrar/release-slots')) {
    window.location.replace('/registrar/released');
    return null;
  }
  if (pathname.startsWith('/portal')) return <StudentDashboard />;
  return <LoginPage />;
}
