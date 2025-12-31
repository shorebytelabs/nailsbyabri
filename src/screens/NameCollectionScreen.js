import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { updateUserName } from '../services/authService';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import AppText from '../components/AppText';

function NameCollectionScreen({
  userId,
  onComplete,
  onSkip,
  navigation,
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const onSurfaceColor = colors.onSurface || primaryFontColor;
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const accentColor = colors.accent || '#6F171F';
  const shadowColor = colors.shadow || '#000000';

  const handleContinue = async () => {
    if (loading) {
      return;
    }

    const trimmedName = name.trim();
    
    setLoading(true);
    try {
      // Update profile with name if provided
      if (trimmedName && userId) {
        await updateUserName(userId, trimmedName);
      }
      
      if (onComplete) {
        await onComplete({ name: trimmedName || null });
      }
    } catch (err) {
      // If update fails, still proceed (name is optional)
      if (onComplete) {
        await onComplete({ name: null });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      // Don't update profile if skipped
      if (onSkip || onComplete) {
        await (onSkip || onComplete)({ name: null });
      }
    } finally {
      setLoading(false);
    }
  };

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
                What should we call you?
              </AppText>
              <AppText
                style={[
                  styles.subtitle,
                  { color: withOpacity(onSurfaceColor, 0.75) },
                ]}
              >
                This helps us personalize your experience (optional)
              </AppText>
            </View>

            <View style={styles.section}>
              <FormField
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <PrimaryButton
              label="Continue"
              onPress={handleContinue}
              loading={loading}
              style={styles.continueButton}
            />

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              accessibilityRole="button"
              disabled={loading}
            >
              <AppText variant="ui" style={[styles.skipText, { color: secondaryFontColor }]}>
                Skip for now
              </AppText>
            </TouchableOpacity>
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
    justifyContent: 'center',
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
  continueButton: {
    marginTop: 24,
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NameCollectionScreen;

