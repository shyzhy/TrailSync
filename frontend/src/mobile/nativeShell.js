import { App } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { handleBackButton } from '../lib/backButton.js';
import { getAccessToken, STUDENT_LOGIN_PATH } from '../lib/auth.js';

// The app's first screens. Back leaves the app from these, as Android apps do, instead of stepping back into a login
// the person is already past.
const ROOT_PATHS = ['/', '/login', '/portal', '/onboarding'];

// Screens without the navy bottom nav, where the gesture bar sits on the cream page instead.
const NO_BOTTOM_NAV = ['/', '/login', '/create-account', '/forgot-password', '/onboarding'];

const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function onBackButton({ canGoBack }) {
  if (handleBackButton()) return;
  if (ROOT_PATHS.includes(currentPath())) App.minimizeApp();
  else if (canGoBack) window.history.back();
  else window.location.replace(getAccessToken() ? '/portal' : STUDENT_LOGIN_PATH);
}

// Light icons over the navy bottom nav, dark icons everywhere else (the status bar always sits on a light page).
function styleNavigationBar() {
  const onNavy = !NO_BOTTOM_NAV.includes(currentPath()) && window.matchMedia('(max-width: 767px)').matches;
  SystemBars.setStyle({
    bar: SystemBarType.NavigationBar,
    style: onNavy ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  }).catch(() => {});
}

export function startNativeShell() {
  document.documentElement.classList.add('ts-native-app');

  // A long press would open the browser's text menu; in the app that only belongs inside a text field.
  document.addEventListener('contextmenu', (event) => {
    if (!event.target.closest?.(EDITABLE)) event.preventDefault();
  });

  if (!Capacitor.isNativePlatform()) return;
  App.addListener('backButton', onBackButton);
  styleNavigationBar();
  // Every link is a full page load, so the splash only ever needs hiding once the first screen has painted.
  requestAnimationFrame(() => SplashScreen.hide().catch(() => {}));
}
