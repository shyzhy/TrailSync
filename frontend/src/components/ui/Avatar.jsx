import { useEffect, useState } from 'react';

export function initialsFor(me) {
  const a = (me?.first_name || '').charAt(0);
  const b = (me?.last_name || '').charAt(0);
  return (a + b).toUpperCase() || '?';
}

// The photo URL for a user, straight from the API.
export function avatarUrlFor(user) {
  return user?.profile?.profile_picture_url || user?.profile_picture_url || null;
}

// The photo-or-initials avatar, drawn into the slot's own circle; falls back to initials if the image fails.
export function Avatar({ user, src, className = '', alt = '' }) {
  const url = src !== undefined ? src : avatarUrlFor(user);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (url && !failed) {
    return (
      <span className={className} style={{ padding: 0, overflow: 'hidden' }}>
        <img
          src={url}
          alt={alt}
          onError={() => setFailed(true)}
          className="ts-avatar-photo"
          style={{ width: '100%', height: '100%' }}
        />
      </span>
    );
  }
  return (
    <span className={className} aria-hidden={alt ? undefined : true}>
      {initialsFor(user)}
    </span>
  );
}
