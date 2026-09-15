import {
  FORBIDDEN_ERROR,
  friendlyFieldErrors,
  friendlyMessage,
  friendlySummary,
  NETWORK_ERROR,
  NOT_FOUND_ERROR,
  RATE_LIMITED_ERROR,
  SERVER_ERROR,
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

// DRF's stock permission sentence says nothing useful; more specific 403 details are shown as-is.
const GENERIC_FORBIDDEN = /^(You do not have permission to perform this action|Authentication credentials were not provided)\.?$/i;

// Build the ApiError for a response that wasn't ok.
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

// Whatever was thrown, as an ApiError. A TypeError from fetch means no connection.
export function toApiError(error) {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError) return new ApiError('network', NETWORK_ERROR);
  // Anything else is a bug in how a response was handled, not the network.
  console.error(error); // eslint-disable-line no-console
  return new ApiError('server', SERVER_ERROR);
}

// Maps a failed form submit onto the form's fields; anything without a visible field goes to `general`.
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
