import React, { useState, useCallback } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { completePasswordlessSignup } from '../services/authService';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import AppText from '../components/AppText';

const AGE_GROUPS = [
  { value: '13-17', label: '13-17 years' },
  { value: '18-24', label: '18-24 years' },
  { value: '25-34', label: '25-34 years' },
  { value: '35-44', label: '35-44 years' },
  { value: '45-54', label: '45-54 years' },
  { value: '55+', label: '55+ years' },
];

function AgeVerificationScreen({
  userId,
  onComplete,
  onBack,
  navigation,
}) {
  const [ageGroup, setAgeGroup] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const onSurfaceColor = colors.onSurface || primaryFontColor;
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const accentColor = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';
  const shadowColor = colors.shadow || '#000000';

  const handleSubmit = async () => {
    if (loading) {
      return;
    }

    setError(null);

    if (!ageGroup) {
      setError('Please select your age group.');
      return;
    }

    // Validate age group (must be 13+)
    const ageMin = ageGroup === '55+' ? 55 : parseInt(ageGroup.split('-')[0]);
    if (ageMin < 13) {
      setError('You must be 13 years or older to create an account.');
      return;
    }

    if (!consentAccepted) {
      setError('You must accept the Terms & Conditions and Privacy Policy to create an account.');
      return;
    }

    setLoading(true);
    try {
      const result = await completePasswordlessSignup({
        userId,
        ageGroup,
        name: null, // Name will be collected separately if needed
        consentAccepted: true,
      });

      if (onComplete) {
        onComplete(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete signup. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTerms = useCallback(() => {
    if (navigation) {
      navigation.navigate('Terms');
    }
  }, [navigation]);

  const handleViewPrivacy = useCallback(() => {
    if (navigation) {
      navigation.navigate('Privacy');
    }
  }, [navigation]);

  const isSubmitDisabled = !ageGroup || !consentAccepted;

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
                Age Verification
              </AppText>
              <AppText
                style={[
                  styles.subtitle,
                  { color: withOpacity(onSurfaceColor, 0.75) },
                ]}
              >
                You must be 13 years or older to create an account
              </AppText>
            </View>

            <View style={styles.section}>
              <AppText variant="ui" style={[styles.label, { color: primaryFontColor }]}>
                Select your age group
              </AppText>
              <View style={styles.ageGroupContainer}>
                {AGE_GROUPS.map((group) => {
                  const isSelected = ageGroup === group.value;
                  return (
                    <TouchableOpacity
                      key={group.value}
                      onPress={() => setAgeGroup(group.value)}
                      style={[
                        styles.ageGroupOption,
                        {
                          borderColor: isSelected ? accentColor : borderColor,
                          backgroundColor: isSelected ? withOpacity(accentColor, 0.1) : surfaceColor,
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={styles.ageGroupContent}>
                        <View
                          style={[
                            styles.radio,
                            {
                              borderColor: isSelected ? accentColor : borderColor,
                              backgroundColor: isSelected ? accentColor : 'transparent',
                            },
                          ]}
                        >
                          {isSelected && (
                            <View style={styles.radioInner} />
                          )}
                        </View>
                        <AppText
                          variant="ui"
                          style={[
                            styles.ageGroupLabel,
                            {
                              color: isSelected ? accentColor : primaryFontColor,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {group.label}
                        </AppText>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {ageGroup && ageGroup === '13-17' && (
              <View style={styles.warningContainer}>
                <AppText variant="small" style={[styles.warningText, { color: errorColor }]}>
                  ⚠️ You must have parental consent if you are under 18 years old.
                </AppText>
              </View>
            )}

            <View style={styles.consentSection}>
              <TouchableOpacity
                onPress={() => setConsentAccepted(!consentAccepted)}
                style={styles.consentRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentAccepted }}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: consentAccepted ? accentColor : borderColor,
                      backgroundColor: consentAccepted ? accentColor : 'transparent',
                    },
                  ]}
                >
                  {consentAccepted && (
                    <Icon name="check" color={surfaceColor} size={16} />
                  )}
                </View>
                <View style={styles.consentTextContainer}>
                  <AppText variant="small" style={[styles.consentText, { color: primaryFontColor }]}>
                    I accept the{' '}
                    <AppText
                      variant="small"
                      style={[styles.consentLink, { color: accentColor }]}
                      onPress={handleViewTerms}
                    >
                      Terms & Conditions
                    </AppText>
                    {' '}and{' '}
                    <AppText
                      variant="small"
                      style={[styles.consentLink, { color: accentColor }]}
                      onPress={handleViewPrivacy}
                    >
                      Privacy Policy
                    </AppText>
                  </AppText>
                </View>
              </TouchableOpacity>
            </View>

            {error ? <AppText variant="small" style={[styles.error, { color: errorColor }]}>{error}</AppText> : null}

            <PrimaryButton
              label="Continue"
              onPress={handleSubmit}
              loading={loading}
              disabled={isSubmitDisabled}
              style={styles.continueButton}
            />
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
    gap: 12,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  ageGroupContainer: {
    gap: 12,
  },
  ageGroupOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
  },
  ageGroupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  ageGroupLabel: {
    fontSize: 16,
    flex: 1,
  },
  warningContainer: {
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(179, 58, 58, 0.1)',
  },
  warningText: {
    textAlign: 'center',
  },
  consentSection: {
    marginTop: 20,
    marginBottom: 24,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
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
    fontSize: 14,
    lineHeight: 20,
  },
  consentLink: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  error: {
    marginTop: 8,
    textAlign: 'center',
  },
  continueButton: {
    marginTop: 24,
  },
});

export default AgeVerificationScreen;

