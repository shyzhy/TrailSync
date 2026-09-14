import { useEffect, useRef, useState } from 'react';
import { Avatar, avatarUrlFor, CameraIcon, Spinner } from './trailsyncUI.jsx';
import { authFetch } from '../lib/auth.js';
import { errorFromResponse, toApiError } from '../lib/api.js';

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

// Failures worth offering "Try again" for: the photo itself was fine, the
// trip to the server wasn't.
const RETRYABLE = ['network', 'server', 'rate_limited'];

/** What a picked file's type is called, for "That file is a GIF". */
function typeName(file) {
  const ext = (file.name.split('.').pop() || '').toUpperCase();
  return ext && ext.length <= 5 ? ext : 'different kind of';
}

/**
 * @param onUpdated (me, 'updated' | 'removed') => void, with the fresh /api/me/ payload.
 *
 * An expired session needs no handling here: authFetch sends the person to
 * log in, like everywhere else.
 */
export function useAvatarUpload({ onUpdated }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null); // object URL while uploading
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // The cropped photo whose upload failed on the way, kept so "Try again"
  // can resend it without making the student find the file again.
  const [retryPhoto, setRetryPhoto] = useState(null);

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
   * Upload an already-cropped photo.
   *
   * The preview shows while it travels, and is always dropped at the end:
   * on success the stored photo from the server takes its place; on failure
   * the circle goes back to the old photo, because a preview left standing
   * after a failed upload would look exactly like one that worked.
   */
  const send = async (photo) => {
    setError('');
    setNotice('');
    setRetryPhoto(null);
    setPreview(URL.createObjectURL(photo));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('image', photo, 'avatar.jpg');
      // No Content-Type header: the browser sets multipart with its boundary.
      const res = await authFetch('/api/me/avatar/', { method: 'PATCH', body: fd });
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setNotice('Profile picture updated');
      onUpdated?.(data, 'updated');
    } catch (err) {
      const apiError = toApiError(err);
      if (RETRYABLE.includes(apiError.kind)) {
        setError(`Your photo wasn’t saved. ${apiError.message}`);
        setRetryPhoto(photo);
      } else {
        setError(apiError.message);
      }
    } finally {
      setPreview(null);
      setBusy(false);
    }
  };

  /** A new photo was picked: check it, crop it, send it. */
  const handlePicked = async (e) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    e.target.value = '';
    if (!file) return;

    setError('');
    setNotice('');
    setRetryPhoto(null);

    if (!AVATAR_TYPES.includes(file.type)) {
      setError(`That file is a ${typeName(file)} file. Please choose a JPEG, PNG, or WebP image.`);
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError(`That image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is 5 MB.`);
      return;
    }

    let photo;
    try {
      photo = await cropToSquare(file);
    } catch {
      setError("That image couldn't be opened. It may be damaged - try a different photo.");
      return;
    }
    await send(photo);
  };

  const retry = () => (retryPhoto ? send(retryPhoto) : undefined);

  const remove = async () => {
    setError('');
    setNotice('');
    setRetryPhoto(null);
    setBusy(true);
    try {
      const res = await authFetch('/api/me/avatar/', { method: 'DELETE' });
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setNotice('Profile picture removed');
      onUpdated?.(data, 'removed');
    } catch (err) {
      setError(`Your photo wasn’t removed. ${toApiError(err).message}`);
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
    canRetry: Boolean(retryPhoto),
    retry,
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
      {upload.error && !upload.busy && (
        <p role="alert" className="ts-field-error">
          {upload.error}
          {upload.canRetry && (
            <>
              {' '}
              <button type="button" onClick={upload.retry} className="ts-link font-semibold">
                Try again
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
