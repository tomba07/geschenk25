import { apiClient } from '../lib/api';

export function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getCurrentPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function enablePushNotifications() {
  if (!isPushNotificationSupported()) {
    return { error: 'Push notifications are not supported in this browser.' };
  }

  const configResponse = await apiClient.getNotificationConfig();
  if (configResponse.error || !configResponse.data?.enabled || !configResponse.data.publicKey) {
    return { error: configResponse.error || 'Push notifications are not configured yet.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { error: 'Notifications were not enabled.' };
  }

  const registration = await getOrRegisterServiceWorker();
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(configResponse.data.publicKey),
  });

  const saveResponse = await apiClient.savePushSubscription(subscription);
  if (saveResponse.error) {
    return { error: saveResponse.error };
  }

  return { subscription };
}

async function getOrRegisterServiceWorker() {
  return navigator.serviceWorker.getRegistration()
    .then((registration) => registration || navigator.serviceWorker.register('/sw.js'));
}

export async function disablePushNotifications() {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return { disabled: true };

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const response = await apiClient.deletePushSubscription(endpoint);
  if (response.error) {
    return { error: response.error };
  }

  return { disabled: true };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
