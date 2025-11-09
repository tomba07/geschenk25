import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/groupService';
import { Invitation } from '../types/group';
import { colors, spacing, typography, commonStyles } from '../styles/theme';

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
    <View style={[commonStyles.container, { paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0 }]}>
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
                <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
              ) : (
                invitations.map((invitation) => (
                  <View key={invitation.id} style={commonStyles.card}>
                    <View style={styles.invitationContent}>
                      <Text style={styles.invitationGroupName}>{invitation.group_name}</Text>
                      <Text style={styles.invitationText}>
                        Invited by @{invitation.inviter_username}
                      </Text>
                    </View>
                    <View style={styles.invitationActions}>
                      <TouchableOpacity
                        style={[styles.acceptButton, { marginRight: spacing.sm }]}
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
            style={[commonStyles.button, styles.groupsButton]}
            onPress={onNavigateToGroups}
          >
            <Text style={commonStyles.buttonText}>My Groups</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity style={[commonStyles.button, styles.signOutButton]} onPress={handleSignOut}>
        <Text style={commonStyles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  username: {
    ...typography.body,
    color: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl * 1.5,
    fontWeight: '600',
  },
  invitationsSection: {
    width: '100%',
    marginTop: spacing.xxl * 1.5,
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    color: colors.text,
  },
  loader: {
    marginVertical: spacing.xl,
  },
  invitationContent: {
    marginBottom: spacing.md,
  },
  invitationGroupName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  invitationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  invitationActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    ...typography.bodySmall,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: colors.textSecondary,
    ...typography.bodySmall,
    fontWeight: '600',
  },
  groupsButton: {
    minWidth: 200,
    marginTop: spacing.lg,
  },
  signOutButton: {
    backgroundColor: colors.danger,
    marginBottom: spacing.xl,
  },
});


