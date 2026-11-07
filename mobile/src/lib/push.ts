// Push notifications: bids, offers, sales and orders, the moment they happen.
// The server sends them through Expo (see the website's functions/_shared/push.js).
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { market } from './api';
import { store } from './storage';
import { appPath } from './links';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function pushEnabled(): Promise<boolean> {
  return !!(await store.get('pushToken'));
}

// Asks for permission (only when the member chose to turn notifications on) and registers this phone.
export async function enablePush(): Promise<'on' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return 'denied';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'ShoeLab', importance: AndroidImportance.HIGH, lightColor: '#CC1111' });
  }
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  try {
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    const r = await market('push/register', { body: { token, platform: Platform.OS } });
    if (!r.ok) return 'unavailable';
    await store.set('pushToken', token);
    return 'on';
  } catch { return 'unavailable'; }
}
export async function disablePush() {
  const token = await store.get('pushToken');
  if (token) await market('push/unregister', { body: { token } });
  await store.del('pushToken');
}

// A tap on a notification opens the page it is about.
export function usePushRouting() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (url?: unknown) => { const p = typeof url === 'string' ? appPath(url) : null; if (p) router.push(p as any); };
    Notifications.getLastNotificationResponseAsync().then((r) => { if (r) open(r.notification.request.content.data?.url); }).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data?.url));
    return () => sub.remove();
  }, []);
}
