import { useEffect, useRef, useState } from 'react';
import { Avatar, avatarUrlFor, CameraIcon, Spinner } from './trailsyncUI.jsx';
import { authFetch } from '../lib/auth.js';
import { NETWORK_ERROR, friendlySummary } from '../lib/friendlyErrors.js';

/**
 * Profile picture upload, shared by the Profile page and onboarding step 4.
 *
 * Split into a hook and two small pieces rather than one component because
 * the two screens lay it out differently: Profile puts the status lines in
 * the column beside the photo, onboarding stacks everything under it. The
 * behaviour - checks, crop, upload, remove - is written once, here.
 */

// Mirrors the server's rules in avatars.py. Checked here so a student hears
// "too big" instantly instead of after uploading 5 MB; the server checks
// again regardless, because the endpoint can be called without this page.
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 512;

/**
 * Centre-crop an image to a square and scale it to at most 512px, as a JPEG.
 *
 * Done before upload so what leaves the browser is already the shape and
 * size an avatar needs - a few tens of KB instead of a multi-megabyte phone
 * photo. Transparent areas are painted white, matching what the server does,
 * so the preview and the stored result look the same.
 *
 * Decoding through an <img> means the browser applies the photo's EXIF
 * orientation first, so a portrait shot is cropped upright.
 */
function cropToSquare(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const out = Math.min(side, AVATAR_OUTPUT_SIZE);
        const canvas = document.createElement('canvas');
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, out, out);
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.9);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

/**
 * @param onUpdated      (me, 'updated' | 'removed') => void, with the fresh /api/me/ payload.
 * @param onUnauthorized () => void, when the session has ended mid-upload.
 */
export function useAvatarUpload({ onUpdated, onUnauthorized }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null); // object URL while uploading
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Clear the success note after a moment; errors stay until the next try.
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  // Release the preview's object URL whenever it is replaced or dropped.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  /**
   * A new photo was picked.
   *
   * The preview appears the instant the file is chosen - from the file
   * itself, which the circle's object-fit crops visually - and the square
   * crop and upload run behind it with a spinner over the avatar. Whatever
   * the server returns then replaces the preview, so the photo on screen is
   * the one actually stored.
   */
  const handlePicked = async (e) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    e.target.value = '';
    if (!file) return;

    setError('');
    setNotice('');

    if (!AVATAR_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError(`That image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is 5 MB.`);
      return;
    }

    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      let upload;
      try {
        upload = await cropToSquare(file);
      } catch {
        setError("That image couldn't be read. Try a different file.");
        setPreview(null);
        return;
      }

      const fd = new FormData();
      fd.append('image', upload, 'avatar.jpg');
      // No Content-Type header: the browser sets multipart with its boundary.
      const res = await authFetch('/api/me/avatar/', { method: 'PATCH', body: fd });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlySummary(data, "We couldn't update your photo. Please try again."));
        setPreview(null);
        return;
      }
      setPreview(null);
      setNotice('Profile picture updated');
      onUpdated?.(data, 'updated');
    } catch {
      setError(NETWORK_ERROR);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = await authFetch('/api/me/avatar/', { method: 'DELETE' });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlySummary(data, "We couldn't remove your photo. Please try again."));
        return;
      }
      setNotice('Profile picture removed');
      onUpdated?.(data, 'removed');
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return {
    inputRef,
    preview,
    busy,
    error,
    notice,
    handlePicked,
    remove,
    choose: () => inputRef.current?.click(),
  };
}

/** The circle, its camera button, the hidden file input and "Remove photo". */
export function AvatarPicker({ me, upload }) {
  const hasPhoto = Boolean(avatarUrlFor(me));
  return (
    <div className="flex flex-col items-center gap-2.5">
      {/* Sized by .ts-avatar-xl, which shrinks to 96px on a phone. */}
      <div className="ts-avatar-frame relative">
        <Avatar
          user={me}
          src={upload.preview || avatarUrlFor(me)}
          className="ts-avatar-xl"
          alt={`${me?.first_name || ''} ${me?.last_name || ''}`.trim() || 'Profile picture'}
        />
        {upload.busy && (
          <span className="ts-avatar-busy" aria-hidden="true">
            <Spinner />
          </span>
        )}
        <button
          type="button"
          onClick={upload.choose}
          disabled={upload.busy}
          className="ts-avatar-edit"
          aria-label={hasPhoto ? 'Change profile picture' : 'Add a profile picture'}
        >
          <CameraIcon />
        </button>
      </div>
      <input
        ref={upload.inputRef}
        type="file"
        accept={AVATAR_TYPES.join(',')}
        onChange={upload.handlePicked}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      {hasPhoto && !upload.busy && (
        <button type="button" onClick={upload.remove} className="ts-link ts-tap text-xs font-medium">
          Remove photo
        </button>
      )}
    </div>
  );
}

/** Uploading / updated / error lines, announced to screen readers. */
export function AvatarStatus({ upload, className = '' }) {
  return (
    <div className={className}>
      <div aria-live="polite" className="min-h-[1.25rem]">
        {upload.busy && <p className="ts-soft text-xs">Uploading…</p>}
        {upload.notice && !upload.busy && (
          <p className="text-xs font-medium" style={{ color: '#2C4B3F' }}>
            {upload.notice}
          </p>
        )}
      </div>
      {upload.error && (
        <p role="alert" className="text-xs font-medium" style={{ color: '#B91C1C' }}>
          {upload.error}
        </p>
      )}
    </div>
  );
}
