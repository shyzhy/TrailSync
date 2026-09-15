import { API_BASE_URL } from './config.js';

// Separate login pages, because one form with a Student/Staff toggle left it unclear who you'd log in as.
export const STUDENT_LOGIN_PATH = '/login';
export const STAFF_LOGIN_PATH = '/registrar/login';

const ACCESS_KEY = 'trailsync_access_token';
const REFRESH_KEY = 'trailsync_refresh_token';
const USER_KEY = 'trailsync_user';
const ALL_KEYS = [ACCESS_KEY, REFRESH_KEY, USER_KEY];
const FLASH_KEY = 'trailsync_flash';

function readFirst(key) {
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    // Storage can throw in a locked-down/private context; treat as signed out.
    return null;
  }
}

// Whichever storage currently holds the session, so updates keep "remember me" intact.
function sessionStore() {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      if (store.getItem(ACCESS_KEY)) return store;
    } catch {
      // Unavailable storage: try the other one.
    }
  }
  return null;
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

// Persist a login response, clearing the other storage so a token from an opposite remember-me choice can't linger.
export function saveSession({ access, refresh, user }, remember) {
  const target = remember ? window.localStorage : window.sessionStorage;
  const other = remember ? window.sessionStorage : window.localStorage;
  ALL_KEYS.forEach((key) => other.removeItem(key));
  target.setItem(ACCESS_KEY, access);
  target.setItem(REFRESH_KEY, refresh);
  target.setItem(USER_KEY, JSON.stringify(user));
}

// Refresh the cached user in whichever storage holds the session, so pages that read the cache see profile edits.
export function updateStoredUser(user) {
  if (!user) return;
  try {
    sessionStore()?.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Storage may be unavailable; the page's own state still shows the change until a reload.
  }
}

export function clearSession() {
  ALL_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

// One-time messages carried across a redirect, read once by the login page.

export function setFlash(kind) {
  try {
    window.sessionStorage.setItem(FLASH_KEY, kind);
  } catch {
    // The redirect still happens; the page just can't say why.
  }
}

export function takeFlash() {
  try {
    const kind = window.sessionStorage.getItem(FLASH_KEY);
    window.sessionStorage.removeItem(FLASH_KEY);
    return kind;
  } catch {
    return null;
  }
}

// The login page for the part of the app the person is currently in.
export function loginPathForHere() {
  return window.location.pathname.startsWith('/registrar') ? STAFF_LOGIN_PATH : STUDENT_LOGIN_PATH;
}

// End the session and send the person to their login with a reason; the only place that does this.
export function expireSession() {
  clearSession();
  setFlash('session_expired');
  window.location.replace(loginPathForHere());
}

let refreshing = null;

// Get a new access token once, however many requests find theirs expired at the same moment.
function refreshAccessToken() {
  if (refreshing) return refreshing;
  const refresh = readFirst(REFRESH_KEY);
  const store = sessionStore();
  if (!refresh || !store) return Promise.resolve(false);

  refreshing = fetch(`${API_BASE_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.access) return false;
      store.setItem(ACCESS_KEY, data.access);
      // ROTATE_REFRESH_TOKENS is on, so a new refresh token comes back too.
      if (data.refresh) store.setItem(REFRESH_KEY, data.refresh);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function send(path, options) {
  const token = getAccessToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// fetch() with the bearer token, and the one place a 401 is handled: refresh and retry once, else expire the session (the returned promise then never settles).
export async function authFetch(path, options = {}) {
  const res = await send(path, options);
  if (res.status !== 401) return res;

  if (await refreshAccessToken()) {
    const retried = await send(path, options);
    if (retried.status !== 401) return retried;
  }
  expireSession();
  return new Promise(() => {});
}
