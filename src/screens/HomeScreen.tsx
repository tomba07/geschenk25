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
  Image,
  InteractionManager,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../context/AuthContext';
import { groupService, GroupServiceError } from '../services/groupService';
import { getErrorMessage } from '../utils/errors';
import { confirmDestructive } from '../utils/confirm';
import { Group, Invitation } from '../types/group';
import { colors, spacing, typography, commonStyles } from '../styles/theme';

interface HomeScreenProps {
  onGroupPress: (groupId: string) => void;
  onNavigateToProfile: () => void;
}

export default function HomeScreen({ onGroupPress, onNavigateToProfile }: HomeScreenProps) {
  const { username, displayName, imageUrl, signOut } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupImage, setGroupImage] = useState<string | null>(null);
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

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need access to your photos to upload a group image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setGroupImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRemoveImage = () => {
    setGroupImage(null);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setCreating(true);
    try {
      let imageBase64: string | undefined;
      if (groupImage) {
        try {
          // Read file as base64 string using legacy API
          const base64 = await FileSystem.readAsStringAsync(groupImage, {
            encoding: FileSystem.EncodingType.Base64,
          });
          imageBase64 = `data:image/jpeg;base64,${base64}`;
        } catch (error) {
          console.error('Error converting image to base64:', error);
          Alert.alert('Error', 'Failed to process image. Please try again.');
          setCreating(false);
          return;
        }
      }

      await groupService.createGroup(
        groupName.trim(), 
        groupDescription.trim() || undefined,
        imageBase64
      );
      setModalVisible(false);
      // Delay state cleanup and data reload to avoid race condition with modal dismissal
      InteractionManager.runAfterInteractions(() => {
        setGroupName('');
        setGroupDescription('');
        setGroupImage(null);
        loadGroups();
      });
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
    confirmDestructive(
      'Sign Out',
      'Are you sure you want to sign out?',
      'Sign Out',
      async () => {
        await signOut();
      }
    );
  };

  const renderGroupItem = ({ item }: { item: Group }) => {
    // Use member_count from API if available, otherwise fall back to members array length
    const memberCount = item.member_count ?? (item.members ? item.members.length : null);
    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => onGroupPress(item.id.toString())}
        activeOpacity={0.7}
      >
        <View style={styles.groupCardContent}>
          <View style={styles.groupCardHeader}>
            <View style={styles.groupIconContainer}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.groupImage} />
              ) : (
                <Text style={styles.groupIcon}>🎁</Text>
              )}
            </View>
            <View style={styles.groupCardInfo}>
              <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
              {item.description && (
                <Text style={styles.groupDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <View style={styles.groupMeta}>
                {memberCount !== null && (
                  <>
                    <Text style={styles.groupMemberCount}>{memberCount} {memberCount === 1 ? 'member' : 'members'}</Text>
                    <Text style={styles.groupMetaDot}>•</Text>
                  </>
                )}
                <Text style={styles.groupDate}>
                  {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderInvitationItem = ({ item }: { item: Invitation }) => (
    <View key={item.id} style={styles.invitationCard}>
      <View style={styles.invitationCardContent}>
        <View style={styles.invitationHeader}>
          <View style={styles.invitationIconContainer}>
            <Text style={styles.invitationIcon}>📬</Text>
          </View>
          <View style={styles.invitationInfo}>
            <Text style={styles.invitationGroupName} numberOfLines={1}>{item.group_name}</Text>
            <Text style={styles.invitationText} numberOfLines={1}>
              from {item.inviter_display_name}
            </Text>
          </View>
        </View>
        <View style={styles.invitationActions}>
          <TouchableOpacity
            style={styles.acceptButton}
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
    </View>
  );

  const paddingTop = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

  if (loading && groups.length === 0) {
    return (
      <View style={[commonStyles.container, { paddingTop }]}>
        <View style={commonStyles.header}>
          <TouchableOpacity style={styles.userButton} onPress={() => setMenuVisible(true)}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.userIcon} />
            ) : (
              <View style={styles.userIcon}>
                <Text style={styles.userIconText}>
                  {(displayName || username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
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
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.userIcon} />
          ) : (
            <View style={styles.userIcon}>
              <Text style={styles.userIconText}>
                {(displayName || username || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Invitations</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{invitations.length}</Text>
            </View>
          </View>
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
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>🎁</Text>
          </View>
          <Text style={styles.emptyText}>No groups yet</Text>
          <Text style={styles.emptySubtext}>Create your first group to start organizing your Secret Santa exchange</Text>
          <TouchableOpacity
            style={styles.emptyCreateButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.emptyCreateButtonText}>Create Your First Group</Text>
          </TouchableOpacity>
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
        onRequestClose={() => {
          if (menuVisible) {
            setMenuVisible(false);
          }
        }}
      >
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            style={styles.menuOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              if (menuVisible) {
                setMenuVisible(false);
              }
            }}
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
        onRequestClose={() => {
          if (modalVisible) {
            setModalVisible(false);
            // Delay state cleanup to avoid race condition with modal dismissal
            InteractionManager.runAfterInteractions(() => {
              setGroupName('');
              setGroupDescription('');
              setGroupImage(null);
            });
          }
        }}
      >
        <KeyboardAvoidingView
          style={commonStyles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              if (modalVisible) {
                setModalVisible(false);
                // Delay state cleanup to avoid race condition with modal dismissal
                InteractionManager.runAfterInteractions(() => {
                  setGroupName('');
                  setGroupDescription('');
                  setGroupImage(null);
                });
              }
            }}
          />
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.createGroupModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Group</Text>
                <Text style={styles.modalSubtitle}>Start organizing your Secret Santa exchange</Text>
              </View>

              <View style={styles.modalForm}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Group Image <Text style={styles.optionalLabel}>(optional)</Text></Text>
                  {groupImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: groupImage }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={handleRemoveImage}
                        disabled={creating}
                      >
                        <Text style={styles.removeImageButtonText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.imagePickerButton}
                      onPress={handlePickImage}
                      disabled={creating}
                    >
                      <Text style={styles.imagePickerButtonText}>📷 Choose Image</Text>
                    </TouchableOpacity>
                  )}
                </View>

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
                    if (modalVisible) {
                      setModalVisible(false);
                      // Delay state cleanup to avoid race condition with modal dismissal
                      InteractionManager.runAfterInteractions(() => {
                        setGroupName('');
                        setGroupDescription('');
                        setGroupImage(null);
                      });
                    }
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
    overflow: 'hidden',
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
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
    color: colors.text,
    marginRight: spacing.sm,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    marginVertical: spacing.xl,
  },
  invitationsList: {
    paddingRight: spacing.lg,
  },
  invitationCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: 280,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  invitationCardContent: {
    padding: spacing.lg,
  },
  invitationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  invitationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  invitationIcon: {
    fontSize: 20,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationGroupName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  invitationText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
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
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rejectButtonText: {
    color: colors.textSecondary,
    ...typography.bodySmall,
    fontWeight: '600',
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  groupCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  groupCardContent: {
    flex: 1,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  groupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupIcon: {
    fontSize: 24,
  },
  groupImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  groupCardInfo: {
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
    lineHeight: 20,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupMemberCount: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  groupMetaDot: {
    ...typography.caption,
    color: colors.textTertiary,
    marginHorizontal: spacing.xs,
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
  emptyIconContainer: {
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
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    ...typography.h2,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  emptyCreateButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  emptyCreateButtonText: {
    color: '#fff',
    ...typography.body,
    fontWeight: '600',
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
  imagePickerButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  imagePickerButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  imagePreviewContainer: {
    alignItems: 'center',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  removeImageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  removeImageButtonText: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '600',
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
