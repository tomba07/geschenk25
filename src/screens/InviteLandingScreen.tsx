import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { colors, spacing, typography, commonStyles } from '../styles/theme';
import { APP_STORE_URL, PLAY_STORE_URL } from '../utils/constants';

interface InviteLandingScreenProps {
  token: string;
  onOpenApp: () => void;
  onContinueWeb: () => void;
}

export default function InviteLandingScreen({
  token,
  onOpenApp,
  onContinueWeb,
}: InviteLandingScreenProps) {
  const isIOS = Platform.OS === 'ios' || (typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);
  const isAndroid = Platform.OS === 'android' || (typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent));

  const handleOpenApp = () => {
    // Use Universal Links - navigate to HTTPS URL
    // iOS will automatically open the app if installed via Universal Links
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const appUrl = `https://geschenk.mteschke.com/join/${token}`;
      window.location.href = appUrl;
    } else {
      onOpenApp();
    }
  };

  const handleOpenStore = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      let storeUrl: string;
      if (isIOS) {
        // Use itms-apps:// scheme for better iOS compatibility
        storeUrl = 'itms-apps://apps.apple.com/us/app/id6755076791';
      } else {
        storeUrl = PLAY_STORE_URL;
      }
      
      try {
        const link = document.createElement('a');
        link.href = storeUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (link.parentNode) {
            document.body.removeChild(link);
          }
        }, 100);
      } catch (error) {
        // Fallback to window.location
        window.location.href = storeUrl;
      }
    } else {
      Linking.openURL(isIOS ? APP_STORE_URL : PLAY_STORE_URL).catch((err) => {
        console.error('Error opening store:', err);
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🎁</Text>
        </View>
        <Text style={styles.title}>Join Secret Santa Group</Text>
        <Text style={styles.subtitle}>
          Open the Geschenk app to join this group
        </Text>

        <TouchableOpacity
          style={[commonStyles.button, styles.openAppButton]}
          onPress={handleOpenApp}
        >
          <Text style={commonStyles.buttonText}>Open in App</Text>
        </TouchableOpacity>

        <View style={styles.fallbackContainer}>
          <TouchableOpacity
            style={[commonStyles.button, styles.storeButton]}
            onPress={handleOpenStore}
          >
            <Text style={commonStyles.buttonText}>
              {isIOS ? 'Download from App Store' : 'Download from Play Store'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.webLink}
            onPress={onContinueWeb}
          >
            <Text style={styles.webLinkText}>Continue on Web</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    ...typography.h2,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  openAppButton: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  fallbackContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fallbackText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  storeButton: {
    width: '100%',
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
  },
  webLink: {
    padding: spacing.sm,
  },
  webLinkText: {
    ...typography.body,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});

