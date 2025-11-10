import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { login } from '../services/api';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

function LoginScreen({
  authMessage,
  onLoginSuccess,
  onConsentPending,
  onSwitchToSignup,
  onCancel = () => {},
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const errorColor = colors.error || '#B33A3A';
  const accentColor = colors.accent || '#6F171F';
  const noticeBackgroundColor = withOpacity(accentColor, 0.12);
  const noticeBorderColor = withOpacity(accentColor, 0.24);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await login({ email, password });
      onLoginSuccess(response);
    } catch (err) {
      if (err instanceof Error && err.details && err.details.pendingConsent && err.details.user) {
        onConsentPending({ user: err.details.user, message: err.message });
        setLoading(false);
        return;
      }

      const message = err instanceof Error ? err.message : 'Unable to log in.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = !email.trim() || !password.trim();

  return (
    <ScreenContainer>
      {authMessage ? (
        <View
          style={[
            styles.notice,
            {
              backgroundColor: noticeBackgroundColor,
              borderColor: noticeBorderColor,
            },
          ]}
        >
          <Text style={[styles.noticeTitle, { color: accentColor }]}>Log in required</Text>
          <Text style={[styles.noticeMessage, { color: primaryFontColor }]}>{authMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.header, { backgroundColor: secondaryBackgroundColor }]}>
        <Text style={[styles.title, { color: primaryFontColor }]}>
          Welcome Back
        </Text>
        <Text style={[styles.subtitle, { color: secondaryFontColor }]}>
          Log in to manage your appointments and profile.
        </Text>
      </View>

      <View style={styles.section}>
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
        />
      </View>

      {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}

      <PrimaryButton
        label="Log In"
        onPress={handleSubmit}
        loading={loading}
        disabled={isSubmitDisabled}
      />

      <TouchableOpacity onPress={onSwitchToSignup} style={styles.switchRow}>
        <Text style={[styles.switchText, { color: secondaryFontColor }]}>
          Need an account?{' '}
        </Text>
        <Text style={[styles.switchLink, { color: accentColor }]}>Sign up</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onCancel}
        style={styles.cancelRow}
        accessibilityRole="button"
        accessibilityLabel="Go back without logging in"
      >
        <Text style={[styles.cancelText, { color: secondaryFontColor }]}>Back to Home</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  notice: {
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  noticeMessage: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
  },
  section: {
    marginBottom: 16,
  },
  error: {
    marginBottom: 16,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  switchText: {
  },
  switchLink: {
    fontWeight: '600',
  },
  cancelRow: {
    marginTop: 24,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default LoginScreen;

