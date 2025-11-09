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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, typography, commonStyles } from '../styles/theme';

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { username, displayName, updateDisplayName } = useAuth();
  const [newDisplayName, setNewDisplayName] = useState(displayName || '');
  const [loading, setLoading] = useState(false);

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

      <View style={styles.content}>
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
      </View>
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
  content: {
    padding: spacing.xl,
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
});

