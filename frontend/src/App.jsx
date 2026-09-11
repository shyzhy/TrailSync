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
import ReleaseSlotsPage from './components/ReleaseSlotsPage.jsx';
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
  if (pathname.startsWith('/registrar/release-slots')) return <ReleaseSlotsPage />;
  if (pathname.startsWith('/portal')) return <StudentDashboard />;
  return <LoginPage />;
}
