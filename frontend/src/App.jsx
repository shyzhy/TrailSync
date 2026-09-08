import LoginPage from './components/LoginPage.jsx';
import CreateAccountPage from './components/CreateAccountPage.jsx';
import StudentDashboard from './components/StudentDashboard.jsx';

// Minimal path switch so all screens are reachable without pulling in a
// router. Replace with react-router when routing lands.
export default function App() {
  const { pathname } = window.location;
  if (pathname.startsWith('/create-account')) return <CreateAccountPage />;
  if (pathname.startsWith('/portal')) return <StudentDashboard />;
  return <LoginPage />;
}
