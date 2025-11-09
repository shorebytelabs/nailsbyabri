import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { login } from '../services/api';
import { useTheme } from '../theme';

function LoginScreen({ onLoginSuccess, onConsentPending, onSwitchToSignup }) {
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
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
});

export default LoginScreen;

