import { apiClient } from '../lib/api';

export async function registerForPushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  // Web Push requires a VAPID public key and backend subscription endpoint.
  // Keep this as a no-op until that backend contract is added.
  await apiClient.registerDeviceToken('web-push-not-configured', 'web');
  return null;
}

export function setupNotificationHandlers() {
  return {
    cleanup: () => undefined,
  };
}
