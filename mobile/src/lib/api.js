import { API_BASE_URL } from './config';
import { clearSession, currentSession, getAccessToken, saveTokens } from './session';

/** An API failure with the server's own wording, and its field errors where it sent them. */
export class ApiError extends Error {
  constructor(message, { status = 0, fields = {}, code = null, kind = 'error' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
    this.code = code;
    this.kind = kind;
  }
}

const KIND_BY_STATUS = { 400: 'validation', 401: 'auth', 403: 'forbidden', 404: 'missing', 409: 'conflict', 429: 'throttled' };

function fieldsFrom(data) {
  if (!data || typeof data !== 'object') return {};
  const fields = {};
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'detail' || key === 'code') return;
    if (Array.isArray(value)) fields[key] = String(value[0]);
    else if (typeof value === 'string') fields[key] = value;
    else if (value && typeof value === 'object') {
      // form_data errors arrive nested, one level deep.
      Object.entries(value).forEach(([inner, innerValue]) => {
        fields[inner] = Array.isArray(innerValue) ? String(innerValue[0]) : String(innerValue);
      });
    }
  });
  return fields;
}

export async function errorFromResponse(res, fallback = 'Something went wrong. Please try again.') {
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  const message = data?.detail || Object.values(fieldsFrom(data))[0] || fallback;
  return new ApiError(message, { status: res.status, fields: fieldsFrom(data), code: data?.code, kind: KIND_BY_STATUS[res.status] || 'error' });
}

export function toApiError(error) {
  if (error instanceof ApiError) return error;
  // No response at all: on a phone this is nearly always the network, not the server.
  return new ApiError('We couldn’t reach TrailSync. Check your connection and try again.', { kind: 'network' });
}

/** {field: message} for the inputs a screen shows, with anything else gathered under `general`. */
export function formErrors(error, fields = []) {
  const apiError = toApiError(error);
  const out = {};
  const leftovers = [];
  Object.entries(apiError.fields).forEach(([key, message]) => {
    if (fields.includes(key)) out[key] = message;
    else leftovers.push(message);
  });
  const general = apiError.fields.detail || (Object.keys(out).length ? leftovers[0] : apiError.message);
  if (general) out.general = general;
  return out;
}

let refreshing = null;

// One refresh however many requests find their token expired at the same moment.
function refreshAccessToken() {
  if (refreshing) return refreshing;
  const { refresh } = currentSession();
  if (!refresh) return Promise.resolve(false);

  refreshing = fetch(`${API_BASE_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.access) return false;
      // ROTATE_REFRESH_TOKENS is on, so a new refresh token comes back with it.
      await saveTokens({ access: data.access, refresh: data.refresh });
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
 * fetch() with the bearer token, and the one place a 401 is handled: refresh and retry once, then sign out.
 * Signing out clears the session, which the root layout watches, so the app returns to the login screen.
 */
export async function authFetch(path, options = {}) {
  let res;
  try {
    res = await send(path, options);
  } catch {
    throw toApiError(null);
  }
  if (res.status !== 401) return res;

  if (await refreshAccessToken()) {
    const retried = await send(path, options);
    if (retried.status !== 401) return retried;
  }
  await clearSession();
  throw new ApiError('Your session has ended. Please sign in again.', { status: 401, kind: 'auth' });
}

/** authFetch plus the JSON, raising the server's own message when it refuses. */
export async function apiGet(path) {
  const res = await authFetch(path);
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}

export async function apiSend(path, method, body, { multipart = false } = {}) {
  const options = { method };
  if (multipart) {
    options.body = body; // FormData: the runtime sets the multipart boundary itself.
  } else if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const res = await authFetch(path, options);
  if (!res.ok) throw await errorFromResponse(res);
  return res.status === 204 ? null : res.json();
}

/** Sign-in and the other endpoints that run without a token. */
export async function publicPost(path, body) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw toApiError(null);
  }
  if (!res.ok) throw await errorFromResponse(res);
  return res.json();
}
