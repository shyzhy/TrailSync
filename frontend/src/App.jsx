import LoginPage from './components/LoginPage.jsx';
import CreateAccountPage from './components/CreateAccountPage.jsx';
import StudentDashboard from './components/StudentDashboard.jsx';
import RequestFormPage from './components/RequestFormPage.jsx';
import TrackRequestsPage from './components/TrackRequestsPage.jsx';
import ProfilePage from './components/ProfilePage.jsx';
import ConfirmEmailPage from './components/ConfirmEmailPage.jsx';
import CredentialGuidePage from './components/CredentialGuidePage.jsx';
import RegistrarDashboardPage from './components/RegistrarDashboardPage.jsx';
import ProcessingQueuePage from './components/ProcessingQueuePage.jsx';
import ReleaseSlotsPage from './components/ReleaseSlotsPage.jsx';

// Minimal path switch so all screens are reachable without pulling in a
// router. Replace with react-router when routing lands.
export default function App() {
  const { pathname } = window.location;
  if (pathname.startsWith('/create-account')) return <CreateAccountPage />;
  if (pathname.startsWith('/request-form')) return <RequestFormPage />;
  if (pathname.startsWith('/track-requests')) return <TrackRequestsPage />;
  if (pathname.startsWith('/profile')) return <ProfilePage />;
  if (pathname.startsWith('/confirm-email')) return <ConfirmEmailPage />;
  if (pathname.startsWith('/credential-guide')) return <CredentialGuidePage />;
  if (pathname.startsWith('/registrar/dashboard')) return <RegistrarDashboardPage />;
  if (pathname.startsWith('/registrar/queue')) return <ProcessingQueuePage />;
  if (pathname.startsWith('/registrar/release-slots')) return <ReleaseSlotsPage />;
  if (pathname.startsWith('/portal')) return <StudentDashboard />;
  return <LoginPage />;
}
