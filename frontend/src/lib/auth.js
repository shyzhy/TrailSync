// Token/session storage, shared by every page that needs to know who's
// logged in. Centralized so the storage keys and the localStorage-vs-
// sessionStorage ("remember me") rule live in exactly one place.
import { API_BASE_URL } from '../components/trailsyncUI.jsx';

const ACCESS_KEY = 'trailsync_access_token';
const REFRESH_KEY = 'trailsync_refresh_token';
const USER_KEY = 'trailsync_user';
const ALL_KEYS = [ACCESS_KEY, REFRESH_KEY, USER_KEY];

function readFirst(key) {
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    // Storage can throw in a locked-down/private context; treat as signed out.
    return null;
  }
}

export function getAccessToken() {
  return readFirst(ACCESS_KEY);
}

export function getStoredUser() {
  const raw = readFirst(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persist a login response. "remember" picks which storage survives closing
 * the tab; the other storage is cleared first so a token from an earlier
 * login with the opposite "remember me" choice can never linger and get
 * read by mistake.
 */
export function saveSession({ access, refresh, user }, remember) {
  const target = remember ? window.localStorage : window.sessionStorage;
  const other = remember ? window.sessionStorage : window.localStorage;
  ALL_KEYS.forEach((key) => other.removeItem(key));
  target.setItem(ACCESS_KEY, access);
  target.setItem(REFRESH_KEY, refresh);
  target.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  ALL_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

/** fetch() with the bearer token attached, against the same API host as the rest of the app. */
export function authFetch(path, options = {}) {
  const token = getAccessToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
