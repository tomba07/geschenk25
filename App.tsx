import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';

type Screen = 'home' | 'groups' | 'groupDetail';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
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
  if (currentScreen === 'groups') {
    return (
      <GroupsScreen
        onGroupPress={(groupId) => {
          setSelectedGroupId(groupId);
          setCurrentScreen('groupDetail');
        }}
        onBack={() => setCurrentScreen('home')}
      />
    );
  }

  if (currentScreen === 'groupDetail' && selectedGroupId) {
    return (
      <GroupDetailScreen
        groupId={selectedGroupId}
        onBack={() => setCurrentScreen('groups')}
      />
    );
  }

  return (
    <HomeScreen
      onNavigateToGroups={() => setCurrentScreen('groups')}
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
    backgroundColor: '#fff',
  },
});
