import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Errors thrown outside rendering - in an event handler or a promise nobody
// awaited - never reach an ErrorBoundary. Pages catch their own API failures
// and show them; anything that still slips through is at least recorded
// here with a label, rather than as an anonymous console line. (No
// error-tracking service is connected yet; this is where one would go.)
window.addEventListener('unhandledrejection', (event) => {
  console.error('TrailSync: unhandled promise rejection', event.reason); // eslint-disable-line no-console
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
