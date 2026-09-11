/**
 * Turn what the server says into something a first-time user can act on.
 *
 * The backend's own messages are mostly written for people already ("Please
 * select a purpose."), but a handful come straight from the framework - "This
 * field is required.", "Invalid pk "7" - object does not exist." - and those
 * read like errors in the app rather than instructions to the person. Every
 * student-facing screen passes server text through here instead of showing
 * it raw, so the wording is fixed in one place.
 */

export const NETWORK_ERROR =
  "We couldn't reach TrailSync. Please check your internet connection and try again.";

export const SERVER_ERROR = 'Something went wrong on our side. Please try again in a moment.';

export const SESSION_ENDED = 'Your session has ended. Please log in again to continue.';

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
  // Both tabs use this: students log in with an email or a School ID, staff with an email.
  [/^Invalid credentials\.?$/i, "That login doesn't match our records. Please check what you typed and try again."],
  // Django's password validators - shown on Create Account and Change Password.
  [/^This password is too short\..*?(\d+) characters\.?$/i, (m) => `Please use at least ${m[1]} characters.`],
  [/^This password is too common\.?$/i, 'That password is too easy to guess. Please choose a different one.'],
  [/^This password is entirely numeric\.?$/i, 'Please use some letters too, not only numbers.'],
  [/^The password is too similar to the .*$/i, 'Your password is too close to your name or email. Please choose a different one.'],
  [/^(Authentication credentials were not provided|Given token not valid.*|Token is invalid or expired)\.?$/i, SESSION_ENDED],
  [/^Not found\.?$/i, "We couldn't find that. It may have been removed."],
  [/^You do not have permission to perform this action\.?$/i, "Your account isn't able to do that."],
  [/^Method ".*" not allowed\.?$/i, SERVER_ERROR],
];

/** One message, translated if it matches a known framework phrasing. */
export function friendlyMessage(message) {
  if (message === null || message === undefined) return '';
  const text = String(message).trim();
  for (const [pattern, replacement] of RULES) {
    const match = text.match(pattern);
    if (match) return typeof replacement === 'function' ? replacement(match) : replacement;
  }
  return text;
}

/**
 * A DRF error body -> { field: 'plain message' }.
 *
 * Arrays are joined, nested objects (the request form's form_data / proxy
 * sections) are flattened onto their own keys, and anything not tied to a
 * field lands on `general`. Field NAMES are never shown to the user - only
 * the messages are - so a key like "transaction_type" cannot leak onto the
 * screen.
 */
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

/** Everything in an error body, as one readable sentence or two. */
export function friendlySummary(data, fallback = SERVER_ERROR) {
  const messages = Object.values(friendlyFieldErrors(data)).filter(Boolean);
  return messages.length ? [...new Set(messages)].join(' ') : fallback;
}
