import React, { useMemo, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { signup } from '../services/api';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

const LOGO_SOURCE = require('../../assets/images/NailsByAbriLogo.png');

function SignupScreen({ onSignupSuccess, onSwitchToLogin, onCancel = () => {} }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [successPayload, setSuccessPayload] = useState(null);
  const [successVisible, setSuccessVisible] = useState(false);

  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const accentColor = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';

  const age = useMemo(() => calculateAge(dob), [dob]);
  const isMinor = typeof age === 'number' && age < 18;

  const handleSubmit = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError(null);
    setEmailError('');

    try {
      const response = await signup({
        name,
        email,
        password,
        dob,
        parentEmail: parentEmail || undefined,
        parentPhone: parentPhone || undefined,
      });
      setSuccessPayload(response);
      setSuccessVisible(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete signup, please try again.';
      if (message.toLowerCase().includes('account already exists')) {
        setEmailError('An account already exists for this email. Try logging in or use “Forgot password”.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    !name.trim() || !email.trim() || !password.trim() || !dob.trim();

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      <View
        style={[
          styles.ambientAccent,
          { backgroundColor: withOpacity(accentColor, 0.06) },
        ]}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={onCancel}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back to Home"
        >
          <Text
            style={[styles.backText, { color: withOpacity(primaryFontColor, 0.7) }]}
          >
            ← Back to Home
          </Text>
        </TouchableOpacity>

        <View style={styles.formStack}>
          <View style={styles.logoWrapper}>
            <View
              style={[
                styles.logoContainer,
                { backgroundColor: withOpacity(secondaryBackgroundColor, 0.6) },
              ]}
            >
              <Image source={LOGO_SOURCE} style={styles.logo} resizeMode="contain" />
            </View>
          </View>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor: surfaceColor,
                borderColor,
                shadowColor: colors.shadow || '#000000',
              },
            ]}
          >
            <View style={styles.formIntro}>
              <Text style={[styles.title, { color: primaryFontColor }]}>Create Your Account</Text>
              <Text style={[styles.subtitle, { color: withOpacity(primaryFontColor, 0.75) }]}>Your perfect nails, your way.</Text>
            </View>

            <View style={styles.formSection}>
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
                onChangeText={(value) => {
                  setEmail(value);
                  if (emailError) {
                    setEmailError('');
                  }
                }}
                placeholder="you@example.com"
                keyboardType="email-address"
                errorMessage={emailError}
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
              <Text style={[styles.helperText, { color: withOpacity(primaryFontColor, 0.65) }]}>Enter your date of birth to verify if parental consent is required.</Text>
            </View>

            {isMinor ? (
              <View style={styles.guardianBlock}>
                <View style={[styles.sectionDivider, { backgroundColor: withOpacity(borderColor, 0.6) }]} />
                <Text style={[styles.guardianTitle, { color: primaryFontColor }]}>Parent or Guardian Contact</Text>
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
                <Text style={[styles.guardianHint, { color: withOpacity(primaryFontColor, 0.65) }]}>Provide at least one contact method if the child is under 18.</Text>
              </View>
            ) : null}

            {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}

            <PrimaryButton
              label="Sign Up"
              onPress={handleSubmit}
              loading={loading}
              disabled={isSubmitDisabled || loading}
              style={styles.submitButton}
            />

            <View style={styles.switchRow}>
              <Text style={[styles.switchText, { color: secondaryFontColor }]}>Already have an account?</Text>
              <TouchableOpacity onPress={onSwitchToLogin} accessibilityRole="button">
                <Text style={[styles.switchLink, { color: accentColor }]}> Log in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: colors.surface || '#FFFFFF',
                borderColor,
                shadowColor: colors.shadow || '#000000',
              },
            ]}
          >
            <Text style={[styles.successTitle, { color: colors.success || '#4B7A57' }]}>Account created</Text>
            <Text style={[styles.successMessage, { color: withOpacity(primaryFontColor, 0.85) }]}>If account requires parental consent, you’ll be directed to the Consent form now.</Text>
            <PrimaryButton
              label="Continue"
              onPress={() => {
                setSuccessVisible(false);
                if (successPayload) {
                  onSignupSuccess(successPayload);
                  setSuccessPayload(null);
                }
              }}
            />
          </View>
        </View>
      </Modal>
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
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 32,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 24,
  },
  ambientAccent: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    transform: [{ rotate: '18deg' }],
  },
  backButton: {
    alignSelf: 'flex-start',
    marginLeft: 4,
    marginBottom: 8,
  },
  backText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  formStack: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: -50,
  },
  logoWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: -120,
  },
  logoContainer: {
    width: 320,
    height: 320,
    borderRadius: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 6,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 12,
    marginTop: 0,
  },
  formIntro: {
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  formSection: {
    gap: 12,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '500',
  },
  guardianBlock: {
    gap: 12,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
  },
  guardianTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  guardianHint: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  error: {
    marginTop: -4,
    fontSize: 14,
  },
  submitButton: {
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  switchText: {
    fontSize: 13,
    fontWeight: '500',
  },
  switchLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 16,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 10,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  successMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default SignupScreen;

