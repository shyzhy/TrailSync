import { Component } from 'react';
import { APP_CSS, FONT_SANS, FONT_SERIF, WarningIcon } from './trailsyncUI.jsx';
import { getStoredUser } from '../lib/auth.js';

/** Where "Back to the dashboard" should go for whoever is looking at the crash. */
function homeFor(user) {
  if (!user) return { href: '/', label: 'Back to the home page' };
  if (user.role === 'Registrar Staff') return { href: '/registrar/dashboard', label: 'Back to the Dashboard' };
  return { href: '/portal', label: 'Back to the Dashboard' };
}

/**
 * Catches a crash anywhere in the page below it and shows a calm screen
 * instead of a white page or a half-drawn one.
 *
 * The error itself goes to the browser console with the component stack -
 * enough to debug from - and never onto the screen: a stack trace means
 * nothing to a student and says too much to anyone else. There's no
 * error-tracking service in this project yet; componentDidCatch is where one
 * would be called.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('TrailSync crashed while rendering', error, info?.componentStack);
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    const home = homeFor(getStoredUser());
    return (
      <div className="ts-app-shell flex min-h-screen items-center justify-center px-5 py-10" style={FONT_SANS}>
        <style>{APP_CSS}</style>
        <div role="alert" className="ts-card ts-error-state w-full max-w-md px-7 py-12 text-center">
          <span className="ts-error-icon" aria-hidden="true">
            <WarningIcon />
          </span>
          <h1 className="ts-ink mt-5 text-2xl font-semibold tracking-tight" style={FONT_SERIF}>
            Something went wrong
          </h1>
          <p className="ts-soft mt-2 text-base leading-relaxed">
            This page ran into a problem and couldn&rsquo;t finish loading. Reloading usually fixes it. Anything you
            already saved is safe.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ts-btn-primary inline-flex min-h-[48px] items-center px-8 text-sm font-medium"
            >
              Reload page
            </button>
            <a href={home.href} className="ts-link inline-flex min-h-[44px] items-center text-sm font-medium">
              {home.label}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
