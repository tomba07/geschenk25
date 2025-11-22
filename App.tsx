import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { colors } from './src/styles/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { registerForPushNotifications, setupNotificationHandlers } from './src/services/notifications';
import { apiClient } from './src/lib/api';
import { getErrorMessage } from './src/utils/errors';
import { APP_STORE_URL, PLAY_STORE_URL } from './src/utils/constants';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import InviteLandingScreen from './src/screens/InviteLandingScreen';

type Screen = 'home' | 'groupDetail' | 'profile' | 'inviteLanding';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [refreshHomeKey, setRefreshHomeKey] = useState(0);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  // Handle deep linking for invite links
  const handleDeepLink = async (event: { url: string }) => {
      const parsed = Linking.parse(event.url);
      
      let token: string | null = null;
      
      // Handle native deep links: geschenk25://join/TOKEN
      if (parsed.scheme === 'geschenk25') {
        if (parsed.hostname === 'join' && parsed.path) {
          token = parsed.path.replace(/^\//, '');
        } else if (parsed.path) {
          const pathSegments = parsed.path.split('/').filter(Boolean);
          if (pathSegments[0] === 'join' && pathSegments[1]) {
            token = pathSegments[1];
          }
        }
      }
      // Handle web URLs: https://domain.com/join/TOKEN
      else if (parsed.path) {
        const pathSegments = parsed.path.split('/').filter(Boolean);
        if (pathSegments[0] === 'join' && pathSegments[1]) {
          token = pathSegments[1];
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
                  
                  // Navigate directly to the group
                  setSelectedGroupId(joinResponse.data?.group_id.toString() || null);
                  setCurrentScreen('groupDetail');
                  setRefreshHomeKey(prev => prev + 1);
                } catch (error) {
                  Alert.alert('Error', getErrorMessage(error));
                }
              },
            },
        ]
      );
  };

  useEffect(() => {
    // Handle initial URL (when app is opened via deep link or web URL)
    if (Platform.OS === 'web') {
      // On web, check the current URL path
      if (typeof window !== 'undefined') {
        // Wait for DOM to be ready before processing
        const processUrl = () => {
          const currentUrl = window.location.href;
          const url = new URL(currentUrl);
          
          // Check if this is a /join/:token route
          const pathMatch = url.pathname.match(/^\/join\/([^/]+)$/);
          if (pathMatch) {
            const token = pathMatch[1];
            
            // Detect mobile device
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
            const isAndroid = /Android/.test(navigator.userAgent);
            
            if (isIOS || isAndroid) {
              // On mobile, show the landing page instead of automatic redirect
              setInviteToken(token);
              setCurrentScreen('inviteLanding');
              return; // Don't process as normal deep link
            } else {
              // On desktop, process as normal deep link (web app)
              handleDeepLink({ url: currentUrl });
              return;
            }
          }
          
          // Normal web app flow
          handleDeepLink({ url: currentUrl });
        };
        
        // Wait for DOM to be ready and ensure React has initialized
        const initRedirect = () => {
          try {
            processUrl();
          } catch (error) {
            console.error('Error processing URL:', error);
            // Fallback: just process as normal deep link
            try {
              handleDeepLink({ url: window.location.href });
            } catch (e) {
              console.error('Error in fallback deep link handling:', e);
            }
          }
        };
        
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            // Wait a bit more for React to initialize
            setTimeout(initRedirect, 200);
          });
        } else {
          // DOM is already ready, but wait a bit for React to initialize
          setTimeout(initRedirect, 200);
        }
      }
    } else {
      // On native, use Linking API
      Linking.getInitialURL().then((url) => {
        if (url) {
          handleDeepLink({ url });
        }
      }).catch((error) => {
        console.error('Error getting initial URL:', error);
      });
    }

    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // On web, also listen to popstate for browser navigation
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePopState = () => {
        handleDeepLink({ url: window.location.href });
      };
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        subscription.remove();
        window.removeEventListener('popstate', handlePopState);
      };
    }

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
        async (response) => {
          console.log('Notification tapped:', response);
          const data = response.notification.request.content.data as any;
          
          // Show join dialog if it's an invitation notification
          if (data?.type === 'invitation' && data?.groupId && data?.invitationId) {
            const groupName = data.groupName || 'this group';
            const invitationId = Number(data.invitationId);
            const groupId = Number(data.groupId);
            
            Alert.alert(
              'Join Group',
              `Do you want to join "${groupName}"?`,
              [
                {
                  text: 'Reject',
                  style: 'cancel',
                  onPress: async () => {
                    try {
                      await apiClient.rejectInvitation(invitationId);
                      setRefreshHomeKey(prev => prev + 1);
                    } catch (error) {
                      Alert.alert('Error', getErrorMessage(error));
                    }
                  },
                },
                {
                  text: 'Accept',
                  onPress: async () => {
                    try {
                      const acceptResponse = await apiClient.acceptInvitation(invitationId);
                      if (acceptResponse.error) {
                        Alert.alert('Error', acceptResponse.error);
                        return;
                      }
                      
                      // Navigate directly to the group
                      setSelectedGroupId(groupId.toString());
                      setCurrentScreen('groupDetail');
                      setRefreshHomeKey(prev => prev + 1);
                    } catch (error) {
                      Alert.alert('Error', getErrorMessage(error));
                    }
                  },
                },
              ]
            );
          }
          
          // Navigate to group detail if it's an assignment notification
          if (data?.type === 'assignment' && data?.groupId) {
            const groupId = Number(data.groupId);
            setSelectedGroupId(groupId.toString());
            setCurrentScreen('groupDetail');
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

  // Handle invite landing screen (shown on mobile web before authentication)
  if (currentScreen === 'inviteLanding' && inviteToken) {
    return (
      <InviteLandingScreen
        token={inviteToken}
        onOpenApp={async () => {
          // When user clicks "Open in App", process the deep link
          // This will work on native, and on web it will attempt to open the app
          const appScheme = `geschenk25://join/${inviteToken}`;
          try {
            await Linking.openURL(appScheme);
            // On native, this will open the app and the deep link handler will process it
            // On web, this will attempt to open the native app
          } catch (error) {
            console.error('Error opening app:', error);
          }
        }}
        onContinueWeb={async () => {
          // When user clicks "Continue on Web", navigate to home
          // The invite link will be processed after authentication if needed
          const token = inviteToken;
          setCurrentScreen('home');
          setInviteToken(null);
          // If authenticated, process the invite link
          if (isAuthenticated && token) {
            // Use setTimeout to ensure state updates are processed first
            setTimeout(() => {
              handleDeepLink({ url: `geschenk25://join/${token}` });
            }, 100);
          }
        }}
      />
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
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrapper}>
        <View style={styles.appContainer}>
          <AuthProvider>
            <AppContent />
            <StatusBar style="auto" />
          </AuthProvider>
        </View>
      </View>
    );
  }

  return (
    <AuthProvider>
      <AppContent />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    ...(Platform.OS === 'web' && {
      minHeight: '100vh',
    }),
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 428,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 20px rgba(0, 0, 0, 0.1)',
    } as any),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
