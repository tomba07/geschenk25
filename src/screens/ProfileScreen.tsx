import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, typography, commonStyles } from '../styles/theme';

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { username, displayName, imageUrl, updateDisplayName, updateProfileImage, deleteAccount } = useAuth();
  const [newDisplayName, setNewDisplayName] = useState(displayName || '');
  const [editingImage, setEditingImage] = useState<string | null>(imageUrl || null);
  const [loading, setLoading] = useState(false);
  const [updatingImage, setUpdatingImage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need access to your photos to upload a profile image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.images,
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
    setEditingImage(null);
  };

  const handleSaveImage = async () => {
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

      const { error } = await updateProfileImage(imageBase64);
      setUpdatingImage(false);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to update profile image');
      } else {
        Alert.alert('Success', 'Profile image updated successfully');
      }
    } catch (error) {
      setUpdatingImage(false);
      Alert.alert('Error', 'Failed to update profile image');
    }
  };

  const handleSave = async () => {
    if (newDisplayName.trim().length > 100) {
      Alert.alert('Error', 'Display name must be 100 characters or less');
      return;
    }

    setLoading(true);
    const { error } = await updateDisplayName(newDisplayName.trim() || '');
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message || 'Failed to update display name');
    } else {
      Alert.alert('Success', 'Display name updated successfully');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete:\n\n• All your groups\n• All your group memberships\n• All gift ideas you created\n• All your data\n\nThis action cannot be undone.',
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
            const { error } = await deleteAccount();
            setDeleting(false);

            if (error) {
              Alert.alert('Error', error.message || 'Failed to delete account');
            } else {
              // Account deleted and user signed out, navigation will be handled by App.tsx
              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
            }
          },
        },
      ]
    );
  };

  const paddingTop = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0;

  return (
    <View style={[commonStyles.container, { paddingTop }]}>
      <View style={commonStyles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.label}>Profile Image</Text>
          {editingImage || imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image 
                source={{ uri: editingImage || imageUrl || '' }} 
                style={styles.profileImagePreview} 
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
              {(editingImage !== (imageUrl || null)) && (
                <TouchableOpacity
                  style={[commonStyles.button, styles.saveImageButton]}
                  onPress={handleSaveImage}
                  disabled={updatingImage}
                >
                  {updatingImage ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={commonStyles.buttonText}>Save Image</Text>
                  )}
                </TouchableOpacity>
              )}
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

        <View style={styles.section}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.value}>@{username}</Text>
          <Text style={styles.hint}>Your username cannot be changed</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={commonStyles.input}
            placeholder="Enter display name (optional)"
            value={newDisplayName}
            onChangeText={setNewDisplayName}
            autoCapitalize="words"
            editable={!loading}
            maxLength={100}
          />
          <Text style={styles.hint}>
            This is how your name appears to others. Leave empty to use your username.
          </Text>
        </View>

        <TouchableOpacity
          style={[commonStyles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={commonStyles.buttonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
          <Text style={styles.dangerSectionDescription}>
            Deleting your account will permanently remove all your data, including groups, memberships, and gift ideas. This action cannot be undone.
          </Text>
          <TouchableOpacity
            style={[styles.deleteAccountButton, deleting && styles.buttonDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  value: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dangerSection: {
    marginTop: spacing.xxl * 2,
    paddingTop: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dangerSectionTitle: {
    ...typography.h3,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  dangerSectionDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  deleteAccountButton: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    padding: spacing.lg,
    alignItems: 'center',
  },
  deleteAccountButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  profileImagePreview: {
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
});

