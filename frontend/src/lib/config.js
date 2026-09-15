import { IS_MOBILE_APP } from './platform.js';

// The app can't use 127.0.0.1, which on a phone is the phone itself. An Android emulator reaches this computer at
// 10.0.2.2; a real phone needs the computer's network address, set with VITE_MOBILE_API_BASE_URL.
export const API_BASE_URL = IS_MOBILE_APP
  ? import.meta.env.VITE_MOBILE_API_BASE_URL || 'http://10.0.2.2:8000'
  : import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
