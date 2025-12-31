import React, { useState, useCallback, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { verifyOTP, sendEmailOTP } from '../services/authService';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import AppText from '../components/AppText';

function OTPVerificationScreen({
  email,
  onVerificationSuccess,
  onBack,
  navigation,
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const onSurfaceColor = colors.onSurface || primaryFontColor;
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const accentColor = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';
  const shadowColor = colors.shadow || '#000000';

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (loading) {
      return;
    }

    setError(null);
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOTP({
        email: email || null,
        phone: null,
        token: trimmedCode,
        type: 'email',
      });

      if (onVerificationSuccess) {
        onVerificationSuccess(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to verify code. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (resending || resendCooldown > 0) {
      return;
    }

    setError(null);
    setResending(true);
    try {
      if (email) {
        await sendEmailOTP(email);
        setResendCooldown(60); // 60 second cooldown
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to resend code. Please try again.';
      setError(message);
    } finally {
      setResending(false);
    }
  }, [email, resending, resendCooldown]);

  const isSubmitDisabled = !code.trim();

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      <View
        style={[
          styles.ambientAccent,
          { backgroundColor: withOpacity(accentColor, 0.06) },
        ]}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevronRight" color={accentColor} style={styles.backIcon} size={20} />
          <AppText variant="ui" style={[styles.backLinkLabel, { color: accentColor }]}>Back</AppText>
        </Pressable>

        <View style={styles.formStack}>
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
              <AppText
                variant="ui"
                style={[
                  styles.title,
                  { color: onSurfaceColor },
                ]}
              >
                Check your email
              </AppText>
              <AppText
                style={[
                  styles.subtitle,
                  { color: withOpacity(onSurfaceColor, 0.75) },
                ]}
              >
                We sent a verification code to {email}
              </AppText>
            </View>

            <View style={styles.section}>
              <FormField
                label="Verification code"
                value={code}
                onChangeText={setCode}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={6}
              />
            </View>

            {error ? <AppText variant="small" style={[styles.error, { color: errorColor }]}>{error}</AppText> : null}

            <PrimaryButton
              label="Verify"
              onPress={handleVerify}
              loading={loading}
              disabled={isSubmitDisabled}
              style={styles.verifyButton}
            />

            <View style={styles.resendRow}>
              <AppText variant="ui" style={[styles.resendText, { color: secondaryFontColor }]}>
                Didn't receive the code?
              </AppText>
              <TouchableOpacity 
                onPress={handleResend} 
                accessibilityRole="button"
                disabled={resending || resendCooldown > 0}
              >
                <AppText 
                  variant="ui" 
                  style={[
                    styles.resendLink, 
                    { 
                      color: (resending || resendCooldown > 0) ? withOpacity(accentColor, 0.5) : accentColor,
                      fontWeight: '700',
                    }
                  ]}
                >
                  {resending 
                    ? ' Resending...' 
                    : resendCooldown > 0 
                    ? ` Resend (${resendCooldown}s)`
                    : ' Resend code'}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  ambientAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    zIndex: 0,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 100,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 1,
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
    marginRight: 6,
  },
  backLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  formStack: {
    gap: 24,
    zIndex: 1,
  },
  formCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  formIntro: {
    marginBottom: 24,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    gap: 16,
  },
  error: {
    marginTop: 8,
    textAlign: 'center',
  },
  verifyButton: {
    marginTop: 24,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  resendText: {
    fontSize: 14,
  },
  resendLink: {
    fontSize: 14,
  },
});

export default OTPVerificationScreen;

