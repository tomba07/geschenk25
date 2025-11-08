import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/groupService';
import { Invitation } from '../types/group';

interface HomeScreenProps {
  onNavigateToGroups: () => void;
}

export default function HomeScreen({ onNavigateToGroups }: HomeScreenProps) {
  const { username, signOut } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const pendingInvitations = await groupService.getPendingInvitations();
      setInvitations(pendingInvitations);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: number) => {
    try {
      await groupService.acceptInvitation(invitationId);
      Alert.alert('Success', 'Invitation accepted! You can now view the group.');
      await loadInvitations();
      onNavigateToGroups();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept invitation');
    }
  };

  const handleRejectInvitation = async (invitationId: number) => {
    Alert.alert(
      'Reject Invitation',
      'Are you sure you want to reject this invitation?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupService.rejectInvitation(invitationId);
              await loadInvitations();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reject invitation');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome{username ? `, ${username}` : ''}!</Text>
          <Text style={styles.subtitle}>You are logged in</Text>
          {username && (
            <Text style={styles.username}>@{username}</Text>
          )}

          {invitations.length > 0 && (
            <View style={styles.invitationsSection}>
              <Text style={styles.sectionTitle}>Pending Invitations</Text>
              {loadingInvitations ? (
                <ActivityIndicator size="small" color="#007AFF" style={styles.loader} />
              ) : (
                invitations.map((invitation) => (
                  <View key={invitation.id} style={styles.invitationCard}>
                    <View style={styles.invitationContent}>
                      <Text style={styles.invitationGroupName}>{invitation.group_name}</Text>
                      <Text style={styles.invitationText}>
                        Invited by @{invitation.inviter_username}
                      </Text>
                    </View>
                    <View style={styles.invitationActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptInvitation(invitation.id)}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleRejectInvitation(invitation.id)}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.groupsButton}
            onPress={onNavigateToGroups}
          >
            <Text style={styles.groupsButtonText}>My Groups</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  username: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 8,
    marginBottom: 32,
    fontWeight: '600',
  },
  groupsButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    minWidth: 200,
    marginTop: 16,
  },
  groupsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  invitationsSection: {
    width: '100%',
    marginTop: 32,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000',
  },
  loader: {
    marginVertical: 20,
  },
  invitationCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  invitationContent: {
    marginBottom: 12,
  },
  invitationGroupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  invitationText: {
    fontSize: 14,
    color: '#666',
  },
  invitationActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});

