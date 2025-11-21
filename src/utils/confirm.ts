import { Platform, Alert } from 'react-native';

/**
 * Cross-platform confirmation dialog
 * Uses window.confirm on web, Alert.alert on native
 */
export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: 'OK',
          onPress: onConfirm,
        },
      ]
    );
  }
}

/**
 * Cross-platform confirmation dialog with destructive action
 * Uses window.confirm on web, Alert.alert on native
 */
export function confirmDestructive(
  title: string,
  message: string,
  confirmText: string = 'Delete',
  onConfirm: () => void,
  onCancel?: () => void
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: confirmText,
          style: 'destructive',
          onPress: onConfirm,
        },
      ]
    );
  }
}

