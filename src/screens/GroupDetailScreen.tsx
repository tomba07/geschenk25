import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { groupService } from '../services/groupService';
import { Group } from '../types/group';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';

interface GroupDetailScreenProps {
  groupId: string;
  onBack: () => void;
}

interface SearchUser {
  id: number;
  username: string;
}

export default function GroupDetailScreen({ groupId, onBack }: GroupDetailScreenProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const { userId } = useAuth();

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    setLoading(true);
    try {
      const groupData = await groupService.getGroupById(groupId);
      setGroup(groupData);
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
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await apiClient.searchUsers(query);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Group Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Group Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Group not found</Text>
          <TouchableOpacity style={styles.button} onPress={onBack}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = userId !== null && userId === group.created_by;
  const isMember = userId !== null && (isOwner || group.members?.some(m => m.id === userId));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Group Details</Text>
        {isOwner && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
        {!isOwner && <View style={styles.placeholder} />}
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
              {group.owner?.username || 'Unknown'}
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
                <Text style={styles.sectionTitle}>Members</Text>
                {isOwner && (
                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={() => setInviteModalVisible(true)}
                  >
                    <Text style={styles.inviteButtonText}>+ Invite</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {group.members && group.members.length > 0 ? (
                <View style={styles.membersList}>
                  {group.members.map((member) => (
                    <View key={member.id} style={styles.memberItem}>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberUsername}>@{member.username}</Text>
                        <Text style={styles.memberDate}>
                          Joined {new Date(member.joined_at).toLocaleDateString()}
                        </Text>
                      </View>
                      {isOwner && member.id !== userId && (
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleRemoveMember(member.id, member.username)}
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
          setInviteModalVisible(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite User</Text>

            <TextInput
              style={styles.input}
              placeholder="Search for a user..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
            />

            {searching && (
              <View style={styles.searchLoader}>
                <ActivityIndicator size="small" color="#007AFF" />
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
                      <Text style={styles.searchResultUsername}>@{item.username}</Text>
                      {inviting && (
                        <ActivityIndicator size="small" color="#007AFF" style={styles.inviteLoader} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  groupName: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#000',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionText: {
    fontSize: 16,
    color: '#000',
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  badgeContainer: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inviteButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  membersList: {
    marginTop: 8,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  memberInfo: {
    flex: 1,
  },
  memberUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  memberDate: {
    fontSize: 12,
    color: '#666',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteModalButton: {
    backgroundColor: '#007AFF',
  },
  inviteModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchLoader: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchResultsContainer: {
    maxHeight: 300,
    marginTop: 8,
    marginBottom: 16,
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  searchResultUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  inviteLoader: {
    marginLeft: 8,
  },
  noResultsText: {
    paddingVertical: 12,
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
  },
});

