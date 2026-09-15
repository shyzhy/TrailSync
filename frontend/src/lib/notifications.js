import { authFetch } from './auth.js';

export function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Where a notification should take the student: straight to that request.
export function notificationHref(n) {
  return n.request_code ? `/track-requests?search=${encodeURIComponent(n.request_code)}` : '/track-requests';
}

export function markNotificationRead(id) {
  // Fire-and-forget: a failed mark-read only means the dot stays until next time.
  return authFetch(`/api/notifications/${id}/read/`, { method: 'POST' }).catch(() => {});
}
