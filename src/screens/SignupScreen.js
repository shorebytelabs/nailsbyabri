import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { signup } from '../services/api';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

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
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const surfaceColor = colors.surface || '#FFFFFF';
  const surfaceMutedColor = colors.surfaceMuted || withOpacity(surfaceColor, 0.4);
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const borderColor = colors.border || '#D9C8A9';
  const accentColor = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';

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
      <View style={[styles.header, { backgroundColor: secondaryBackgroundColor }]}>
        <Text
          style={[
            styles.title,
            { color: primaryFontColor },
          ]}
        >
          Create Your Account
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: secondaryFontColor },
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

        <View style={[styles.noticeContainer, { backgroundColor: surfaceMutedColor }]}>
          {typeof age === 'number' ? (
            <Text
              style={[
                styles.noticeText,
                { color: primaryFontColor },
              ]}
            >
              Your age is calculated as {age}.{' '}
              {isMinor ? 'Parental consent required.' : 'You are registering as an adult.'}
            </Text>
          ) : (
            <Text
              style={[
                styles.noticeText,
                { color: primaryFontColor },
              ]}
            >
              Enter your date of birth to verify if parental consent is required.
            </Text>
          )}
        </View>

        <View
          style={[
            styles.guardianSection,
            { borderColor, backgroundColor: surfaceColor },
          ]}
        >
          <Text style={[styles.guardianTitle, { color: primaryFontColor }]}>
            Parent or Guardian Contact
          </Text>
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
          <Text style={[styles.guardianHint, { color: secondaryFontColor }]}>
            Provide at least one contact method if the child is under 18.
          </Text>
        </View>
      </View>

      {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}

      <PrimaryButton
        label="Sign Up"
        onPress={handleSubmit}
        loading={loading}
        disabled={isSubmitDisabled}
      />

      <TouchableOpacity onPress={onSwitchToLogin} style={styles.switchRow}>
        <Text style={[styles.switchText, { color: secondaryFontColor }]}>
          Already have an account?{' '}
        </Text>
        <Text style={[styles.switchLink, { color: accentColor }]}>Log in</Text>
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
  noticeContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
  },
  noticeText: {
    fontSize: 14,
  },
  guardianSection: {
    marginTop: 8,
    padding: 16,
    borderWidth: 1,
    borderRadius: 10,
  },
  guardianTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  guardianHint: {
    marginTop: 8,
    fontSize: 13,
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

export default SignupScreen;

