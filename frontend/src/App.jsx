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

/**
 * Every screen fades and lifts in on arrival.
 *
 * Navigation here is a real page load (no client router yet), so there is no
 * exit animation to pair this with - the browser simply replaces the
 * document. This softens the arrival, which is the half we can control.
 */
function Page({ children }) {
  return <div className="ts-page-enter">{children}</div>;
}

// Minimal path switch so all screens are reachable without pulling in a
// router. Replace with react-router when routing lands.
export default function App() {
  const { pathname } = window.location;
  if (pathname.startsWith('/create-account')) return <Page><CreateAccountPage /></Page>;
  if (pathname.startsWith('/request-form')) return <Page><RequestFormPage /></Page>;
  if (pathname.startsWith('/track-requests')) return <Page><TrackRequestsPage /></Page>;
  if (pathname.startsWith('/profile')) return <Page><ProfilePage /></Page>;
  if (pathname.startsWith('/notifications')) return <Page><NotificationsPage /></Page>;
  if (pathname.startsWith('/confirm-email')) return <Page><ConfirmEmailPage /></Page>;
  if (pathname.startsWith('/credential-guide')) return <Page><CredentialGuidePage /></Page>;
  if (pathname.startsWith('/registrar/dashboard')) return <Page><RegistrarDashboardPage /></Page>;
  // /registrar/queue/<id> is matched before the bare queue path, otherwise
  // startsWith would swallow every review URL into the list page.
  const review = pathname.match(/^\/registrar\/queue\/(\d+)/);
  if (review) return <Page><RequestReviewPage requestId={review[1]} /></Page>;
  if (pathname.startsWith('/registrar/queue')) return <Page><ProcessingQueuePage /></Page>;
  if (pathname.startsWith('/registrar/released')) return <Page><ReleasedDocumentsPage /></Page>;
  // Release Slots is gone. A staff member with it bookmarked would otherwise
  // land on the unknown-path fallback below, which is the login screen — an
  // alarming thing to see while you are already logged in.
  if (pathname.startsWith('/registrar/release-slots')) {
    window.location.replace('/registrar/released');
    return null;
  }
  if (pathname.startsWith('/portal')) return <Page><StudentDashboard /></Page>;
  return <Page><LoginPage /></Page>;
}
