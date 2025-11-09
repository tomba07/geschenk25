import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/groupService';
import { Group } from '../types/group';
import { colors, spacing, typography, commonStyles } from '../styles/theme';

interface GroupsScreenProps {
  onGroupPress: (groupId: string) => void;
  onBack: () => void;
}

export default function GroupsScreen({ onGroupPress, onBack }: GroupsScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const { userId } = useAuth();

  const loadGroups = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const userGroups = await groupService.getGroups();
      setGroups(userGroups);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

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
      Alert.alert('Error', error.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
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

  const paddingTop = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

  if (loading && groups.length === 0) {
    return (
      <View style={[commonStyles.container, { paddingTop }]}>
        <View style={commonStyles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
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
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Groups</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

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
          refreshing={loading}
          onRefresh={loadGroups}
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={commonStyles.modalOverlay}>
          <View style={commonStyles.modalContent}>
            <Text style={styles.modalTitle}>Create New Group</Text>

            <TextInput
              style={commonStyles.input}
              placeholder="Group Name"
              value={groupName}
              onChangeText={setGroupName}
              autoCapitalize="words"
              editable={!creating}
            />

            <TextInput
              style={[commonStyles.input, styles.textArea]}
              placeholder="Description (optional)"
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              numberOfLines={3}
              autoCapitalize="sentences"
              editable={!creating}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { marginRight: spacing.md }]}
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
                style={[styles.modalButton, commonStyles.button]}
                onPress={handleCreateGroup}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={commonStyles.buttonText}>Create</Text>
                )}
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
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.xl,
  },
  textArea: {
    height: 80,
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
});

