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
  RefreshControl,
  KeyboardAvoidingView,
  Linking,
  Image,
  Share,
  InteractionManager,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { groupService, GroupServiceError } from '../services/groupService';
import { Group, Assignment, GiftIdea } from '../types/group';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import { colors, spacing, typography, commonStyles } from '../styles/theme';
import { getErrorMessage } from '../utils/errors';

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
  const [refreshing, setRefreshing] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loadingInviteLink, setLoadingInviteLink] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [deletingAssignments, setDeletingAssignments] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [updatingImage, setUpdatingImage] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [giftIdeas, setGiftIdeas] = useState<GiftIdea[]>([]);
  const [giftIdeaModalVisible, setGiftIdeaModalVisible] = useState(false);
  const [assignedPersonGiftIdeasModalVisible, setAssignedPersonGiftIdeasModalVisible] = useState(false);
  const [assignedPersonGiftIdeas, setAssignedPersonGiftIdeas] = useState<GiftIdea[]>([]);
  const [loadingAssignedPersonGiftIdeas, setLoadingAssignedPersonGiftIdeas] = useState(false);
  const [editingGiftIdea, setEditingGiftIdea] = useState<GiftIdea | null>(null);
  const [giftIdeaText, setGiftIdeaText] = useState('');
  const [giftIdeaLink, setGiftIdeaLink] = useState('');
  const [selectedForUserId, setSelectedForUserId] = useState<number | null>(null);
  const [savingGiftIdea, setSavingGiftIdea] = useState(false);
  const [deletingGiftIdea, setDeletingGiftIdea] = useState<number | null>(null);
  const { userId } = useAuth();

  const loadGroup = useCallback(async (showLoading = true) => {
    if (showLoading) {
    setLoading(true);
    }
    try {
      const groupData = await groupService.getGroupById(groupId);
      console.log('Group data loaded:', groupData);
      console.log('Pending invitations:', groupData?.pending_invitations);
      setGroup(groupData);
      
          // Load assignment and gift ideas if user is a member
      if (groupData && userId) {
        const isOwner = userId === groupData.created_by;
        const isMember = isOwner || groupData.members?.some(m => m.id === userId);
        if (isMember) {
          const assignmentData = await groupService.getAssignment(groupId);
          setAssignment(assignmentData);
          
          // Load only gift ideas created by the current user
          const ideas = await groupService.getGiftIdeas(groupId);
          const myIdeas = ideas.filter(idea => idea.created_by_id === userId);
          setGiftIdeas(myIdeas);
        }
      }
    } catch (error: any) {
      if (showLoading) {
        const errorMessage = error instanceof GroupServiceError 
          ? error.appError.userMessage 
          : getErrorMessage(error);
        Alert.alert('Error', errorMessage);
      onBack();
      }
    } finally {
      if (showLoading) {
      setLoading(false);
    }
    }
  }, [groupId, userId, onBack]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGroup(false);
    setRefreshing(false);
  }, [loadGroup]);

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
        setEditingImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRemoveImage = () => {
    if (group?.image_url) {
      // If there's an existing image, set editingImage to empty string to indicate removal
      setEditingImage('');
    } else {
      // If no existing image, just clear the selection
      setEditingImage(null);
    }
  };

  const handleSaveImage = async () => {
    if (!group) return;

    setUpdatingImage(true);
    try {
      let imageBase64: string | undefined;
      if (editingImage) {
        try {
          const base64 = await FileSystem.readAsStringAsync(editingImage, {
            encoding: FileSystem.EncodingType.Base64,
          });
          imageBase64 = `data:image/jpeg;base64,${base64}`;
        } catch (error) {
          console.error('Error converting image to base64:', error);
          Alert.alert('Error', 'Failed to process image. Please try again.');
          setUpdatingImage(false);
          return;
        }
      }

      const updatedGroup = await groupService.updateGroup(groupId, imageBase64);
      setGroup(updatedGroup);
      setEditingImage(null);
    } catch (error: any) {
      const errorMessage = error instanceof GroupServiceError 
        ? error.appError.userMessage 
        : getErrorMessage(error);
      Alert.alert('Error', errorMessage);
    } finally {
      setUpdatingImage(false);
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
            setDeleting(true);
            try {
              await groupService.deleteGroup(groupId);
              setDetailsModalVisible(false);
              onBack();
            } catch (error: any) {
              const errorMessage = error instanceof GroupServiceError 
                ? error.appError.userMessage 
                : getErrorMessage(error);
              Alert.alert('Error', errorMessage);
            } finally {
              setDeleting(false);
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
      // Delay loadGroup to avoid race condition with modal dismissal
      InteractionManager.runAfterInteractions(() => {
        loadGroup();
      });
    } catch (error: any) {
      const errorMessage = error instanceof GroupServiceError 
        ? error.appError.userMessage 
        : getErrorMessage(error);
      Alert.alert('Error', errorMessage);
    } finally {
      setInviting(false);
    }
  };

  const handleGetInviteLink = async () => {
    if (inviteLink) return; // Already loaded
    
    setLoadingInviteLink(true);
    try {
      const response = await apiClient.getInviteLink(parseInt(groupId));
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        const token = response.data.invite_token;
        const link = `geschenk25://join/${token}`;
        setInviteLink(link);
      }
    } catch (error: any) {
      console.error('Error getting invite link:', error);
    } finally {
      setLoadingInviteLink(false);
    }
  };

  const handleShareInviteLink = async () => {
    if (!inviteLink || !group) return;
    
    try {
      await Share.share({
        message: `Join my Secret Santa group "${group.name}"! ${inviteLink}`,
        url: inviteLink,
      });
    } catch (error: any) {
      console.error('Error sharing invite link:', error);
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

  const handleCancelInvitation = (invitationId: number, username: string) => {
    if (!group) return;

    Alert.alert(
      'Remove Invitation',
      `Are you sure you want to remove the invitation for ${username}?`,
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
              await groupService.cancelInvitation(groupId, invitationId);
              await loadGroup();
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

  const handleAssignSecretSanta = () => {
    if (!group) return;

    const totalMembers = (group.members?.length || 0) + 1; // +1 for owner
    if (totalMembers < 2) {
      Alert.alert('Error', 'Need at least 2 members to create Secret Santa assignments');
      return;
    }

    const pendingCount = group.pending_invitations?.length || 0;
    let message = 'This will randomly assign each member to another member.';
    
    if (pendingCount > 0) {
      message += `\n\n⚠️ ${pendingCount} pending invitation${pendingCount === 1 ? '' : 's'} will not be included.`;
    }

    Alert.alert(
      'Assign Secret Santa',
      message,
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
              await loadGroup();
            } catch (error: any) {
              const errorMessage = error instanceof GroupServiceError 
                ? error.appError.userMessage 
                : getErrorMessage(error);
              Alert.alert('Error', errorMessage);
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
              await loadGroup();
            } catch (error: any) {
              const errorMessage = error instanceof GroupServiceError 
                ? error.appError.userMessage 
                : getErrorMessage(error);
              Alert.alert('Error', errorMessage);
            } finally {
              setDeletingAssignments(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenGiftIdeaModal = (forUserId?: number, giftIdea?: GiftIdea) => {
    if (giftIdea) {
      setEditingGiftIdea(giftIdea);
      setGiftIdeaText(giftIdea.idea);
      setGiftIdeaLink(giftIdea.link || '');
      setSelectedForUserId(giftIdea.for_user_id);
    } else {
      setEditingGiftIdea(null);
      setGiftIdeaText('');
      setGiftIdeaLink('');
      // Preselect current user if no forUserId is provided
      setSelectedForUserId(forUserId || userId || null);
    }
    setGiftIdeaModalVisible(true);
  };

  const handleCloseGiftIdeaModal = () => {
    setGiftIdeaModalVisible(false);
    setEditingGiftIdea(null);
    setGiftIdeaText('');
    setGiftIdeaLink('');
    setSelectedForUserId(null);
  };

  const handleSaveGiftIdea = async () => {
    if (!group || !selectedForUserId || !giftIdeaText.trim()) {
      Alert.alert('Error', 'Please select a person and enter a gift idea');
      return;
    }

    setSavingGiftIdea(true);
    try {
      const linkValue = giftIdeaLink.trim() || undefined;
      if (editingGiftIdea) {
        await groupService.updateGiftIdea(groupId, editingGiftIdea.id, giftIdeaText.trim(), linkValue);
      } else {
        await groupService.createGiftIdea(groupId, selectedForUserId, giftIdeaText.trim(), linkValue);
      }
      handleCloseGiftIdeaModal();
      // Delay loadGroup to avoid race condition with modal dismissal
      InteractionManager.runAfterInteractions(() => {
        loadGroup();
      });
    } catch (error: any) {
      const errorMessage = error instanceof GroupServiceError 
        ? error.appError.userMessage 
        : getErrorMessage(error);
      Alert.alert('Error', errorMessage);
    } finally {
      setSavingGiftIdea(false);
    }
  };

  const handleDeleteGiftIdea = (ideaId: number) => {
    Alert.alert(
      'Delete Gift Idea',
      'Are you sure you want to delete this gift idea?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingGiftIdea(ideaId);
            try {
              await groupService.deleteGiftIdea(groupId, ideaId);
              await loadGroup();
            } catch (error: any) {
              const errorMessage = error instanceof GroupServiceError 
                ? error.appError.userMessage 
                : getErrorMessage(error);
              Alert.alert('Error', errorMessage);
            } finally {
              setDeletingGiftIdea(null);
            }
          },
        },
      ]
    );
  };

  const handleOpenAssignedPersonGiftIdeas = async () => {
    if (!assignment) return;
    
    setAssignedPersonGiftIdeasModalVisible(true);
    setLoadingAssignedPersonGiftIdeas(true);
    try {
      const ideas = await groupService.getGiftIdeas(groupId, assignment.receiver_id);
      setAssignedPersonGiftIdeas(ideas);
    } catch (error: any) {
      const errorMessage = error instanceof GroupServiceError 
        ? error.appError.userMessage 
        : getErrorMessage(error);
      Alert.alert('Error', errorMessage);
      setAssignedPersonGiftIdeasModalVisible(false);
    } finally {
      setLoadingAssignedPersonGiftIdeas(false);
    }
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
        <View style={styles.headerTitleContainer}>
          {group.image_url ? (
            <Image source={{ uri: group.image_url }} style={styles.headerImage} />
          ) : (
            <Text style={styles.headerIcon}>🎁</Text>
          )}
          <Text style={styles.title}>{group.name}</Text>
        </View>
        <TouchableOpacity style={styles.infoButton} onPress={() => {
          setEditingImage(group?.image_url || null);
          setDetailsModalVisible(true);
        }}>
          <Text style={styles.infoButtonText}>Details</Text>
          </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {group.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.groupDescription}>{group.description}</Text>
            </View>
          )}

          {isMember && (
          <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Assignments</Text>
        {isOwner && (
                  <View style={styles.assignButtonContainer}>
                    {!hasAssignments && (
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
                  <View style={styles.assignmentCardHeader}>
                    {assignment.receiver_image_url ? (
                      <Image source={{ uri: assignment.receiver_image_url }} style={styles.assignmentIconContainer} />
                    ) : (
                      <View style={styles.assignmentIconContainer}>
                        <Text style={styles.assignmentIcon}>
                          {assignment.receiver_display_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.assignmentInfo}>
                      <Text style={styles.assignmentLabel}>You are assigned to</Text>
                      <Text style={styles.assignmentName}>{assignment.receiver_display_name}</Text>
                      <Text style={styles.assignmentUsername}>@{assignment.receiver_username}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewGiftIdeasButton}
                    onPress={handleOpenAssignedPersonGiftIdeas}
                  >
                    <Text style={styles.viewGiftIdeasButtonText}>View Gift Ideas</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.noAssignmentCard}>
                  <Text style={styles.noAssignmentIcon}>🎁</Text>
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
                <Text style={styles.sectionTitle}>My Gift Ideas</Text>
                <TouchableOpacity
                  style={styles.addGiftIdeaButton}
                  onPress={() => handleOpenGiftIdeaModal()}
                >
                  <Text style={styles.addGiftIdeaButtonText}>+ Add Idea</Text>
                </TouchableOpacity>
              </View>

              {giftIdeas.length > 0 ? (
                <View style={styles.giftIdeasList}>
                  {giftIdeas.map((idea) => {
                    return (
                      <View key={idea.id} style={styles.giftIdeaCard}>
                        <View style={styles.giftIdeaContent}>
                          <View style={styles.giftIdeaMainContent}>
                            <View style={styles.giftIdeaTextContainer}>
                              <Text style={styles.giftIdeaText}>{idea.idea}</Text>
                              {idea.link && (
                                <TouchableOpacity
                                  style={styles.giftIdeaLink}
                                  onPress={() => {
                                    const url = idea.link!.startsWith('http://') || idea.link!.startsWith('https://')
                                      ? idea.link!
                                      : `https://${idea.link!}`;
                                    Linking.openURL(url).catch((err) => {
                                      console.error('Failed to open URL:', err);
                                      Alert.alert('Error', 'Could not open link');
                                    });
                                  }}
                                >
                                  <Text style={styles.giftIdeaLinkText}>🔗 Open Link</Text>
                                </TouchableOpacity>
                              )}
                              <View style={styles.giftIdeaMeta}>
                                <Text style={styles.giftIdeaMetaText}>
                                  For: {idea.for_user.display_name}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.giftIdeaActionButtons}>
                              <TouchableOpacity
                                style={styles.giftIdeaButton}
                                onPress={() => handleOpenGiftIdeaModal(undefined, idea)}
                              >
                                <Text style={styles.giftIdeaButtonText}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.giftIdeaButton}
                                onPress={() => handleDeleteGiftIdea(idea.id)}
                              >
                                <Text style={styles.giftIdeaButtonText}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.noGiftIdeasCard}>
                  <Text style={styles.noGiftIdeasIcon}>💡</Text>
                  <Text style={styles.noGiftIdeasText}>
                    You haven't created any gift ideas yet. Add some ideas for group members!
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
                    onPress={() => {
                      setInviteModalVisible(true);
                      // Load invite link when opening modal
                      handleGetInviteLink();
                    }}
                  >
                    <Text style={styles.inviteButtonText}>+ Invite</Text>
                  </TouchableOpacity>
                )}
                {isOwner && hasAssignments && (
                  <Text style={styles.disabledHint}>Undo assignments to edit members</Text>
                )}
              </View>
              
              {(group.members && group.members.length > 0) || (group.pending_invitations && group.pending_invitations.length > 0) ? (
                <View style={styles.membersList}>
                  {group.members && group.members.map((member) => {
                    const isMemberOwner = member.id === group.created_by;
                    return (
                      <View key={member.id} style={styles.memberCard}>
                        <View style={styles.memberCardContent}>
                          {member.image_url ? (
                            <Image source={{ uri: member.image_url }} style={styles.memberAvatar} />
                          ) : (
                            <View style={styles.memberAvatar}>
                              <Text style={styles.memberAvatarText}>
                                {member.display_name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
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
                          </View>
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
                  {group.pending_invitations && group.pending_invitations.map((invitation) => (
                    <View key={`pending-${invitation.invitation_id}`} style={[styles.memberCard, styles.pendingInvitationCard]}>
                      <View style={styles.memberCardContent}>
                        <View style={[styles.memberAvatar, styles.pendingMemberAvatar]}>
                          <Text style={styles.memberAvatarText}>
                            {invitation.display_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <View style={styles.memberNameRow}>
                            <Text style={styles.memberUsername}>{invitation.display_name}</Text>
                            <View style={styles.pendingBadge}>
                              <Text style={styles.pendingBadgeText}>Pending</Text>
                            </View>
                          </View>
                          <Text style={styles.memberUsernameSecondary}>@{invitation.username}</Text>
                          <Text style={styles.memberDate}>
                            Invited {new Date(invitation.invited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      </View>
                      {isOwner && !hasAssignments && (
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleCancelInvitation(invitation.invitation_id, invitation.username)}
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
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
          if (inviteModalVisible) {
            setInviteModalVisible(false);
            setSearchQuery('');
            setSearchResults([]);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={commonStyles.modalOverlay}
        >
          <View style={commonStyles.modalContent}>
            <Text style={styles.modalTitle}>Invite User</Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Invite Link Section */}
              <View style={styles.inviteLinkSection}>
                <Text style={styles.inviteLinkSectionTitle}>Invite Link</Text>
                <Text style={styles.inviteLinkSectionDescription}>
                  Share this link to invite others to join your group
                </Text>
                {loadingInviteLink ? (
                  <View style={styles.inviteLinkLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : inviteLink ? (
                  <View style={styles.inviteLinkContainer}>
                    <Text style={styles.inviteLinkText} selectable>
                      {inviteLink}
                    </Text>
                  </View>
                ) : null}
                {inviteLink && (
                  <TouchableOpacity
                    style={[commonStyles.button, styles.shareLinkButton]}
                    onPress={handleShareInviteLink}
                  >
                    <Text style={commonStyles.buttonText}>Share Link</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.divider} />

              {/* Search User Section */}
              <View style={styles.searchUserSection}>
                <Text style={styles.searchUserSectionTitle}>Search by Username</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="Search for a user (e.g., @username or username)..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={false}
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
                    {searchResults.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.searchResultItem}
                        onPress={() => handleInvite(item.username)}
                        disabled={inviting}
                      >
                        <View>
                          <Text style={styles.searchResultUsername}>{item.display_name}</Text>
                          <Text style={styles.searchResultUsernameSecondary}>@{item.username}</Text>
                        </View>
                        {inviting && (
                          <ActivityIndicator size="small" color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[commonStyles.button, styles.cancelButton]}
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Group Details Modal */}
      <Modal
        visible={detailsModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          if (detailsModalVisible) {
            setDetailsModalVisible(false);
          }
        }}
      >
        <View style={commonStyles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              setDetailsModalVisible(false);
            }}
          />
          <View style={styles.detailsModalContent}>
            {group && (
              <>
                <Text style={styles.detailsModalTitle}>{group.name}</Text>
                
                {userId !== null && userId === group.created_by && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>Group Image</Text>
                    {editingImage !== null && editingImage !== '' ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image 
                          source={{ uri: editingImage }} 
                          style={styles.detailsImagePreview} 
                        />
                        <View style={styles.imageActions}>
                          <TouchableOpacity
                            style={styles.imageActionButton}
                            onPress={handlePickImage}
                            disabled={updatingImage}
                          >
                            <Text style={styles.imageActionButtonText}>Change</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.imageActionButton, styles.removeImageButton]}
                            onPress={handleRemoveImage}
                            disabled={updatingImage}
                          >
                            <Text style={styles.imageActionButtonText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                        {(editingImage !== (group.image_url || null)) && (
                          <TouchableOpacity
                            style={[commonStyles.button, styles.saveImageButton]}
                            onPress={handleSaveImage}
                            disabled={updatingImage}
                          >
                            {updatingImage ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text style={styles.saveImageButtonText}>Save Image</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : editingImage === '' ? (
                      <View style={styles.imagePreviewContainer}>
                        <View style={[styles.detailsImagePreview, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 40 }}>🎁</Text>
                        </View>
                        <View style={styles.imageActions}>
                          <TouchableOpacity
                            style={styles.imageActionButton}
                            onPress={handlePickImage}
                            disabled={updatingImage}
                          >
                            <Text style={styles.imageActionButtonText}>Choose Image</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          style={[commonStyles.button, styles.saveImageButton]}
                          onPress={handleSaveImage}
                          disabled={updatingImage}
                        >
                          {updatingImage ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.saveImageButtonText}>Save Changes</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : group.image_url ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image 
                          source={{ uri: group.image_url }} 
                          style={styles.detailsImagePreview} 
                        />
                        <View style={styles.imageActions}>
                          <TouchableOpacity
                            style={styles.imageActionButton}
                            onPress={handlePickImage}
                            disabled={updatingImage}
                          >
                            <Text style={styles.imageActionButtonText}>Change</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.imageActionButton, styles.removeImageButton]}
                            onPress={handleRemoveImage}
                            disabled={updatingImage}
                          >
                            <Text style={styles.imageActionButtonText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.imagePickerButton}
                        onPress={handlePickImage}
                        disabled={updatingImage}
                      >
                        <Text style={styles.imagePickerButtonText}>📷 Choose Image</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                
                {group.description && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>Description</Text>
                    <Text style={styles.detailsValue}>{group.description}</Text>
                  </View>
                )}

                <View style={styles.detailsSection}>
                  <Text style={styles.detailsLabel}>Created</Text>
                  <Text style={styles.detailsValue}>
              {new Date(group.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>

                {group.owner && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsLabel}>Owner</Text>
                    <Text style={styles.detailsValue}>
                      {group.owner.display_name || group.owner.username}
                    </Text>
                    <Text style={styles.detailsSubValue}>
                      @{group.owner.username}
                    </Text>
                  </View>
                )}

                {userId !== null && userId === group.created_by && (
                  <View style={styles.detailsSection}>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>You are the owner</Text>
              </View>
            </View>
          )}

                {userId !== null && userId === group.created_by && (
                  <>
                    {hasAssignments && (
                      <View style={styles.detailsActions}>
                        <TouchableOpacity
                          style={[commonStyles.button, styles.undoButtonInModal, deletingAssignments && styles.buttonDisabled]}
                          onPress={handleDeleteAssignments}
                          disabled={deletingAssignments}
                        >
                          {deletingAssignments ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={commonStyles.buttonText}>Undo Assignments</Text>
                          )}
                        </TouchableOpacity>
        </View>
                    )}
                    <View style={styles.detailsActions}>
                      <TouchableOpacity
                        style={styles.deleteButtonInModal}
                        onPress={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.deleteButtonTextInModal}>Delete Group</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[commonStyles.button, styles.cancelButton]}
                  onPress={() => {
                    setEditingImage(null);
                    setDetailsModalVisible(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Assigned Person Gift Ideas Modal */}
      <Modal
        visible={assignedPersonGiftIdeasModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (assignedPersonGiftIdeasModalVisible) {
            setAssignedPersonGiftIdeasModalVisible(false);
          }
        }}
      >
        <View style={commonStyles.modalOverlay}>
          <View style={commonStyles.modalContent}>
            <Text style={styles.modalTitle}>
              Gift Ideas for {assignment?.receiver_display_name}
            </Text>

            {loadingAssignedPersonGiftIdeas ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : assignedPersonGiftIdeas.length > 0 ? (
              <ScrollView style={styles.assignedPersonGiftIdeasList}>
                {assignedPersonGiftIdeas.map((idea) => (
                  <View key={idea.id} style={styles.assignedPersonGiftIdeaCard}>
                    <Text style={styles.assignedPersonGiftIdeaText}>{idea.idea}</Text>
                    {idea.link && (
                      <TouchableOpacity
                        style={styles.assignedPersonGiftIdeaLink}
                        onPress={() => {
                          const url = idea.link!.startsWith('http://') || idea.link!.startsWith('https://')
                            ? idea.link!
                            : `https://${idea.link!}`;
                          Linking.openURL(url).catch((err) => {
                            console.error('Failed to open URL:', err);
                            Alert.alert('Error', 'Could not open link');
                          });
                        }}
                      >
                        <Text style={styles.assignedPersonGiftIdeaLinkText}>🔗 Open Link</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={styles.assignedPersonGiftIdeaCreator}>
                      By: {idea.created_by.display_name}
                    </Text>
                  </View>
                ))}
      </ScrollView>
            ) : (
              <View style={styles.modalEmptyContainer}>
                <Text style={styles.modalEmptyText}>
                  No gift ideas yet for {assignment?.receiver_display_name}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[commonStyles.button, styles.closeModalButton]}
              onPress={() => setAssignedPersonGiftIdeasModalVisible(false)}
            >
              <Text style={commonStyles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Gift Idea Modal */}
      <Modal
        visible={giftIdeaModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (giftIdeaModalVisible) {
            handleCloseGiftIdeaModal();
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={commonStyles.modalOverlay}
        >
          <View style={commonStyles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingGiftIdea ? 'Edit Gift Idea' : 'Add Gift Idea'}
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              {!editingGiftIdea && (
                <View style={styles.giftIdeaPersonSelector}>
                  <Text style={styles.giftIdeaLabel}>For:</Text>
                  {group && group.members && (
                    <View style={styles.memberSelector}>
                      {group.members.map((member) => (
                        <TouchableOpacity
                          key={member.id}
                          style={[
                            styles.memberSelectorOption,
                            selectedForUserId === member.id && styles.memberSelectorOptionSelected,
                          ]}
                          onPress={() => setSelectedForUserId(member.id)}
                        >
                          <Text
                            style={[
                              styles.memberSelectorOptionText,
                              selectedForUserId === member.id && styles.memberSelectorOptionTextSelected,
                            ]}
                          >
                            {member.display_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {editingGiftIdea && selectedForUserId && group && (
                <View style={styles.giftIdeaPersonDisplay}>
                  <Text style={styles.giftIdeaLabel}>
                    For: {group.members?.find(m => m.id === selectedForUserId)?.display_name || 'Unknown'}
                  </Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Gift Idea</Text>
                <TextInput
                  style={[commonStyles.input, styles.giftIdeaTextInput]}
                  placeholder="Enter gift idea..."
                  value={giftIdeaText}
                  onChangeText={setGiftIdeaText}
                  multiline={true}
                  numberOfLines={4}
                  autoFocus={true}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Link <Text style={styles.optionalLabel}>(optional)</Text></Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="https://example.com/product"
                  value={giftIdeaLink}
                  onChangeText={setGiftIdeaLink}
                  autoCapitalize="none"
                  keyboardType="url"
                  autoCorrect={false}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[commonStyles.button, styles.cancelButton]}
                  onPress={handleCloseGiftIdeaModal}
                  disabled={savingGiftIdea}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[commonStyles.button, savingGiftIdea && styles.buttonDisabled]}
                  onPress={handleSaveGiftIdea}
                  disabled={savingGiftIdea || !giftIdeaText.trim() || !selectedForUserId}
                >
                  {savingGiftIdea ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={commonStyles.buttonText}>
                      {editingGiftIdea ? 'Update' : 'Create'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
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
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  headerImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: spacing.xs,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  infoButton: {
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  modalOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  detailsModalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.xxl,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  detailsModalTitle: {
    ...typography.h2,
    marginBottom: spacing.xl,
    color: colors.text,
  },
  detailsSection: {
    marginBottom: spacing.xl,
  },
  imagePreviewContainer: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  detailsImagePreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  imageActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  imageActionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
  },
  removeImageButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  imageActionButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveImageButton: {
    marginTop: spacing.sm,
  },
  saveImageButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  imagePickerButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  imagePickerButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  detailsLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsValue: {
    ...typography.body,
    color: colors.text,
  },
  detailsSubValue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  detailsActions: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  deleteButtonInModal: {
    backgroundColor: colors.danger,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonTextInModal: {
    color: '#fff',
    ...typography.body,
    fontWeight: '600',
  },
  undoButtonInModal: {
    marginBottom: spacing.md,
  },
  closeButton: {
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  descriptionSection: {
    marginBottom: spacing.xxl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupDescription: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
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
  inviteLinkContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteLinkText: {
    ...typography.body,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inviteLinkSection: {
    marginBottom: spacing.xl,
  },
  inviteLinkSectionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inviteLinkSectionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  inviteLinkLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  shareLinkButton: {
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
  },
  searchUserSection: {
    marginBottom: spacing.lg,
  },
  searchUserSectionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  membersList: {
    marginTop: spacing.sm,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pendingInvitationCard: {
    opacity: 0.8,
  },
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  pendingMemberAvatar: {
    backgroundColor: colors.textSecondary,
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
  pendingBadge: {
    backgroundColor: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: spacing.xs,
  },
  pendingBadgeText: {
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
  addGiftIdeaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  addGiftIdeaButtonText: {
    color: '#fff',
    ...typography.bodySmall,
    fontWeight: '600',
  },
  giftIdeaHint: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  giftIdeaHintText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  giftIdeasList: {
    gap: spacing.md,
  },
  giftIdeasSubsection: {
    marginBottom: spacing.xl,
  },
  giftIdeasSubsectionTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  giftIdeaCardHighlighted: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  giftIdeaCard: {
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
  giftIdeaContent: {
    flex: 1,
  },
  giftIdeaMainContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  giftIdeaTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  giftIdeaText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  giftIdeaMeta: {
    flexDirection: 'column',
    gap: spacing.xs / 2,
  },
  giftIdeaMetaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  giftIdeaActionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  giftIdeaButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  giftIdeaButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  noGiftIdeasCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  noGiftIdeasIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  noGiftIdeasText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  giftIdeaPersonSelector: {
    marginBottom: spacing.md,
  },
  giftIdeaLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  memberSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memberSelectorOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberSelectorOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  memberSelectorOptionText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  memberSelectorOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  giftIdeaPersonDisplay: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  giftIdeaTextInput: {
    minHeight: 100,
    textAlignVertical: 'top',
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
  giftIdeaLink: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  giftIdeaLinkText: {
    ...typography.bodySmall,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  viewGiftIdeasButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  viewGiftIdeasButtonText: {
    color: '#fff',
    ...typography.bodySmall,
    fontWeight: '600',
  },
  assignedPersonGiftIdeasList: {
    maxHeight: 400,
    marginBottom: spacing.md,
  },
  assignedPersonGiftIdeaCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assignedPersonGiftIdeaText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  assignedPersonGiftIdeaCreator: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  assignedPersonGiftIdeaLink: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  assignedPersonGiftIdeaLinkText: {
    ...typography.bodySmall,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  modalLoadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  modalEmptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  modalEmptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  closeModalButton: {
    marginTop: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.xl,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
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
  cancelButtonText: {
    color: colors.text,
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
  assignmentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  assignmentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  assignmentIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  assignmentName: {
    ...typography.h3,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  assignmentUsername: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  noAssignmentCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  noAssignmentIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  noAssignmentText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
