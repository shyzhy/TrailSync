import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './app.css';
import MobileApp from './MobileApp.jsx';
import { startNativeShell } from './nativeShell.js';

// The student app's entry (`npm run build:mobile`); the website boots from src/main.jsx.

window.addEventListener('unhandledrejection', (event) => {
  console.error('TrailSync: unhandled promise rejection', event.reason); // eslint-disable-line no-console
});

startNativeShell();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>
);
