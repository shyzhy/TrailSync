// How account roles and states look on the admin pages.
export const ROLE_TAG = {
  Student: 'ts-tag',
  Alumni: 'ts-tag ts-tag-sage',
  'Registrar Staff': 'ts-tag ts-tag-gold',
  Admin: 'ts-tag ts-tag-plum',
};

export const STATE_PILL = {
  Active: 'ts-pill-ready',
  'Awaiting Setup': 'ts-pill-processing',
  Suspended: 'ts-pill-danger',
  'Email not confirmed': 'ts-pill-released',
  Pending: 'ts-pill-teal',
  Rejected: 'ts-pill-danger',
  'No staff profile': 'ts-pill-released',
};

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
