import { apiClient } from '../lib/api';
import { isIosDevice, isSafariBrowser, isStandaloneApp } from './pwa';

export type PushAvailabilityStatus = 'available' | 'denied' | 'unsupported';

export interface PushAvailability {
  status: PushAvailabilityStatus;
  canPrompt: boolean;
  message: string;
}

export function isPushNotificationSupported() {
  return 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    && (!isIosDevice() || isStandaloneApp())
    && (!isSafariBrowser() || isStandaloneApp());
}

export function getPushNotificationAvailability(): PushAvailability {
  if (isIosDevice() && !isStandaloneApp()) {
    return {
      status: 'unsupported',
      canPrompt: false,
      message: 'On iPhone and iPad, install Geschenk to the Home Screen before enabling push notifications.',
    };
  }

  if (isSafariBrowser() && !isStandaloneApp()) {
    return {
      status: 'unsupported',
      canPrompt: false,
      message: 'In Safari, install Geschenk to the Dock before enabling push notifications.',
    };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      status: 'unsupported',
      canPrompt: false,
      message: 'Push notifications are not supported in this browser.',
    };
  }

  if (!window.isSecureContext) {
    return {
      status: 'unsupported',
      canPrompt: false,
      message: 'Push notifications require localhost or HTTPS.',
    };
  }

  if (Notification.permission === 'denied') {
    return {
      status: 'denied',
      canPrompt: false,
      message: 'Push notifications are blocked for this browser or device. Enable them in browser or macOS settings to use push.',
    };
  }

  return {
    status: 'available',
    canPrompt: true,
    message: 'PWA notifications work best after installing Geschenk to your home screen or dock.',
  };
}

export function getPushNotificationSupportMessage() {
  return getPushNotificationAvailability().message;
}

export async function getCurrentPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function enablePushNotifications() {
  const availability = getPushNotificationAvailability();
  if (!availability.canPrompt) {
    return { error: availability.message };
  }

  const configResponse = await apiClient.getNotificationConfig();
  if (configResponse.error || !configResponse.data?.enabled || !configResponse.data.publicKey) {
    return { error: configResponse.error || 'Push notifications are not configured yet.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { error: 'Notifications were not enabled.' };
  }

  let subscription: PushSubscription;
  try {
    const registration = await getOrRegisterServiceWorker();
    const existingSubscription = await registration.pushManager.getSubscription();
    subscription = existingSubscription || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(configResponse.data.publicKey),
    });
  } catch (error) {
    return { error: getPushRegistrationErrorMessage(error) };
  }

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

function getPushRegistrationErrorMessage(error: unknown) {
  const errorName = error instanceof DOMException ? error.name : '';
  const errorMessage = error instanceof Error ? error.message : '';

  if (errorName === 'AbortError' || /push service/i.test(errorMessage)) {
    return 'The browser could not register with its push service. Try a regular Chrome/Edge window, or install the app to the Dock in Safari. Embedded browsers, private windows, and blocked Google/Apple push services can cause this.';
  }

  if (!window.isSecureContext) {
    return 'Push notifications require a secure context. Use localhost or HTTPS.';
  }

  return errorMessage || 'Failed to register push notifications on this browser.';
}
