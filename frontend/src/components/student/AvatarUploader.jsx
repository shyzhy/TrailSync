import { useEffect, useRef, useState } from 'react';
import { Avatar, avatarUrlFor, CameraIcon, Spinner } from '../ui/index.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';

// Profile picture upload shared by Profile and onboarding: one hook, two small layout pieces.

// Mirrors avatars.py so "too big" is instant; the server checks again regardless.
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 512;

// Centre-crop to a square JPEG of at most 512px; decoding via <img> applies EXIF orientation first.
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

// Failures worth a "Try again": the photo was fine, the trip to the server wasn't.
const RETRYABLE = ['network', 'server', 'rate_limited'];

// What a picked file's type is called, for "That file is a GIF".
function typeName(file) {
  const ext = (file.name.split('.').pop() || '').toUpperCase();
  return ext && ext.length <= 5 ? ext : 'different kind of';
}

// onUpdated(me, 'updated' | 'removed') receives the fresh /api/me/ payload.
export function useAvatarUpload({ onUpdated }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null); // object URL while uploading
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Kept so "Try again" can resend without the student finding the file again.
  const [retryPhoto, setRetryPhoto] = useState(null);

  // Clear the success note after a moment; errors stay until the next try.
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Upload a cropped photo. The preview is always dropped at the end, so a failed upload never looks saved.
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

// The circle, its camera button, the hidden file input and "Remove photo".
export function AvatarPicker({ me, upload }) {
  const hasPhoto = Boolean(avatarUrlFor(me));
  return (
    <div className="flex flex-col items-center gap-2.5">
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

// Uploading / updated / error lines, announced to screen readers.
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
