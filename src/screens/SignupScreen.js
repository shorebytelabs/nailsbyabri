import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { signup } from '../services/api';
import { useTheme } from '../theme';

function SignupScreen({ onSignupSuccess, onSwitchToLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { theme } = useTheme();

  const age = useMemo(() => calculateAge(dob), [dob]);
  const isMinor = typeof age === 'number' && age < 18;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await signup({
        name,
        email,
        password,
        dob,
        parentEmail: parentEmail || undefined,
        parentPhone: parentPhone || undefined,
      });
      onSignupSuccess(response);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to complete signup, please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    !name.trim() || !email.trim() || !password.trim() || !dob.trim();

  return (
    <ScreenContainer>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme?.colors?.secondaryBackground || styles.header.backgroundColor,
            borderRadius: 12,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            { color: theme?.colors?.primaryFont || styles.title.color },
          ]}
        >
          Create Your Account
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: theme?.colors?.secondaryFont || styles.subtitle.color },
          ]}
        >
          Enter your details to continue. We will request parental consent if you are a minor.
        </Text>
      </View>

      <View style={styles.section}>
        <FormField
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="Abri Smith"
          autoCapitalize="words"
        />
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="child@example.com"
          keyboardType="email-address"
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Create a strong password"
          secureTextEntry
        />
        <FormField
          label="Date of Birth"
          value={dob}
          onChangeText={setDob}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />

        <View style={styles.noticeContainer}>
          {typeof age === 'number' ? (
            <Text
              style={[
                styles.noticeText,
                { color: theme?.colors?.primaryFont || styles.noticeText.color },
              ]}
            >
              Your age is calculated as {age}.{' '}
              {isMinor ? 'Parental consent required.' : 'You are registering as an adult.'}
            </Text>
          ) : (
            <Text
              style={[
                styles.noticeText,
                { color: theme?.colors?.primaryFont || styles.noticeText.color },
              ]}
            >
              Enter your date of birth to verify if parental consent is required.
            </Text>
          )}
        </View>

        <View style={styles.guardianSection}>
          <Text style={styles.guardianTitle}>Parent or Guardian Contact</Text>
          <FormField
            label="Parent Email"
            value={parentEmail}
            onChangeText={setParentEmail}
            placeholder="parent@example.com"
            keyboardType="email-address"
          />
          <FormField
            label="Parent Phone"
            value={parentPhone}
            onChangeText={setParentPhone}
            placeholder="+1 555-555-5555"
            keyboardType="phone-pad"
          />
          <Text style={styles.guardianHint}>
            Provide at least one contact method if the child is under 18.
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label="Sign Up"
        onPress={handleSubmit}
        loading={loading}
        disabled={isSubmitDisabled}
      />

      <TouchableOpacity onPress={onSwitchToLogin} style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account? </Text>
        <Text style={styles.switchLink}>Log in</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

function calculateAge(dobString) {
  if (!dobString) {
    return null;
  }

  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age;
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
    padding: 16,
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
  noticeContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  noticeText: {
    color: '#272b75',
    fontSize: 14,
  },
  guardianSection: {
    marginTop: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d9ddff',
    borderRadius: 10,
    backgroundColor: '#f8f9ff',
  },
  guardianTitle: {
    fontWeight: '600',
    color: '#272b75',
    marginBottom: 12,
  },
  guardianHint: {
    marginTop: 8,
    color: '#5c5f8d',
    fontSize: 13,
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

export default SignupScreen;

