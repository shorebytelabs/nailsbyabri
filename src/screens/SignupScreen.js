import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View, Linking } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { signup } from '../services/api';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import AppText from '../components/AppText';

const LOGO_SOURCE = require('../../assets/images/NailsByAbriLogo.png');

const AGE_GROUPS = [
  { value: '13-17', label: '13-17 years' },
  { value: '18-24', label: '18-24 years' },
  { value: '25-34', label: '25-34 years' },
  { value: '35-44', label: '35-44 years' },
  { value: '45-54', label: '45-54 years' },
  { value: '55+', label: '55+ years' },
];

function SignupScreen({ onSignupSuccess, onSwitchToLogin, onCancel = () => {}, navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [successPayload, setSuccessPayload] = useState(null);
  const [successVisible, setSuccessVisible] = useState(false);

  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const onSurfaceColor = colors.onSurface || primaryFontColor; // Use onSurface for text on surface backgrounds
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const accentColor = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';

  const handleSubmit = async () => {
    if (loading) {
      return;
    }
    
    // Validate and sanitize inputs
    const sanitizedName = name.trim();
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPassword = password.trim();

    if (!sanitizedName) {
      setError('Please enter your name.');
      return;
    }

    if (!sanitizedEmail) {
      setEmailError('Please enter your email address.');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    if (!sanitizedPassword) {
      setError('Please enter a password.');
      return;
    }

    if (sanitizedPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    
    // Validate age group - must be 13 or older
    // All our age groups start at 13+, so if ageGroup is set, it's valid
    if (!ageGroup) {
      setError('Please select your age group.');
      return;
    }

    // Validate consent acceptance
    if (!consentAccepted) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setEmailError('');

    try {
      const response = await signup({
        name: sanitizedName,
        email: sanitizedEmail,
        password: sanitizedPassword,
        ageGroup,
        consentAccepted: true, // Pass consent acceptance to signup service
      });
      
      // Check if email confirmation is required
      if (response.emailConfirmationRequired) {
        // Show email verification message and redirect to login
        setSuccessPayload(response);
        setSuccessVisible(true);
      } else {
        // Legacy flow (shouldn't happen with new flow)
        setSuccessPayload(response);
        setSuccessVisible(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete signup, please try again.';
      if (message.toLowerCase().includes('account already exists')) {
        setEmailError('An account already exists for this email. Try logging in or use "Forgot password".');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    !name.trim() || !email.trim() || !password.trim() || !ageGroup || !consentAccepted;

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
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back to Home"
        >
          <Icon name="chevronRight" color={accentColor} style={styles.backIcon} size={20} />
          <AppText variant="ui" style={[styles.backLinkLabel, { color: accentColor }]}>Back to Home</AppText>
        </Pressable>

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
              <AppText variant="ui" style={[styles.title, { color: onSurfaceColor }]}>Create Your Account</AppText>
              <AppText style={[styles.subtitle, { color: withOpacity(onSurfaceColor, 0.75) }]}>Your perfect nails, your way.</AppText>
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
              <View style={styles.ageGroupContainer}>
                <AppText variant="ui" style={[styles.ageGroupLabel, { color: onSurfaceColor }]}>Age Group</AppText>
                <View style={styles.ageGroupOptions}>
                  {AGE_GROUPS.map((group) => (
                    <TouchableOpacity
                      key={group.value}
                      style={[
                        styles.ageGroupOption,
                        {
                          backgroundColor: ageGroup === group.value ? accentColor : surfaceColor,
                          borderColor: ageGroup === group.value ? accentColor : borderColor,
                        },
                      ]}
                      onPress={() => setAgeGroup(group.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select age group ${group.label}`}
                    >
                      <AppText
                        variant="ui"
                        style={[
                          styles.ageGroupOptionText,
                          {
                            color: ageGroup === group.value ? '#FFFFFF' : primaryFontColor,
                          },
                        ]}
                      >
                        {group.label}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
                <AppText variant="small" style={[styles.helperText, { color: withOpacity(primaryFontColor, 0.65) }]}>
                  You must be 13 years or older to create an account.
                </AppText>
              </View>

              {/* Legal Consent Checkbox */}
              <View style={styles.consentContainer}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setConsentAccepted(!consentAccepted)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consentAccepted }}
                  accessibilityLabel="I agree to the Terms & Conditions and Privacy Policy"
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: consentAccepted ? accentColor : surfaceColor,
                        borderColor: consentAccepted ? accentColor : borderColor,
                      },
                    ]}
                  >
                    {consentAccepted && (
                      <Icon name="check" color="#FFFFFF" size={14} />
                    )}
                  </View>
                  <View style={styles.consentTextContainer}>
                    <AppText style={[styles.consentText, { color: primaryFontColor }]}>
                      I agree to the{' '}
                      <AppText
                        style={[styles.consentLink, { color: accentColor }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (navigation) {
                            navigation.navigate('Terms');
                          }
                        }}
                        accessibilityRole="link"
                        accessibilityLabel="View Terms & Conditions"
                      >
                        Terms & Conditions
                      </AppText>
                      {' '}and{' '}
                      <AppText
                        style={[styles.consentLink, { color: accentColor }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (navigation) {
                            navigation.navigate('Privacy');
                          }
                        }}
                        accessibilityRole="link"
                        accessibilityLabel="View Privacy Policy"
                      >
                        Privacy Policy
                      </AppText>
                    </AppText>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {error ? <AppText variant="small" style={[styles.error, { color: errorColor }]}>{error}</AppText> : null}

            <PrimaryButton
              label="Sign Up"
              onPress={handleSubmit}
              loading={loading}
              disabled={isSubmitDisabled || loading}
              style={styles.submitButton}
            />

            <View style={styles.switchRow}>
              <AppText variant="ui" style={[styles.switchText, { color: secondaryFontColor }]}>Already have an account?</AppText>
              <TouchableOpacity onPress={onSwitchToLogin} accessibilityRole="button">
                <AppText variant="ui" style={[styles.switchLink, { color: accentColor }]}> Log in</AppText>
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
            <AppText variant="ui" style={[styles.successTitle, { color: colors.success || '#4B7A57' }]}>Account Created!</AppText>
            <AppText style={[styles.successMessage, { color: withOpacity(primaryFontColor, 0.85) }]}>
              We've sent a verification email to {successPayload?.user?.email || 'your email address'}.
              {'\n\n'}
              Please check your inbox and click the verification link from Supabase to activate your account.
              {'\n\n'}
              Once verified, you can log in to start placing orders.
            </AppText>
            <PrimaryButton
              label="Go to Login"
              onPress={() => {
                setSuccessVisible(false);
                setSuccessPayload(null);
                // Redirect to login screen
                onSwitchToLogin();
              }}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
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
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  backLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
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
    marginTop: 8,
  },
  ageGroupContainer: {
    marginBottom: 4,
  },
  ageGroupLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  ageGroupOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  ageGroupOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  ageGroupOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  consentContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  consentTextContainer: {
    flex: 1,
  },
  consentText: {
    fontSize: 13,
    lineHeight: 20,
  },
  consentLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
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

