import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Errors outside rendering never reach an ErrorBoundary, so log them with a label here.
window.addEventListener('unhandledrejection', (event) => {
  console.error('TrailSync: unhandled promise rejection', event.reason); // eslint-disable-line no-console
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
