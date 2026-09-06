import LoginPage from './components/LoginPage.jsx';
import CreateAccountPage from './components/CreateAccountPage.jsx';

// Minimal path switch so both screens are reachable without pulling in a
// router. Replace with react-router when routing lands.
export default function App() {
  if (window.location.pathname.startsWith('/create-account')) {
    return <CreateAccountPage />;
  }
  return <LoginPage />;
}
