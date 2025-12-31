import React, { useState, useCallback } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { sendEmailOTP } from '../services/authService';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import AppText from '../components/AppText';

const LOGO_SOURCE = require('../../assets/images/NailsByAbriLogo.png');

function PasswordlessEntryScreen({
  onOTPSent,
  onSwitchToPassword,
  onCancel = () => {},
  navigation,
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  const handleContinue = async () => {
    if (loading) {
      return;
    }

    setError(null);
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      setError('Please enter your email address.');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedInput)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await sendEmailOTP(trimmedInput.toLowerCase());
      if (onOTPSent) {
        onOTPSent({
          type: 'email',
          email: trimmedInput.toLowerCase(),
          phone: null,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send code. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = !input.trim();

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
                shadowColor,
              },
            ]}
          >
            <View style={styles.formIntro}>
              <AppText
                variant="ui"
                style={[
                  styles.welcome,
                  { color: onSurfaceColor },
                ]}
              >
                Welcome!
              </AppText>
              <AppText
                style={[
                  styles.subtitle,
                  { color: withOpacity(onSurfaceColor, 0.75) },
                ]}
              >
                Enter your email address to continue
              </AppText>
            </View>

            <View style={styles.section}>
              <FormField
                label="Email address"
                value={input}
                onChangeText={setInput}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {error ? <AppText variant="small" style={[styles.error, { color: errorColor }]}>{error}</AppText> : null}

            <PrimaryButton
              label="Continue"
              onPress={handleContinue}
              loading={loading}
              disabled={isSubmitDisabled}
              style={styles.continueButton}
            />

            <View style={styles.switchRow}>
              <AppText variant="ui" style={[styles.switchText, { color: secondaryFontColor }]}>
                Prefer to use a password?
              </AppText>
              <TouchableOpacity onPress={onSwitchToPassword} accessibilityRole="button">
                <AppText variant="ui" style={[styles.switchLink, { color: accentColor }]}> Use password</AppText>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 32,
    paddingHorizontal: 6,
    paddingBottom: 100,
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
    marginBottom: -130,
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
    marginTop: -20,
  },
  formIntro: {
    gap: 10,
  },
  welcome: {
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
  continueButton: {
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
});

export default PasswordlessEntryScreen;

