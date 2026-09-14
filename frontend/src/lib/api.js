/**
 * One way to call the API and one shape for everything that can go wrong.
 *
 * Every failure becomes an ApiError with a `kind` the UI switches on and a
 * plain-language `message` it can show as-is:
 *
 *   network      the request never reached the server
 *   validation   400/422 - `fieldErrors` maps each problem to its form field
 *   forbidden    403 - not theirs, or not their role
 *   not_found    404
 *   conflict     409 - e.g. a request that moved on while the page was open
 *   rate_limited 429
 *   server       5xx, or a response that wasn't the JSON it should have been
 *
 * 401 never appears here: authFetch handles it centrally (refresh, or send
 * the person back to log in).
 */
import { authFetch } from './auth.js';
import {
  FORBIDDEN_ERROR,
  NETWORK_ERROR,
  NOT_FOUND_ERROR,
  RATE_LIMITED_ERROR,
  SERVER_ERROR,
  friendlyFieldErrors,
  friendlyMessage,
  friendlySummary,
} from './friendlyErrors.js';

export class ApiError extends Error {
  constructor(kind, message, { status = null, data = null, fieldErrors = {} } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.data = data;
    this.fieldErrors = fieldErrors;
  }
}

// DRF's stock permission sentence says nothing useful; anything more specific
// (a staff account still pending, a locked record) is worth showing as-is.
const GENERIC_FORBIDDEN = /^(You do not have permission to perform this action|Authentication credentials were not provided)\.?$/i;

/** Build the ApiError for a response that wasn't ok. */
export async function errorFromResponse(res, fallback) {
  const data = await res.json().catch(() => null);
  const detail = data && typeof data.detail === 'string' ? data.detail : '';
  const status = res.status;

  if (status === 400 || status === 422) {
    return new ApiError('validation', friendlySummary(data, fallback || SERVER_ERROR), {
      status,
      data,
      fieldErrors: friendlyFieldErrors(data),
    });
  }
  if (status === 403) {
    const message = detail && !GENERIC_FORBIDDEN.test(detail) ? friendlyMessage(detail) : FORBIDDEN_ERROR;
    return new ApiError('forbidden', message, { status, data });
  }
  if (status === 404) return new ApiError('not_found', NOT_FOUND_ERROR, { status, data });
  if (status === 409) return new ApiError('conflict', friendlyMessage(detail) || SERVER_ERROR, { status, data });
  if (status === 429) return new ApiError('rate_limited', RATE_LIMITED_ERROR, { status, data });
  return new ApiError('server', SERVER_ERROR, { status, data });
}

/** Whatever was thrown, as an ApiError. A TypeError from fetch means no connection. */
export function toApiError(error) {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError) return new ApiError('network', NETWORK_ERROR);
  // Anything else is a bug in how a response was handled, not the network.
  console.error(error); // eslint-disable-line no-console
  return new ApiError('server', SERVER_ERROR);
}

/**
 * Whatever went wrong with a form submit, ready to put on the form.
 *
 * Validation messages for fields the form shows land under those fields;
 * everything else - a field the form doesn't display, a permission problem,
 * a lost connection - is gathered into `general`, so no message is ever
 * silently dropped.
 *
 * @param fields  Server field names the form shows, or { serverName: formName }.
 * @returns { [formName]: message, general?: message }
 */
export function formErrors(error, fields = []) {
  const err = toApiError(error);
  if (err.kind !== 'validation') return { general: err.message };

  const names = Array.isArray(fields) ? Object.fromEntries(fields.map((f) => [f, f])) : fields;
  const out = {};
  const loose = [];
  Object.entries(err.fieldErrors).forEach(([key, message]) => {
    if (names[key]) out[names[key]] = message;
    else loose.push(message);
  });
  if (loose.length) out.general = [...new Set(loose)].join(' ');
  return out;
}

/**
 * GET/POST/PATCH and get the parsed JSON back, or an ApiError thrown.
 *
 * @param path     '/api/...'
 * @param options  fetch options; pass `json` for a JSON body
 */
export async function apiJson(path, { json, ...options } = {}) {
  let res;
  try {
    res = await authFetch(path, {
      ...options,
      ...(json !== undefined
        ? { body: JSON.stringify(json), headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }
        : {}),
    });
  } catch (error) {
    throw toApiError(error);
  }
  if (!res.ok) throw await errorFromResponse(res);
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch {
    throw new ApiError('server', SERVER_ERROR, { status: res.status });
  }
}

/** Several GETs at once; the first failure wins. */
export function apiAll(paths) {
  return Promise.all(paths.map((p) => apiJson(p)));
}
