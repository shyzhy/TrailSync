# TrailSync student app (Android)

The student side of this frontend, wrapped as an Android app with Capacitor 8. It is a separate build of the same
code: it boots `src/mobile/main.jsx`, which routes only the student pages. Registrar and Admin pages are never
imported, so they are not in the app at all. Staff and admins use the website.

## One-time setup

- Node 22 or newer (`npm install` in `frontend/`)
- JDK 21, and the Android SDK with platform 36 (Android Studio installs both)
- Set `JAVA_HOME` to the JDK 21 folder and `ANDROID_HOME` to the SDK folder

## Build and run

| Command | What it does |
| --- | --- |
| `npm run build:mobile` | Builds the app's web assets into `dist-mobile/` (the website still builds with `npm run build`) |
| `npm run mobile:sync` | `build:mobile`, then copies it and the plugins into `android/` |
| `npm run mobile:run` | `mobile:sync`, then installs and starts the app on a running emulator or connected phone |
| `npm run mobile:open` | Opens `android/` in Android Studio |
| `npm run mobile:assets` | Regenerates the launcher icon and splash screen from `assets/*.png` |

Always rebuild with `mobile:sync` (or `mobile:run`) after changing web code. The app runs the files copied into
`android/`, not the Vite dev server.

## Pointing the app at the API

The app cannot use `127.0.0.1`, which on a phone means the phone itself.

- **Android emulator:** nothing to set. The app calls `http://10.0.2.2:8000`, the emulator's name for this computer.
- **Real phone on the same Wi-Fi:** add `VITE_MOBILE_API_BASE_URL=http://<this computer's IP>:8000` to
  `frontend/.env`, run Django with `python manage.py runserver 0.0.0.0:8000`, and rebuild.

The backend must also accept the app. In `BTrailSync/.env`, add the app's origin and the host it calls:

```
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://localhost
ALLOWED_HOSTS=localhost,127.0.0.1,10.0.2.2
```

(For a real phone, add the computer's IP to `ALLOWED_HOSTS` instead of, or as well as, `10.0.2.2`.)

## Before a release build

- Serve the API over HTTPS, then remove `server.cleartext` and `android.allowMixedContent` from
  `capacitor.config.json`. They exist only so the app can reach the plain-HTTP development server.
- Set up a release signing key; `mobile:run` installs a debug build.
- Links in emails (account activation, password reset, email change) open the website in the phone's browser.
  Opening them in the app would need Android App Links.
