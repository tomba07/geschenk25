import { StyleSheet, Platform, StatusBar } from 'react-native';

export const colors = {
  primary: '#007AFF',
  success: '#34C759',
  danger: '#FF3B30',
  background: '#fff',
  surface: '#f5f5f5',
  border: '#e0e0e0',
  text: '#000',
  textSecondary: '#666',
  textTertiary: '#999',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: 'bold' as const },
  h2: { fontSize: 24, fontWeight: 'bold' as const },
  h3: { fontSize: 20, fontWeight: 'bold' as const },
  body: { fontSize: 16 },
  bodySmall: { fontSize: 14 },
  caption: { fontSize: 12 },
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.lg,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.xxl,
    width: '90%',
    maxWidth: 400,
  },
});

