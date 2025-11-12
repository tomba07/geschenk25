import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  StatusBar,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { groupService, GroupServiceError } from '../services/groupService';
import { getErrorMessage } from '../utils/errors';
import { Group, Invitation } from '../types/group';
import { colors, spacing, typography, commonStyles } from '../styles/theme';

interface HomeScreenProps {
  onGroupPress: (groupId: string) => void;
  onNavigateToProfile: () => void;
}

export default function HomeScreen({ onGroupPress, onNavigateToProfile }: HomeScreenProps) {
  const { username, displayName, signOut } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const userGroups = await groupService.getGroups();
      setGroups(userGroups);
    } catch (error: any) {
      const errorMessage = error instanceof GroupServiceError 
        ? error.appError.userMessage 
        : getErrorMessage(error);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    try {
      const pendingInvitations = await groupService.getPendingInvitations();
      setInvitations(pendingInvitations);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoadingInvitations(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
    loadInvitations();
  }, [loadGroups, loadInvitations]);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setCreating(true);
    try {
      await groupService.createGroup(groupName.trim(), groupDescription.trim() || undefined);
      setModalVisible(false);
      setGroupName('');
      setGroupDescription('');
      await loadGroups();
    } catch (error: any) {
      const errorMessage = error instanceof GroupServiceError 
        ? error.appError.userMessage 
        : getErrorMessage(error);
      Alert.alert('Error', errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: number) => {
    try {
      await groupService.acceptInvitation(invitationId);
      Alert.alert('Success', 'Invitation accepted! You can now view the group.');
      await loadInvitations();
      await loadGroups();
    } catch (error: any) {
      const errorMessage = error instanceof GroupServiceError 
        ? error.appError.userMessage 
        : getErrorMessage(error);
      Alert.alert('Error', errorMessage);
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
              const errorMessage = error instanceof GroupServiceError 
                ? error.appError.userMessage 
                : getErrorMessage(error);
              Alert.alert('Error', errorMessage);
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

  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={commonStyles.card}
      onPress={() => onGroupPress(item.id.toString())}
      activeOpacity={0.7}
    >
      <View style={styles.groupContent}>
        <Text style={styles.groupName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.groupDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <Text style={styles.groupDate}>
          Created {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderInvitationItem = ({ item }: { item: Invitation }) => (
    <View key={item.id} style={commonStyles.card}>
      <View style={styles.invitationContent}>
        <Text style={styles.invitationGroupName}>{item.group_name}</Text>
        <Text style={styles.invitationText}>
          Invited by {item.inviter_display_name} (@{item.inviter_username})
        </Text>
      </View>
      <View style={styles.invitationActions}>
        <TouchableOpacity
          style={[styles.acceptButton, { marginRight: spacing.sm }]}
          onPress={() => handleAcceptInvitation(item.id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleRejectInvitation(item.id)}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const paddingTop = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

  if (loading && groups.length === 0) {
    return (
      <View style={[commonStyles.container, { paddingTop }]}>
        <View style={commonStyles.header}>
          <TouchableOpacity style={styles.userButton} onPress={() => setMenuVisible(true)}>
            <View style={styles.userIcon}>
              <Text style={styles.userIconText}>
                {(displayName || username || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>My Groups</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[commonStyles.container, { paddingTop }]}>
      <View style={commonStyles.header}>
        <TouchableOpacity style={styles.userButton} onPress={() => setMenuVisible(true)}>
          <View style={styles.userIcon}>
            <Text style={styles.userIconText}>
              {(displayName || username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>My Groups</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {invitations.length > 0 && (
        <View style={styles.invitationsSection}>
          <Text style={styles.sectionTitle}>Pending Invitations</Text>
          {loadingInvitations ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={invitations}
              renderItem={renderInvitationItem}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.invitationsList}
            />
          )}
        </View>
      )}

      {groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No groups yet</Text>
          <Text style={styles.emptySubtext}>Create your first group to get started</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshing={loading || loadingInvitations}
          onRefresh={async () => {
            await Promise.all([loadGroups(), loadInvitations()]);
          }}
        />
      )}

      {/* Profile Menu Modal */}
      <Modal
        visible={menuVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={styles.menuOverlayTouchable}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />
          <View style={styles.menuContent}>
            <View style={styles.profileInfo}>
              <View style={styles.profileIconLarge}>
                <Text style={styles.profileIconLargeText}>
                  {(displayName || username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.profileName}>{displayName || username || 'User'}</Text>
              {username && (
                <Text style={styles.profileUsername}>@{username}</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                onNavigateToProfile();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemText}>Edit Profile</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                handleSignOut();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuItemText, styles.signOutText]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={commonStyles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.createGroupModalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconContainer}>
                  <Text style={styles.modalIcon}>🎁</Text>
                </View>
                <Text style={styles.modalTitle}>Create New Group</Text>
                <Text style={styles.modalSubtitle}>Start organizing your Secret Santa exchange</Text>
              </View>

              <View style={styles.modalForm}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Group Name</Text>
                  <TextInput
                    style={commonStyles.input}
                    placeholder="Enter group name..."
                    value={groupName}
                    onChangeText={setGroupName}
                    autoCapitalize="words"
                    editable={!creating}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Description <Text style={styles.optionalLabel}>(optional)</Text></Text>
                  <TextInput
                    style={[commonStyles.input, styles.textArea]}
                    placeholder="Add a description for your group..."
                    value={groupDescription}
                    onChangeText={setGroupDescription}
                    multiline
                    numberOfLines={4}
                    autoCapitalize="sentences"
                    editable={!creating}
                    textAlignVertical="top"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[commonStyles.button, styles.cancelButton]}
                  onPress={() => {
                    setModalVisible(false);
                    setGroupName('');
                    setGroupDescription('');
                  }}
                  disabled={creating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[commonStyles.button, creating && styles.buttonDisabled]}
                  onPress={handleCreateGroup}
                  disabled={creating || !groupName.trim()}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={commonStyles.buttonText}>Create Group</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  userButton: {
    padding: spacing.xs,
  },
  userIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userIconText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs * 1.5,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    ...typography.bodySmall,
    fontWeight: '600',
  },
  invitationsSection: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    color: colors.text,
  },
  loader: {
    marginVertical: spacing.xl,
  },
  invitationsList: {
    paddingRight: spacing.lg,
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
  list: {
    padding: spacing.lg,
  },
  groupContent: {
    flex: 1,
  },
  groupName: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  groupDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  groupDate: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl * 2,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  createGroupModalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: spacing.xxl,
    width: '95%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalIcon: {
    fontSize: 32,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalForm: {
    marginBottom: spacing.xxl,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  optionalLabel: {
    fontWeight: '400',
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
  },
  cancelButtonText: {
    color: colors.text,
    ...typography.body,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  menuContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.xxl,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileIconLargeText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
  },
  profileName: {
    ...typography.h3,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  profileUsername: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  menuItemText: {
    ...typography.body,
    fontSize: 16,
    color: colors.text,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  signOutText: {
    color: colors.danger,
  },
  textArea: {
    minHeight: 100,
  },
});
