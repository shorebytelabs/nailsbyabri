import React, { useState, useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PrimaryButton from './PrimaryButton';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import { supabase } from '../lib/supabaseClient';

/**
 * ConsentModal - Modal that blocks access until user accepts Terms & Conditions and Privacy Policy
 * @param {Object} props
 * @param {boolean} props.visible - Whether the modal is visible
 * @param {Object} props.user - User object with id, email, name
 * @param {boolean} props.missingTerms - Whether Terms consent is missing
 * @param {boolean} props.missingPrivacy - Whether Privacy consent is missing
 * @param {Function} props.onConsentAccepted - Callback when consent is accepted
 * @param {Function} props.onViewTerms - Callback to view Terms & Conditions
 * @param {Function} props.onViewPrivacy - Callback to view Privacy Policy
 */
function ConsentModal({
  visible,
  user,
  missingTerms = false,
  missingPrivacy = false,
  onConsentAccepted,
  onViewTerms,
  onViewPrivacy,
}) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const primaryFont = colors.primaryFont || '#220707';
  const accent = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const secondaryFont = colors.secondaryFont || '#5C5F5D';

  const handleAccept = async () => {
    if (!consentAccepted) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    if (!user?.id) {
      setError('User information is missing. Please log out and log back in.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const updateData = {};

      // Only update missing consents
      if (missingTerms) {
        updateData.terms_accepted_at = now;
      }
      if (missingPrivacy) {
        updateData.privacy_accepted_at = now;
      }

      // Verify we have an active session before attempting update
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!session || sessionError) {
        throw new Error('No active session. Please log in and try again.');
      }

      // Verify the user ID matches the session
      if (session.user.id !== user.id) {
        throw new Error('User ID mismatch. Please log out and log back in.');
      }

      // Update profile with consent timestamps
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) {
        if (updateError.code === '42501') {
          throw new Error('Permission denied. The database policy is blocking this update. Please contact support.');
        }
        throw updateError;
      }

      if (__DEV__) {
        console.log('[ConsentModal] ✅ Consent accepted and saved');
      }

      // Call success callback
      if (onConsentAccepted) {
        onConsentAccepted();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save consent. Please try again.';
      setError(message);
      if (__DEV__) {
        console.error('[ConsentModal] ❌ Failed to save consent:', err);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}} // Prevent closing without accepting
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: surface, borderColor }]}>
          <View style={styles.header}>
            <Icon name="alertCircle" color={accent} size={32} />
            <Text style={[styles.title, { color: primaryFont }]}>Legal Consent Required</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            <Text style={[styles.message, { color: primaryFont }]}>
              To continue using the app, you must accept our Terms & Conditions and Privacy Policy.
            </Text>

            {(missingTerms || missingPrivacy) && (
              <View style={styles.missingInfo}>
                <Text style={[styles.missingTitle, { color: primaryFont }]}>Missing consent:</Text>
                {missingTerms && (
                  <Text style={[styles.missingItem, { color: secondaryFont }]}>
                    • Terms & Conditions
                  </Text>
                )}
                {missingPrivacy && (
                  <Text style={[styles.missingItem, { color: secondaryFont }]}>
                    • Privacy Policy
                  </Text>
                )}
              </View>
            )}

            <View style={[styles.consentContainer, { backgroundColor: withOpacity(colors.secondaryBackground || '#E7D8CA', 0.3), borderColor: accent }]}>
              <Text style={[styles.instructionText, { color: accent }]}>
                Tap to check the box and accept:
              </Text>
              
              <TouchableOpacity
                style={[styles.checkboxRow, { backgroundColor: surface, borderRadius: 12, padding: 16 }]}
                onPress={() => setConsentAccepted(!consentAccepted)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentAccepted }}
                accessibilityLabel="I agree to the Terms & Conditions and Privacy Policy"
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: consentAccepted ? accent : surface,
                      borderColor: accent,
                      borderWidth: consentAccepted ? 0 : 3,
                    },
                  ]}
                >
                  {consentAccepted && (
                    <Icon name="check" color="#FFFFFF" size={26} />
                  )}
                </View>
                <View style={styles.consentTextContainer}>
                  <Text style={[styles.consentText, { color: primaryFont }]}>
                    I agree to the{' '}
                    <Text
                      style={[styles.consentLink, { color: accent }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (onViewTerms) {
                          onViewTerms();
                        }
                      }}
                      accessibilityRole="link"
                      accessibilityLabel="View Terms & Conditions"
                    >
                      Terms & Conditions
                    </Text>
                    {' '}and{' '}
                    <Text
                      style={[styles.consentLink, { color: accent }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (onViewPrivacy) {
                          onViewPrivacy();
                        }
                      }}
                      accessibilityRole="link"
                      accessibilityLabel="View Privacy Policy"
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {error ? (
              <Text style={[styles.error, { color: errorColor }]}>{error}</Text>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <PrimaryButton
              label="Accept & Continue"
              onPress={handleAccept}
              loading={saving}
              disabled={!consentAccepted || saving}
              style={styles.acceptButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    minHeight: 480,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 20,
    minHeight: 320,
  },
  message: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 24,
    fontWeight: '500',
  },
  missingInfo: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: withOpacity(colors.secondaryBackground || '#E7D8CA', 0.3),
    borderRadius: 12,
  },
  missingTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  missingItem: {
    fontSize: 14,
    lineHeight: 22,
    marginLeft: 8,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  consentContainer: {
    marginBottom: 24,
    marginTop: 8,
    padding: 24,
    borderRadius: 16,
    borderWidth: 3,
    minHeight: 140,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  checkbox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    flexShrink: 0,
  },
  consentTextContainer: {
    flex: 1,
  },
  consentText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  consentLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  error: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withOpacity(colors.border || '#000000', 0.08),
  },
  acceptButton: {
    width: '100%',
  },
});

export default ConsentModal;

