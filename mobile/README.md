# TrailSync — student app (Expo)

The student side of TrailSync as a real React Native app. It is its own project: it shares no code with
`../frontend`, only the Django API. The Registrar and Admin portals stay on the website.

## Run it on your phone

1. Start the API so the phone can reach it. `127.0.0.1` is the phone itself, so bind to every interface:
   ```sh
   cd ../BTrailSync
   ..\venv\Scripts\python manage.py runserver 0.0.0.0:8000
   ```
   Add your computer's network address to `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` in `BTrailSync/.env`.
2. Start the app:
   ```sh
   npm start
   ```
3. Install **Expo Go** from the Play Store or App Store, and scan the QR code in the terminal. The phone and this
   computer must be on the same Wi-Fi.

The app works out which API to call from the address Expo served the bundle on, so on a normal `npm start` there is
nothing to configure. To point somewhere else (a deployed backend, say), set `EXPO_PUBLIC_API_URL`:

```sh
EXPO_PUBLIC_API_URL=https://trailsync.example.ph npm start
```

`npm run web` opens the same app in a browser. It is handy for a quick look, but it is a preview: some native
behaviour differs, and the web build keeps the session in `localStorage` rather than the device keystore.

## What's in here

| Path | What it is |
| --- | --- |
| `app/` | The screens. File-based routing (Expo Router): `(auth)` is signed out, `(app)` is the tabbed shell. |
| `src/components/` | The shared UI kit: cards, buttons, fields, pills, the ticket card. |
| `src/lib/` | API client, session storage, and the constants shared with the web app's wording. |
| `src/theme/tokens.js` | The colours, fonts and shadows — the same identity as the website. |

Styling is NativeWind, so `className` works the way it does on the web; the tokens live in `tailwind.config.js`.

Tokens are kept in `expo-secure-store` (Keychain on iOS, encrypted preferences on Android). The API client refreshes
an expired access token once and signs the student out if that fails, mirroring the website.

## Build an installable app (EAS)

No Android Studio and no local Gradle: EAS builds on Expo's servers.

```sh
npm install -g eas-cli
eas login                 # the team's Expo account
eas init                  # writes extra.eas.projectId into app.json
eas build --profile preview --platform android
```

`preview` produces an APK you can hand out or install directly; EAS gives you a link and a QR code for it.
`production` produces an AAB for the Play Store. Set the real API URL in `eas.json` before building — the profiles
there currently point at a placeholder host.

## Push notifications (not wired up yet)

`src/lib/push.js` can already ask for permission and fetch this device's Expo push token. Nothing sends it yet,
because the backend has no device-token table: `DEVICE_TOKENS` exists in the ERD only. When it is built:

- The token is a string like `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`, about 41 characters. A
  `CharField(max_length=200)` holds it with room to spare.
- Send by POSTing to `https://exp.host/--/api/v2/push/send` with `{"to": token, "title": ..., "body": ...}`. Expo
  forwards to FCM and APNs, so the backend never calls Firebase itself.
- `POST /api/me/device-tokens/` is the path the app already expects (see `PUSH_REGISTER_PATH`).
