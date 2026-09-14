// Token/session storage, shared by every page that needs to know who's
// logged in. Centralized so the storage keys and the localStorage-vs-
// sessionStorage ("remember me") rule live in exactly one place.
import { API_BASE_URL } from '../components/trailsyncUI.jsx';

/**
 * Where each audience logs in. Two pages rather than one with a role toggle:
 * a single "Log in" button under a Student/Staff switch left it unclear who
 * the button would log you in as. Every page that bounces an expired session
 * sends it to the login for ITS side of the app.
 */
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

/** Whichever storage currently holds the session, so updates keep "remember me" intact. */
function sessionStore() {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      if (store.getItem(ACCESS_KEY)) return store;
    } catch {
      // unavailable storage: try the other one
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

/**
 * Replace the cached user with a fresh copy from the server, in whichever
 * storage currently holds the session.
 *
 * Needed because not every page asks /api/me/ on load - the Credential Guide
 * renders its sidebar straight from this cache - so a change made on the
 * Profile page (a new photo, an edited name) would otherwise stay invisible
 * there until the next login. Writing to the storage that already holds the
 * access token keeps the "remember me" choice made at login intact.
 */
export function updateStoredUser(user) {
  if (!user) return;
  try {
    sessionStore()?.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Storage can be unavailable in a locked-down context; the page's own
    // state still reflects the change, it just won't outlive a reload.
  }
}

export function clearSession() {
  ALL_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

// ---------------------------------------------------------------------------
// One-time messages carried across a redirect ("your session expired",
// "your password was changed"), read once by the login page.
// ---------------------------------------------------------------------------

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

/** The login page for the part of the app the person is currently in. */
export function loginPathForHere() {
  return window.location.pathname.startsWith('/registrar') ? STAFF_LOGIN_PATH : STUDENT_LOGIN_PATH;
}

/**
 * The session is over: clear it and send the person to log in again, with a
 * message saying why rather than a silently broken page. The one place in
 * the app that does this.
 */
export function expireSession() {
  clearSession();
  setFlash('session_expired');
  window.location.replace(loginPathForHere());
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

let refreshing = null;

/**
 * Trade the refresh token for a new access token, once, however many
 * requests find their token expired at the same moment - they all wait on
 * the same attempt instead of each rotating the refresh token in turn.
 *
 * Until this existed nothing ever used the refresh token, so every session
 * ended 30 minutes after login no matter what "Keep me logged in" said.
 */
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

/**
 * fetch() with the bearer token attached - and the ONE place a 401 is handled.
 *
 * A 401 first tries a silent token refresh and repeats the request once. If
 * that can't rescue it, the session is expired centrally (see
 * expireSession) and the returned promise never settles: the page is being
 * replaced by the login screen, and resolving would only let the calling
 * component flash an error state on its way out. No page should check for
 * 401 itself.
 */
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
