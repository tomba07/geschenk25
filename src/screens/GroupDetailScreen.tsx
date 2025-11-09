import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { groupService } from '../services/groupService';
import { Group, Assignment } from '../types/group';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import { colors, spacing, typography, commonStyles } from '../styles/theme';

interface GroupDetailScreenProps {
  groupId: string;
  onBack: () => void;
}

interface SearchUser {
  id: number;
  username: string;
  display_name: string;
}

export default function GroupDetailScreen({ groupId, onBack }: GroupDetailScreenProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [deletingAssignments, setDeletingAssignments] = useState(false);
  const { userId } = useAuth();

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    setLoading(true);
    try {
      const groupData = await groupService.getGroupById(groupId);
      setGroup(groupData);
      
      // Load assignment if user is a member
      if (groupData && userId) {
        const isOwner = userId === groupData.created_by;
        const isMember = isOwner || groupData.members?.some(m => m.id === userId);
        if (isMember) {
          const assignmentData = await groupService.getAssignment(groupId);
          setAssignment(assignmentData);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load group');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!group) return;

    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.name}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupService.deleteGroup(groupId);
              onBack();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete group');
            }
          },
        },
      ]
    );
  };

  const searchUsers = useCallback(async (query: string) => {
    // Strip "@" prefix if present
    const cleanQuery = query.trim().startsWith('@') 
      ? query.trim().substring(1).trim() 
      : query.trim();
    
    if (cleanQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await apiClient.searchUsers(cleanQuery);
      if (response.error) {
        console.error('Error searching users:', response.error);
        setSearchResults([]);
      } else {
        // Filter out current user and existing members
        const memberIds = new Set(group?.members?.map(m => m.id) || []);
        const ownerId = group?.created_by;
        const filtered = (response.data?.users || []).filter(
          (user) => user.id !== userId && user.id !== ownerId && !memberIds.has(user.id)
        );
        setSearchResults(filtered);
      }
    } catch (error: any) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [group, userId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (inviteModalVisible) {
        searchUsers(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, inviteModalVisible, searchUsers]);

  const handleInvite = async (username: string) => {
    setInviting(true);
    try {
      await groupService.inviteUser(groupId, username);
      setInviteModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      Alert.alert('Success', 'Invitation sent successfully');
      await loadGroup();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = (memberId: number, memberUsername: string) => {
    if (!group) return;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberUsername} from this group?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupService.removeMember(groupId, memberId);
              await loadGroup();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleAssignSecretSanta = () => {
    if (!group) return;

    const totalMembers = (group.members?.length || 0) + 1; // +1 for owner
    if (totalMembers < 2) {
      Alert.alert('Error', 'Need at least 2 members to create Secret Santa assignments');
      return;
    }

    Alert.alert(
      'Assign Secret Santa',
      `This will randomly assign each member to another member. Existing assignments will be replaced. Continue?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Assign',
          onPress: async () => {
            setAssigning(true);
            try {
              await groupService.assignSecretSanta(groupId);
              Alert.alert('Success', 'Secret Santa assignments created successfully!');
              await loadGroup();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to create assignments');
            } finally {
              setAssigning(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAssignments = () => {
    if (!group) return;

    Alert.alert(
      'Undo Assignments',
      'Are you sure you want to undo all Secret Santa assignments? This will allow you to edit members again.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            setDeletingAssignments(true);
            try {
              await groupService.deleteAssignments(groupId);
              Alert.alert('Success', 'Assignments undone successfully!');
              await loadGroup();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to undo assignments');
            } finally {
              setDeletingAssignments(false);
            }
          },
        },
      ]
    );
  };

  // Check if assignments exist (if current user has an assignment, assignments have been made)
  const hasAssignments = assignment !== null;

  const paddingTop = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

  if (loading) {
    return (
      <View style={[commonStyles.container, { paddingTop }]}>
        <View style={commonStyles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Group Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[commonStyles.container, { paddingTop }]}>
        <View style={commonStyles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Group Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Group not found</Text>
          <TouchableOpacity style={commonStyles.button} onPress={onBack}>
            <Text style={commonStyles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isOwner = userId !== null && userId === group.created_by;
  const isMember = userId !== null && (isOwner || group.members?.some(m => m.id === userId));

  return (
    <View style={[commonStyles.container, { paddingTop }]}>
      <View style={commonStyles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Group Details</Text>
        {isOwner ? (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.groupName}>{group.name}</Text>
          
          {group.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{group.description}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Created</Text>
            <Text style={styles.sectionText}>
              {new Date(group.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Owner</Text>
            <Text style={styles.sectionText}>
              {group.owner?.display_name || group.owner?.username || 'Unknown'}
            </Text>
          </View>

          {isOwner && (
            <View style={styles.section}>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>You are the owner</Text>
              </View>
            </View>
          )}

          {isMember && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Secret Santa</Text>
                {isOwner && (
                  <View style={styles.assignButtonContainer}>
                    {hasAssignments ? (
                      <TouchableOpacity
                        style={[styles.undoButton, deletingAssignments && styles.assignButtonDisabled]}
                        onPress={handleDeleteAssignments}
                        disabled={deletingAssignments}
                      >
                        {deletingAssignments ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.undoButtonText}>Undo</Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.assignButton, assigning && styles.assignButtonDisabled]}
                        onPress={handleAssignSecretSanta}
                        disabled={assigning}
                      >
                        {assigning ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.assignButtonText}>Assign</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
              
              {assignment ? (
                <View style={styles.assignmentCard}>
                  <Text style={styles.assignmentLabel}>You are assigned to:</Text>
                  <Text style={styles.assignmentName}>{assignment.receiver_display_name}</Text>
                  <Text style={styles.assignmentHint}>@{assignment.receiver_username} 🎁 Get a gift for this person!</Text>
                </View>
              ) : (
                <View style={styles.noAssignmentCard}>
                  <Text style={styles.noAssignmentText}>
                    {isOwner 
                      ? 'No assignments yet. Click "Assign" to create Secret Santa pairs.'
                      : 'No assignments yet. The group owner needs to create assignments.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {isMember && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Members</Text>
                {isOwner && !hasAssignments && (
                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={() => setInviteModalVisible(true)}
                  >
                    <Text style={styles.inviteButtonText}>+ Invite</Text>
                  </TouchableOpacity>
                )}
                {isOwner && hasAssignments && (
                  <Text style={styles.disabledHint}>Undo assignments to edit members</Text>
                )}
              </View>
              
              {group.members && group.members.length > 0 ? (
                <View style={styles.membersList}>
                  {group.members.map((member) => {
                    const isMemberOwner = member.id === group.created_by;
                    return (
                      <View key={member.id} style={styles.memberItem}>
                        <View style={styles.memberInfo}>
                          <View style={styles.memberNameRow}>
                            <Text style={styles.memberUsername}>{member.display_name}</Text>
                            {isMemberOwner && (
                              <View style={styles.ownerBadge}>
                                <Text style={styles.ownerBadgeText}>Owner</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.memberUsernameSecondary}>@{member.username}</Text>
                          <Text style={styles.memberDate}>
                            {isMemberOwner ? 'Created' : 'Joined'} {new Date(member.joined_at).toLocaleDateString()}
                          </Text>
                        </View>
                        {isOwner && member.id !== userId && !isMemberOwner && !hasAssignments && (
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleRemoveMember(member.id, member.username)}
                          >
                            <Text style={styles.removeButtonText}>Remove</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyText}>No members yet</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setInviteModalVisible(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
      >
        <View style={commonStyles.modalOverlay}>
          <View style={commonStyles.modalContent}>
            <Text style={styles.modalTitle}>Invite User</Text>

            <TextInput
              style={commonStyles.input}
              placeholder="Search for a user (e.g., @username or username)..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
            />

            {searching && (
              <View style={styles.searchLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}

            {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
              <Text style={styles.noResultsText}>No users found</Text>
            )}

            {searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => handleInvite(item.username)}
                      disabled={inviting}
                    >
                      <View>
                        <Text style={styles.searchResultUsername}>{item.display_name}</Text>
                        <Text style={styles.searchResultUsernameSecondary}>@{item.username}</Text>
                      </View>
                      {inviting && (
                        <ActivityIndicator size="small" color={colors.primary} style={styles.inviteLoader} />
                      )}
                    </TouchableOpacity>
                  )}
                  style={styles.searchResultsList}
                />
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setInviteModalVisible(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                disabled={inviting}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    padding: spacing.xl,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
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
  deleteButton: {
    padding: spacing.sm,
  },
  deleteButtonText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
  },
  groupName: {
    ...typography.h1,
    marginBottom: spacing.xxl,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionText: {
    ...typography.body,
    color: colors.text,
  },
  description: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  badgeContainer: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs * 1.5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    ...typography.bodySmall,
    fontWeight: '600',
  },
  errorText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  inviteButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs * 1.5,
    borderRadius: 8,
  },
  inviteButtonText: {
    color: '#fff',
    ...typography.bodySmall,
    fontWeight: '600',
  },
  membersList: {
    marginTop: spacing.sm,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  memberUsername: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.sm,
  },
  memberUsernameSecondary: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  ownerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  memberDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs * 1.5,
  },
  removeButtonText: {
    color: colors.danger,
    ...typography.bodySmall,
    fontWeight: '600',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.xl,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  modalButton: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    ...typography.body,
    fontWeight: '600',
  },
  searchLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  searchResultsContainer: {
    maxHeight: 300,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  searchResultUsername: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  searchResultUsernameSecondary: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  inviteLoader: {
    marginLeft: spacing.sm,
  },
  noResultsText: {
    paddingVertical: spacing.md,
    textAlign: 'center',
    color: colors.textTertiary,
    ...typography.bodySmall,
    fontStyle: 'italic',
  },
  assignButtonContainer: {
    flexDirection: 'row',
  },
  assignButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  assignButtonDisabled: {
    opacity: 0.6,
  },
  assignButtonText: {
    color: '#fff',
    ...typography.bodySmall,
    fontWeight: '600',
  },
  undoButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  undoButtonText: {
    color: '#fff',
    ...typography.bodySmall,
    fontWeight: '600',
  },
  disabledHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  assignmentCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: spacing.xl,
    marginTop: spacing.md,
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
  },
  assignmentLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  assignmentName: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  assignmentHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  noAssignmentCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noAssignmentText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
