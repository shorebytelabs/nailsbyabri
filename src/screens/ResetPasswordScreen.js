import React, { useEffect, useState } from 'react';
import {Image, Linking, Pressable, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import AppText from '../components/AppText';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

const LOGO_SOURCE = require('../../assets/images/NailsByAbriLogo.png');

function ResetPasswordScreen({ initialToken, onSuccess, onCancel = () => {} }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  useEffect(() => {
    // Check if we have a valid session with password reset token
    // When the deep link is opened, Supabase should have set the session
    const checkSession = async () => {
      try {
        // Wait a moment for AppNavigator to process the deep link and set the session
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          if (__DEV__) {
            console.error('[ResetPassword] Session error:', sessionError);
          }
          setError('Invalid or expired reset link. Please request a new password reset.');
          return;
        }

        if (!session) {
          if (__DEV__) {
            console.log('[ResetPassword] No session found, checking for URL with token...');
          }
          
          // Try to get the URL from Linking to extract token
          const url = await Linking.getInitialURL();
          if (url && (url.includes('reset-password') || url.includes('/auth/v1/verify'))) {
            if (__DEV__) {
              console.log('[ResetPassword] Found URL with reset-password or verify:', url.substring(0, 100));
            }
            
            // If it's a Supabase verify URL, extract the token
            // Also check if we have an initialToken prop (passed from AppNavigator)
            const tokenToVerify = initialToken || (url.includes('/auth/v1/verify') ? (() => {
              try {
                const urlObj = new URL(url);
                return urlObj.searchParams.get('token');
              } catch {
                return null;
              }
            })() : null);
            
            if (tokenToVerify) {
              if (__DEV__) {
                console.log('[ResetPassword] Attempting to verify token...');
              }
              
              // Try to verify the token
              const { data, error } = await supabase.auth.verifyOtp({
                token_hash: tokenToVerify,
                type: 'recovery',
              });
              
              if (error) {
                if (__DEV__) {
                  console.error('[ResetPassword] Token verification failed:', error);
                  console.error('[ResetPassword] Error message:', error.message);
                }
                // Show error but still allow user to see the form
                // They can try again or request a new reset link
                setError('Invalid or expired reset link. Please request a new password reset from the login screen.');
              } else if (data.session) {
                if (__DEV__) {
                  console.log('[ResetPassword] ✅ Session set from token verification');
                }
                // Session is now set, we can proceed - clear any errors
                setError(null);
              }
            } else if (url.includes('/auth/v1/verify')) {
              // URL has verify endpoint but no token found
              setError('Invalid reset link. Please request a new password reset from the login screen.');
            } else {
              // Direct deep link format: nailsbyabri://reset-password#access_token=...
              const hash = url.split('#')[1];
              if (hash) {
                // Wait a bit more for session to be set
                setTimeout(async () => {
                  const { data: { session: newSession } } = await supabase.auth.getSession();
                  if (!newSession) {
                    setError('Invalid or expired reset link. Please request a new password reset from the login screen.');
                  } else {
                    setError(null);
                  }
                }, 1000);
              } else {
                // No hash in URL - this means the deep link was opened without tokens
                // This happens when you test the deep link directly
                // Show helpful message but still show the form
                setError('No reset token found. Please click the link from your password reset email, or request a new reset link from the login screen.');
              }
            }
          } else {
            // No URL found - user navigated here directly or link expired
            setError('No reset link detected. Please request a new password reset from the login screen.');
          }
        } else {
          if (__DEV__) {
            console.log('[ResetPassword] ✅ Valid session found');
          }
          // Clear any errors if we have a valid session
          setError(null);
        }
      } catch (err) {
        if (__DEV__) {
          console.error('[ResetPassword] Error checking session:', err);
        }
        setError('Unable to verify reset link. Please try again.');
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async () => {
    setError(null);

    if (!password.trim()) {
      setError('Please enter a new password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Update password using Supabase Auth
      // The session should already be set from the deep link
      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) {
        if (updateError.message?.includes('expired') || updateError.message?.includes('invalid')) {
          setError('This reset link has expired. Please request a new password reset.');
        } else {
          setError(updateError.message || 'Unable to reset password. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Success
      setSuccess(true);
      setLoading(false);

      // Call onSuccess callback after a short delay
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reset password. Please try again.';
      setError(message);
      setLoading(false);
    }
  };

  const isSubmitDisabled = !password.trim() || !confirmPassword.trim() || loading || success;

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
          accessibilityLabel="Cancel"
        >
          <Icon name="chevronRight" color={accentColor} style={styles.backIcon} size={20} />
          <AppText style={[styles.backLinkLabel, { color: accentColor }]}>Cancel</AppText>
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
                  <AppText
                    style={[
                      styles.successTitle,
                      { color: accentColor },
                    ]}
                  >
                    Password Reset Successful
                  </AppText>
                  <AppText
                    style={[
                      styles.successMessage,
                      { color: primaryFontColor },
                    ]}
                  >
                    Your password has been reset successfully. You can now log in with your new password.
                  </AppText>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.formIntro}>
                  <AppText
                    style={[
                      styles.title,
                      { color: primaryFontColor },
                    ]}
                  >
                    Reset Password
                  </AppText>
                  <AppText
                    style={[
                      styles.subtitle,
                      { color: withOpacity(primaryFontColor, 0.75) },
                    ]}
                  >
                    {error && error.includes('No reset') 
                      ? 'Please click the link from your password reset email to continue.'
                      : 'Enter your new password below.'}
                  </AppText>
                </View>

                {error && !error.includes('No reset') ? (
                  <View style={[styles.errorBox, { backgroundColor: withOpacity(errorColor, 0.1), borderColor: withOpacity(errorColor, 0.3) }]}>
                    <AppText style={[styles.error, { color: errorColor }]}>{error}</AppText>
                  </View>
                ) : null}

                {error && error.includes('No reset') ? (
                  <View style={styles.helpBox}>
                    <AppText style={[styles.helpText, { color: primaryFontColor }]}>
                      To reset your password:
                    </AppText>
                    <AppText style={[styles.helpText, { color: secondaryFontColor, marginTop: 8 }]}>
                      1. Go to the Login screen{'\n'}
                      2. Tap "Forgot password?"{'\n'}
                      3. Enter your email address{'\n'}
                      4. Click the link in the email you receive
                    </AppText>
                    <TouchableOpacity
                      onPress={onCancel}
                      style={[styles.helpButton, { borderColor: accentColor }]}
                    >
                      <AppText style={[styles.helpButtonText, { color: accentColor }]}>
                        Go to Login
                      </AppText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.section}>
                      <FormField
                        label="New Password"
                        value={password}
                        onChangeText={(value) => {
                          setPassword(value);
                          if (error) {
                            setError(null);
                          }
                        }}
                        placeholder="Enter new password"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <FormField
                        label="Confirm Password"
                        value={confirmPassword}
                        onChangeText={(value) => {
                          setConfirmPassword(value);
                          if (error) {
                            setError(null);
                          }
                        }}
                        placeholder="Confirm new password"
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <PrimaryButton
                      label="Reset Password"
                      onPress={handleSubmit}
                      loading={loading}
                      disabled={isSubmitDisabled}
                      style={styles.submitButton}
                    />
                  </>
                )}
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
  errorBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 16,
  },
  helpBox: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    marginBottom: 16,
    gap: 12,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 20,
  },
  helpButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  helpButtonText: {
    fontSize: 16,
    fontWeight: '700',
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
});

export default ResetPasswordScreen;

