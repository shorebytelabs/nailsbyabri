import React, { useCallback, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import ConsentModal from '../components/ConsentModal';
import Icon from '../icons/Icon';
import { login } from '../services/api';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import AppText from '../components/AppText';

const LOGO_SOURCE = require('../../assets/images/NailsByAbriLogo.png');

function LoginScreen({
  authMessage,
  onLoginSuccess,
  onConsentPending,
  onSwitchToSignup,
  onForgotPassword,
  onCancel = () => {},
  navigation,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [consentUser, setConsentUser] = useState(null);
  const [missingTerms, setMissingTerms] = useState(false);
  const [missingPrivacy, setMissingPrivacy] = useState(false);
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const onSurfaceColor = colors.onSurface || primaryFontColor; // Use onSurface for text on surface backgrounds
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const errorColor = colors.error || '#B33A3A';
  const accentColor = colors.accent || '#6F171F';
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const shadowColor = colors.shadow || '#000000';

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await login({ email, password });
      onLoginSuccess(response);
    } catch (err) {
      // Handle old parental consent flow
      if (err instanceof Error && err.details && err.details.pendingConsent && err.details.user) {
        onConsentPending({ user: err.details.user, message: err.message });
        setLoading(false);
        return;
      }

      // Handle missing legal consent (Terms & Conditions / Privacy Policy)
      if (err instanceof Error && err.details && err.details.missingLegalConsent && err.details.user) {
        setConsentUser(err.details.user);
        setMissingTerms(err.details.missingTerms || false);
        setMissingPrivacy(err.details.missingPrivacy || false);
        setConsentModalVisible(true);
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

  const handleForgotPassword = useCallback(() => {
    if (onForgotPassword) {
      onForgotPassword();
    }
  }, [onForgotPassword]);

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
              {authMessage ? (
                <AppText
                  style={[
                    styles.authContext,
                    { color: withOpacity(onSurfaceColor, 0.75) },
                  ]}
                >
                  {authMessage}
                </AppText>
              ) : null}
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

            {error ? <AppText variant="small" style={[styles.error, { color: errorColor }]}>{error}</AppText> : null}

            <PrimaryButton
              label="Log In"
              onPress={handleSubmit}
              loading={loading}
              disabled={isSubmitDisabled}
              style={styles.loginButton}
            />

            <TouchableOpacity
              style={styles.forgotRow}
              accessibilityRole="button"
              onPress={handleForgotPassword}
            >
              <AppText
                variant="ui"
                style={[
                  styles.forgotText,
                  { color: withOpacity(primaryFontColor, 0.7) },
                ]}
              >
                Forgot password?
              </AppText>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <AppText variant="ui" style={[styles.switchText, { color: secondaryFontColor }]}>
                Need an account?
              </AppText>
              <TouchableOpacity onPress={onSwitchToSignup} accessibilityRole="button">
                <AppText variant="ui" style={[styles.switchLink, { color: accentColor }]}> Sign up</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Legal Consent Modal */}
      <ConsentModal
        visible={consentModalVisible}
        user={consentUser}
        missingTerms={missingTerms}
        missingPrivacy={missingPrivacy}
        onConsentAccepted={async () => {
          // After consent is accepted, retry login
          setConsentModalVisible(false);
          setConsentUser(null);
          setMissingTerms(false);
          setMissingPrivacy(false);
          
          // Retry login
          setLoading(true);
          setError(null);
          try {
            const response = await login({ email, password });
            onLoginSuccess(response);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to log in.';
            setError(message);
          } finally {
            setLoading(false);
          }
        }}
        onViewTerms={() => {
          if (navigation) {
            navigation.navigate('Terms');
          }
        }}
        onViewPrivacy={() => {
          if (navigation) {
            navigation.navigate('Privacy');
          }
        }}
      />
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
    paddingBottom: 100, // Extra padding at bottom so last field is visible above keyboard
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
  authContext: {
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
  loginButton: {
    marginTop: 4,
  },
  forgotRow: {
    alignItems: 'flex-end',
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
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

export default LoginScreen;

