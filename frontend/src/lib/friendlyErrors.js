// Translates framework error text into plain words a first-time user can act on.

export const NETWORK_ERROR = "Can't connect right now. Check your connection and try again.";

export const SERVER_ERROR = 'Something went wrong on our end. Please try again in a moment.';

export const SESSION_ENDED = 'Your session expired. Please log in again.';

export const FORBIDDEN_ERROR = "You don't have permission to do that.";

export const NOT_FOUND_ERROR = "We couldn't find that. It may have been removed, or the link may be wrong.";

export const RATE_LIMITED_ERROR = "You've tried that a lot just now. Please wait a moment, then try again.";

// [pattern, replacement] - replacement is a string or a function of the match.
const RULES = [
  [/^This field is required\.?$/i, 'Please fill this in.'],
  [/^This field may not be (blank|null)\.?$/i, 'Please fill this in.'],
  [/^Enter a valid email address\.?$/i, 'Please enter a valid email address, like name@ustp.edu.ph.'],
  [/^A valid integer is required\.?$/i, 'Please enter a whole number, like 1 or 2.'],
  [/^A valid number is required\.?$/i, 'Please enter a number.'],
  [/^Ensure this field has no more than (\d+) characters\.?$/i, (m) => `Please keep this to ${m[1]} characters or fewer.`],
  [/^Ensure this field has at least (\d+) characters\.?$/i, (m) => `Please use at least ${m[1]} characters.`],
  [/^Ensure this value is greater than or equal to (\d+)\.?$/i, (m) => `Please enter ${m[1]} or more.`],
  [/^Ensure this value is less than or equal to (\d+)\.?$/i, (m) => `Please enter ${m[1]} or less.`],
  [/^Invalid pk .*does not exist\.?$/i, 'Please choose one of the options from the list.'],
  [/^Incorrect type\..*$/i, 'Please choose one of the options from the list.'],
  [/^".*" is not a valid choice\.?$/i, 'Please choose one of the options shown.'],
  [/^Date has wrong format.*$/i, 'Please enter a valid date.'],
  // Wording covers both student (email or School ID) and staff logins.
  [/^Invalid credentials\.?$/i, "That login doesn't match our records. Please check what you typed and try again."],
  // Django's password validators, shown wherever a password is chosen.
  [/^This password is too short\..*?(\d+) characters\.?$/i, (m) => `Please use at least ${m[1]} characters.`],
  [/^This password is too common\.?$/i, 'That password is too easy to guess. Please choose a different one.'],
  [/^This password is entirely numeric\.?$/i, 'Please use some letters too, not only numbers.'],
  [/^The password is too similar to the .*$/i, 'Your password is too close to your name or email. Please choose a different one.'],
  [/^(Authentication credentials were not provided|Given token not valid.*|Token is invalid or expired)\.?$/i, SESSION_ENDED],
  [/^(Not found|No \w+ matches the given query)\.?$/i, NOT_FOUND_ERROR],
  [/^You do not have permission to perform this action\.?$/i, FORBIDDEN_ERROR],
  [/^Request was throttled\..*$/i, RATE_LIMITED_ERROR],
  [/^Method ".*" not allowed\.?$/i, SERVER_ERROR],
];

// One message, translated if it matches a known framework phrasing.
export function friendlyMessage(message) {
  if (message === null || message === undefined) return '';
  const text = String(message).trim();
  for (const [pattern, replacement] of RULES) {
    const match = text.match(pattern);
    if (match) return typeof replacement === 'function' ? replacement(match) : replacement;
  }
  return text;
}

// A DRF error body as { field: message }: nested sections are flattened and non-field errors go to `general`.
export function friendlyFieldErrors(data) {
  const out = {};
  if (!data || typeof data !== 'object') return { general: SERVER_ERROR };

  const add = (key, value) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      const msgs = value.filter((v) => typeof v === 'string').map(friendlyMessage);
      if (msgs.length) out[key] = msgs.join(' ');
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => add(k, v));
    } else {
      out[key] = friendlyMessage(value);
    }
  };

  Object.entries(data).forEach(([key, value]) => {
    add(key === 'detail' || key === 'non_field_errors' ? 'general' : key, value);
  });
  return out;
}

// Everything in an error body, as one readable sentence or two.
export function friendlySummary(data, fallback = SERVER_ERROR) {
  const messages = Object.values(friendlyFieldErrors(data)).filter(Boolean);
  return messages.length ? [...new Set(messages)].join(' ') : fallback;
}
