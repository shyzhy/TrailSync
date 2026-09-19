import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GuidedTour } from './GuidedTour.jsx';
import { HelpButton } from './HelpButton.jsx';
import { BottomNav } from './StudentBottomNav.jsx';
import { StudentSidebar } from './StudentSidebar.jsx';
import { StudentTopBar } from './StudentTopBar.jsx';
import { Toast } from '../ui/index.js';
import { APP_CSS } from '../../styles/appCss.js';
import { FONT_SANS } from '../../styles/fonts.js';
import { authFetch, updateStoredUser } from '../../lib/auth.js';

// The chrome every student page shares: sidebar, phone bottom nav and header, bell, "Need help?" and the walkthrough.

const ShellContext = createContext({
  unreadCount: 0,
  setUnreadCount: () => {},
  startTour: () => {},
  // Pages call this for "it worked" or error messages: one toast, one corner.
  notify: () => {},
});

// For pages that change the unread count themselves (the Notifications page).
export function useStudentShell() {
  return useContext(ShellContext);
}

// offerTour: pass true only with a fresh /api/me/, so a stale cache can't re-offer a finished tour.
export default function StudentShell({
  active,
  title,
  me,
  onLogout,
  offerTour = false,
  onMeChange,
  children,
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, tone = 'success') => setToast({ message, tone }), []);
  const [tourOpen, setTourOpen] = useState(false);
  const offeredRef = useRef(false);

  const refreshUnread = useCallback(() => {
    authFetch('/api/notifications/unread-count/')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setUnreadCount(data.unread_count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnread();
    // Pick up changes the Registrar made while the tab sat in the background.
    const onVisible = () => document.visibilityState === 'visible' && refreshUnread();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshUnread]);

  useEffect(() => {
    if (!offerTour || offeredRef.current) return;
    if (me?.profile && !me.profile.tour_completed_at) {
      offeredRef.current = true;
      setTourOpen(true);
    }
  }, [offerTour, me]);

  const finishTour = useCallback(async () => {
    setTourOpen(false);
    if (me?.profile?.tour_completed_at) return; // A replay: nothing to record.
    const res = await authFetch('/api/me/tour/', { method: 'POST' }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      updateStoredUser(data);
      onMeChange?.(data);
    }
  }, [me, onMeChange]);

  const startTour = useCallback(() => setTourOpen(true), []);

  // Unfinished profiles go back to onboarding; checked against fresh /api/me/ too, so a stale cache can't skip it.
  useEffect(() => {
    const onboarding = me?.profile?.onboarding;
    if (onboarding && !onboarding.complete) window.location.replace('/onboarding');
  }, [me]);

  return (
    <ShellContext.Provider value={{ unreadCount, setUnreadCount, startTour, refreshUnread, notify }}>
      <div className="ts-app-shell ts-student md:flex" style={FONT_SANS}>
        <style>{APP_CSS}</style>
        <StudentSidebar active={active} onLogout={onLogout} me={me} />
        {/* ts-student-main pads the bottom so the fixed phone nav never covers the end of a page. */}
        <div className="ts-student-main flex min-w-0 flex-1 flex-col">
          <StudentTopBar title={title} unreadCount={unreadCount} setUnreadCount={setUnreadCount} notify={notify} />
          {children}
          {/* Room to scroll the last button clear of the floating help button. */}
          <div className="h-24" aria-hidden="true" />
        </div>
        <HelpButton onStartTour={startTour} />
        <BottomNav active={active} me={me} onLogout={onLogout} />
        <Toast message={toast?.message} tone={toast?.tone} onDismiss={() => setToast(null)} />
        {tourOpen && <GuidedTour onClose={finishTour} />}
      </div>
    </ShellContext.Provider>
  );
}
