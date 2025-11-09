import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { colors } from './src/styles/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { registerForPushNotifications, setupNotificationHandlers } from './src/services/notifications';
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
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

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
