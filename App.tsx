import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { colors } from './src/styles/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { registerForPushNotifications, setupNotificationHandlers } from './src/services/notifications';
import { apiClient } from './src/lib/api';
import { getErrorMessage } from './src/utils/errors';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';

type Screen = 'home' | 'groupDetail' | 'profile';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [refreshHomeKey, setRefreshHomeKey] = useState(0);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  // Handle deep linking for invite links
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const parsed = Linking.parse(event.url);
      
      // URL format: geschenk25://join/TOKEN
      // Parsed structure: { hostname: "join", path: "TOKEN", scheme: "geschenk25" }
      let token: string | null = null;
      
      // Extract token from path when hostname is "join"
      if (parsed.hostname === 'join' && parsed.path) {
        token = parsed.path.replace(/^\//, ''); // Remove leading slash if present
      } else if (parsed.path) {
        // Fallback: try to extract from path segments
        const pathSegments = parsed.path.split('/').filter(Boolean);
        if (pathSegments[0] === 'join' && pathSegments[1]) {
          token = pathSegments[1];
        } else if (pathSegments.length > 0) {
          token = pathSegments[0];
        }
      }
      
      if (!token) {
        console.error('Could not extract token from invite link:', event.url);
        return;
      }
      
      if (!isAuthenticated) {
        // Fail silently if user is not logged in
        return;
      }

      // Get group info
      const groupResponse = await apiClient.getGroupByInviteToken(token);
      if (groupResponse.error || !groupResponse.data) {
        Alert.alert('Error', groupResponse.error || 'Invalid invite link');
        return;
      }

      const group = groupResponse.data.group;

      // Show join confirmation
      Alert.alert(
        'Join Group',
        `Do you want to join "${group.name}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Join',
            onPress: async () => {
              try {
                const joinResponse = await apiClient.joinGroupByToken(token);
                if (joinResponse.error) {
                  Alert.alert('Error', joinResponse.error);
                  return;
                }
                
                Alert.alert('Success', 'You have joined the group!', [
                  {
                    text: 'OK',
                    onPress: () => {
                      setSelectedGroupId(joinResponse.data?.group_id.toString() || null);
                      setCurrentScreen('groupDetail');
                      setRefreshHomeKey(prev => prev + 1);
                    },
                  },
                ]);
              } catch (error) {
                Alert.alert('Error', getErrorMessage(error));
              }
            },
          },
        ]
      );
    };

    // Handle initial URL (when app is opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    }).catch((error) => {
      console.error('Error getting initial URL:', error);
    });

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      // Register for push notifications when authenticated
      registerForPushNotifications();

      // Set up notification handlers
      const handlers = setupNotificationHandlers(
        (notification) => {
          console.log('Notification received:', notification);
        },
        (response) => {
          console.log('Notification tapped:', response);
          const data = response.notification.request.content.data;
          
          // Navigate to home screen if it's an invitation notification
          if (data?.type === 'invitation') {
            setCurrentScreen('home');
            // Force refresh of home screen to reload invitations
            setRefreshHomeKey(prev => prev + 1);
          }
        }
      );

      notificationListener.current = handlers.receivedSubscription;
      responseListener.current = handlers.responseSubscription;

      return () => {
        handlers.cleanup();
      };
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    if (showSignup) {
      return <SignupScreen onSwitchToLogin={() => setShowSignup(false)} />;
    }
    return <LoginScreen onSwitchToSignup={() => setShowSignup(true)} />;
  }

  // Authenticated screens
  if (currentScreen === 'groupDetail' && selectedGroupId) {
    return (
      <GroupDetailScreen
        groupId={selectedGroupId}
        onBack={() => setCurrentScreen('home')}
      />
    );
  }

  if (currentScreen === 'profile') {
    return (
      <ProfileScreen
        onBack={() => setCurrentScreen('home')}
      />
    );
  }

  return (
    <HomeScreen
      key={refreshHomeKey}
      onGroupPress={(groupId) => {
        setSelectedGroupId(groupId);
        setCurrentScreen('groupDetail');
      }}
      onNavigateToProfile={() => setCurrentScreen('profile')}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
