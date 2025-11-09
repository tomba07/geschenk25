import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../lib/api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Get the push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: '463ad690-1cdb-4c10-80b7-45d83535eb32',
    });

    // Register token with backend
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await apiClient.registerDeviceToken(token.data, platform);

    console.log('Push notification token registered:', token.data);
    return token.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

export function setupNotificationHandlers(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationTapped: (response: Notifications.NotificationResponse) => void
) {
  // Handle notifications received while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener(onNotificationReceived);

  // Handle user tapping on a notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(onNotificationTapped);

  return {
    receivedSubscription,
    responseSubscription,
    cleanup: () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    },
  };
}

