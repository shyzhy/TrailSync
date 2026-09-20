import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { apiSend } from './api';

/**
 * Expo push tokens, ready for the day the backend can take them.
 *
 * An Expo token looks like `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]` — a string of about 41 characters, not a raw
 * FCM token. A DEVICE_TOKENS.token column of CharField(max_length=200) holds either comfortably. Sending is a POST to
 * https://exp.host/--/api/v2/push/send with {"to": token, "title": ..., "body": ...}; Expo forwards it to FCM/APNs, so
 * the backend never talks to Firebase itself.
 */
export const PUSH_REGISTER_PATH = '/api/me/device-tokens/';

/** Ask for permission and return this device's Expo push token, or null if it isn't available. */
export async function getExpoPushToken() {
  // Expo Go on Android can still receive Expo pushes, but a simulator has no token at all.
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'TrailSync',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return token?.data || null;
}

/**
 * Hand the token to the backend. Until DEVICE_TOKENS and its endpoint exist, a 404 is the expected answer and is
 * swallowed: a student shouldn't see an error because a feature isn't built yet.
 */
export async function registerPushToken() {
  try {
    const token = await getExpoPushToken();
    if (!token) return null;
    await apiSend(PUSH_REGISTER_PATH, 'POST', { token, platform: Platform.OS });
    return token;
  } catch (error) {
    if (error?.status === 404) return null;
    return null;
  }
}
