import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// React Native has no localStorage, and tokens don't belong in plain storage anyway: SecureStore keeps them in the
// Keychain (iOS) or an encrypted SharedPreferences file (Android). SecureStore has no web implementation, so
// `expo start --web` previews fall back to localStorage; the phone builds never take that path.
const webStore = {
  get: (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      if (value == null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } catch {
      // Nothing to do: the preview simply won't survive a reload.
    }
  },
};
const onWeb = Platform.OS === 'web';

const ACCESS_KEY = 'trailsync_access_token';
const REFRESH_KEY = 'trailsync_refresh_token';
const USER_KEY = 'trailsync_user';

// Read once at startup and kept here, so every request doesn't wait on the native store.
let cache = { access: null, refresh: null, user: null, loaded: false };
const listeners = new Set();

async function readKey(key) {
  if (onWeb) return webStore.get(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // A locked or unavailable keystore reads as signed out rather than crashing the app.
    return null;
  }
}

async function writeKey(key, value) {
  if (onWeb) return webStore.set(key, value);
  try {
    if (value == null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Nothing to do: the session simply won't survive a restart.
  }
}

export async function loadSession() {
  const [access, refresh, rawUser] = await Promise.all([readKey(ACCESS_KEY), readKey(REFRESH_KEY), readKey(USER_KEY)]);
  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    user = null;
  }
  cache = { access, refresh, user, loaded: true };
  return cache;
}

export function currentSession() {
  return cache;
}

export function getAccessToken() {
  return cache.access;
}

function publish() {
  listeners.forEach((fn) => fn(cache));
}

/** Subscribe to sign-in and sign-out; returns the unsubscribe. */
export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function saveSession({ access, refresh, user }) {
  cache = { access, refresh, user: user ?? cache.user, loaded: true };
  await Promise.all([
    writeKey(ACCESS_KEY, access),
    writeKey(REFRESH_KEY, refresh),
    writeKey(USER_KEY, cache.user ? JSON.stringify(cache.user) : null),
  ]);
  publish();
}

/** Keep the cached profile in step with edits, without touching the tokens. */
export async function saveUser(user) {
  cache = { ...cache, user };
  await writeKey(USER_KEY, user ? JSON.stringify(user) : null);
  publish();
}

export async function saveTokens({ access, refresh }) {
  cache = { ...cache, access, refresh: refresh ?? cache.refresh };
  await Promise.all([writeKey(ACCESS_KEY, access), refresh ? writeKey(REFRESH_KEY, refresh) : Promise.resolve()]);
}

export async function clearSession() {
  cache = { access: null, refresh: null, user: null, loaded: true };
  await Promise.all([writeKey(ACCESS_KEY, null), writeKey(REFRESH_KEY, null), writeKey(USER_KEY, null)]);
  publish();
}
