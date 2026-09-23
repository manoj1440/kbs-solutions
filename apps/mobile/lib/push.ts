import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { api } from '@/lib/api';

/** Where tapping a push opens, per role — the in-app list re-checks access before showing any record (F-701). */
const LIST: Record<string, string> = { ADVISOR: '/(advisor)/notifications', MANAGER: '/(manager)/notifications', TELECALLER: '/(telecaller)/notifications' };

/**
 * F-701 / F-906: best-effort Expo push registration after sign-in. Never blocks login: no physical device, denied
 * permission or a build without an EAS projectId simply means in-app notifications only.
 */
export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return null;
    await Notifications.setNotificationChannelAsync('default', { name: 'KBS updates', importance: Notifications.AndroidImportance.DEFAULT });
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.post('/notifications/push-devices', { token, platform: 'ANDROID' });
    return token;
  } catch {
    return null;
  }
}

/** Opens the role's notification centre when a push is tapped. Returns an unsubscribe function. */
export function onPushTap(role: string | undefined): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(() => {
    const path = role ? LIST[role] : undefined;
    if (path) router.push(path as never);
  });
  return () => sub.remove();
}
