import Constants from 'expo-constants';

// Where the Django API lives.
//
// A phone running Expo Go is a different machine from the one serving the API, so localhost and the emulator's
// 10.0.2.2 are both wrong. Expo already knows the address the bundle was fetched from (hostUri, e.g."192.168.1.7:8081"),
// which is this computer on the local network, so the API is the same host on the backend's port. Set
// EXPO_PUBLIC_API_URL to point somewhere else, such as the deployed backend.
const DEV_API_PORT = 8000;

function hostFromExpo() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    '';
  const host = String(hostUri).split(':')[0];
  return host || null;
}

function resolveBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl;
  if (configured) return String(configured).replace(/\/+$/, '');
  const host = hostFromExpo();
  if (host) return `http://${host}:${DEV_API_PORT}`;
  // Last resort (a web preview served from this machine).
  return `http://127.0.0.1:${DEV_API_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();
