import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

const LOGO_SOURCE = require('../../assets/images/NailsByAbriLogo.png');

function ForgotPasswordScreen({ onBackToLogin, onCancel = () => {} }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const errorColor = colors.error || '#B33A3A';
  const accentColor = colors.accent || '#6F171F';
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const shadowColor = colors.shadow || '#000000';

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // Use deep link URL to open password reset in the app
      // IMPORTANT: You must also configure this URL in Supabase Dashboard:
      // Authentication → URL Configuration → Redirect URLs
      // Add: nailsbyabri://reset-password
      // 
      // Also set Site URL to: nailsbyabri://reset-password (or a web URL)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'nailsbyabri://reset-password',
      });

      if (resetError) {
        // Handle specific error cases
        if (resetError.message?.includes('not found') || resetError.message?.includes('does not exist')) {
          setError('No account found with this email address');
        } else if (resetError.message?.includes('rate limit') || resetError.message?.includes('too many')) {
          setError('Too many requests. Please try again in a few minutes.');
        } else {
          setError(resetError.message || 'Unable to send reset email. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Success - show success message
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send reset email. Please try again.';
      setError(message);
      setLoading(false);
    }
  };

  const isSubmitDisabled = !email.trim() || loading;

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
          onPress={onBackToLogin}
          style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back to Login"
        >
          <Icon name="chevronRight" color={accentColor} style={styles.backIcon} size={20} />
          <Text style={[styles.backLinkLabel, { color: accentColor }]}>Back to Login</Text>
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
                shadowColor,
              },
            ]}
          >
            <View style={styles.formIntro}>
              <Text
                style={[
                  styles.title,
                  { color: primaryFontColor },
                ]}
              >
                Reset Password
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: withOpacity(primaryFontColor, 0.75) },
                ]}
              >
                Enter your email address and we'll send you a link to reset your password.
              </Text>
            </View>

            {success ? (
              <View style={styles.successContainer}>
                <View
                  style={[
                    styles.successBox,
                    {
                      backgroundColor: withOpacity(accentColor, 0.1),
                      borderColor: withOpacity(accentColor, 0.3),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.successTitle,
                      { color: accentColor },
                    ]}
                  >
                    Check your email
                  </Text>
                  <Text
                    style={[
                      styles.successMessage,
                      { color: primaryFontColor },
                    ]}
                  >
                    We've sent a password reset link to {email.trim()}. Please check your inbox (the email will be from Supabase) and follow the instructions to reset your password.
                  </Text>
                </View>
                <PrimaryButton
                  label="Back to Login"
                  onPress={onBackToLogin}
                  style={styles.backButton}
                />
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <FormField
                    label="Email"
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (error) {
                        setError(null);
                      }
                    }}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}

                <PrimaryButton
                  label="Send Reset Email"
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={isSubmitDisabled}
                  style={styles.submitButton}
                />
              </>
            )}
          </View>
        </View>
      </ScrollView>
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
  ambientAccent: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    transform: [{ rotate: '22deg' }],
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
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
    gap: 12,
  },
  error: {
    marginBottom: 4,
    fontSize: 14,
  },
  submitButton: {
    marginTop: 4,
  },
  successContainer: {
    gap: 16,
  },
  successBox: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  successMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  backButton: {
    marginTop: 8,
  },
});

export default ForgotPasswordScreen;

