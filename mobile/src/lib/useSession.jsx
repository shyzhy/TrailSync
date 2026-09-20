import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';

import { apiGet, publicPost } from './api';
import { clearSession, currentSession, loadSession, onSessionChange, saveSession, saveUser } from './session';

const SessionContext = createContext(null);

/** Who is signed in, for every screen. The stored session is read once at startup, then kept in step here. */
export function SessionProvider({ children }) {
  const [state, setState] = useState({ ...currentSession(), ready: currentSession().loaded });

  useEffect(() => {
    let alive = true;
    loadSession().then((session) => {
      if (alive) setState({ ...session, ready: true });
    });
    // authFetch clears the session when a refresh fails, which lands here and sends the app back to the login screen.
    const stop = onSessionChange((session) => setState({ ...session, ready: true }));
    return () => {
      alive = false;
      stop();
    };
  }, []);

  const signIn = useCallback(async (identifier, password) => {
    const data = await publicPost('/api/auth/login/', { identifier: identifier.trim(), password });
    await saveSession({ access: data.access, refresh: data.refresh, user: data.user });
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    router.replace('/(auth)/login');
  }, []);

  /** Re-read the profile after an edit, so every screen shows the same person. */
  const refreshUser = useCallback(async () => {
    const me = await apiGet('/api/me/');
    await saveUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({ user: state.user, signedIn: Boolean(state.access), ready: state.ready, signIn, signOut, refreshUser, saveUser }),
    [state.user, state.access, state.ready, signIn, signOut, refreshUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/** Onboarding gates the rest of the app: a profile without its details can't file a request. */
export function needsOnboarding(user) {
  const onboarding = user?.profile?.onboarding;
  return Boolean(onboarding && onboarding.complete === false);
}
