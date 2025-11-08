import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { login } from '../services/api';

function LoginScreen({ onLoginSuccess, onConsentPending, onSwitchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Log in to manage your appointments and profile.</Text>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label="Log In"
        onPress={handleSubmit}
        loading={loading}
        disabled={isSubmitDisabled}
      />

      <TouchableOpacity onPress={onSwitchToSignup} style={styles.switchRow}>
        <Text style={styles.switchText}>Need an account? </Text>
        <Text style={styles.switchLink}>Sign up</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#15133d',
  },
  subtitle: {
    marginTop: 8,
    color: '#484b7a',
    fontSize: 15,
    lineHeight: 20,
  },
  section: {
    marginBottom: 16,
  },
  error: {
    color: '#b00020',
    marginBottom: 16,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  switchText: {
    color: '#333',
  },
  switchLink: {
    color: '#272b75',
    fontWeight: '600',
  },
});

export default LoginScreen;

