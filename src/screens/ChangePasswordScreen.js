import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import { changePassword } from '../services/api';

function ChangePasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { state } = useAppState();
  const user = state.currentUser;

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const primaryFont = colors.primaryFont || '#220707';
  const accent = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';
  const successColor = colors.success || '#4B7A57';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setSuccessMessage(null);

    // Validation
    if (!passwordForm.currentPassword.trim()) {
      setPasswordError('Please enter your current password');
      return;
    }

    if (!passwordForm.newPassword.trim()) {
      setPasswordError('Please enter a new password');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setChangingPassword(true);

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      // Success
      setSuccessMessage('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      logEvent('profile_password_changed');

      // Clear success message after 2 seconds and go back
      setTimeout(() => {
        setSuccessMessage(null);
        if (navigation.goBack) {
          navigation.goBack();
        }
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password. Please try again.';
      setPasswordError(message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <ScreenContainer scroll={false} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back to Profile"
        >
          <Icon name="chevronRight" color={primaryFont} style={styles.backIcon} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Change Password</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: secondaryFont }]}>
          Enter your current password and choose a new password.
        </Text>

        <View style={styles.formSection}>
          <FormField
            label="Current Password"
            value={passwordForm.currentPassword}
            onChangeText={(value) => {
              setPasswordForm((prev) => ({ ...prev, currentPassword: value }));
              if (passwordError) setPasswordError(null);
              if (successMessage) setSuccessMessage(null);
            }}
            placeholder="Enter your current password"
            secureTextEntry
            autoCapitalize="none"
          />
          <FormField
            label="New Password"
            value={passwordForm.newPassword}
            onChangeText={(value) => {
              setPasswordForm((prev) => ({ ...prev, newPassword: value }));
              if (passwordError) setPasswordError(null);
              if (successMessage) setSuccessMessage(null);
            }}
            placeholder="Enter new password (min. 6 characters)"
            secureTextEntry
            autoCapitalize="none"
          />
          <FormField
            label="Confirm New Password"
            value={passwordForm.confirmPassword}
            onChangeText={(value) => {
              setPasswordForm((prev) => ({ ...prev, confirmPassword: value }));
              if (passwordError) setPasswordError(null);
              if (successMessage) setSuccessMessage(null);
            }}
            placeholder="Re-enter new password"
            secureTextEntry
            autoCapitalize="none"
          />

          {passwordError ? (
            <Text style={[styles.errorText, { color: errorColor }]}>{passwordError}</Text>
          ) : null}

          {successMessage ? (
            <Text style={[styles.successText, { color: successColor }]}>{successMessage}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Change Password"
            onPress={handlePasswordChange}
            loading={changingPassword}
            disabled={
              changingPassword ||
              !passwordForm.currentPassword.trim() ||
              !passwordForm.newPassword.trim() ||
              !passwordForm.confirmPassword.trim()
            }
            accessibilityLabel="Change password"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withOpacity(colors.border || '#000000', 0.08),
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  formSection: {
    gap: 16,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 13,
    marginTop: 4,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  actions: {
    marginTop: 8,
  },
});

export default ChangePasswordScreen;

