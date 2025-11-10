import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import BrandHeader from '../components/navigation/BrandHeader';
import { submitConsent } from '../services/api';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

function ConsentScreen({
  user,
  consentLog,
  consentToken,
  onConsentComplete,
  onBackToLogin,
  onNavigateBack = () => {},
}) {
  const [token, setToken] = useState(consentToken || '');
  const [approverName, setApproverName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimer = useRef(null);
  const [navigateTimeout, setNavigateTimeout] = useState(null);
  const [successPayload, setSuccessPayload] = useState(null);
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const accentColor = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';

  const pendingMessage = useMemo(() => {
    if (!consentLog || consentLog.status !== 'pending') {
      return null;
    }
    const contact = consentLog.contact || user?.parentEmail || user?.parentPhone;
    return `Parental consent pending. We sent a token to ${contact || 'the parent or guardian'}. Once they provide the token, enter it here to continue.`;
  }, [consentLog, user]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
      if (navigateTimeout) {
        clearTimeout(navigateTimeout);
      }
    };
  }, [navigateTimeout]);

  const showToast = (message) => {
    setToastMessage(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await submitConsent({
        token,
        approverName: approverName || undefined,
      });
      setSuccessBanner(true);
      setSuccessPayload(response);
      showToast('Consent approved');
      const timeout = setTimeout(() => {
        onConsentComplete(response);
      }, 2500);
      setNavigateTimeout(timeout);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to approve consent.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissSuccess = () => {
    setSuccessBanner(false);
    if (navigateTimeout) {
      clearTimeout(navigateTimeout);
      setNavigateTimeout(null);
    }
    if (successPayload) {
      onConsentComplete(successPayload);
    } else {
      onConsentComplete({});
    }
  };

  const handleResendToken = () => {
    const contact = consentLog?.contact || user?.parentEmail || user?.parentPhone;
    showToast(`Token resent to ${contact || 'parent/guardian contact'}.`);
  };

  const handleContactSupport = () => {
    const email = user?.parentEmail || consentLog?.contact || 'support@nailsbyabri.com';
    Linking.openURL(`mailto:${email}?subject=Consent Assistance`).catch(() => {
      showToast('Unable to open mail app.');
    });
  };

  const backgroundColor = colors.primaryBackground || '#F4EBE3';

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <BrandHeader showCreateButton={false} />

      <View style={[styles.pageHeader, { backgroundColor }]}>
        <TouchableOpacity
          style={styles.backLink}
          onPress={onNavigateBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backText, { color: withOpacity(primaryFontColor, 0.7) }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: primaryFontColor }]}>Parent or Guardian Approval</Text>
      </View>

      <ScreenContainer scroll={false} style={[styles.screen, { backgroundColor }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {pendingMessage ? (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: withOpacity(colors.warning || '#C27A3B', 0.12),
                borderColor: withOpacity(colors.warning || '#C27A3B', 0.4),
              },
            ]}
          >
            <Text style={[styles.bannerText, { color: colors.warning || '#C27A3B' }]}>{pendingMessage}</Text>
            <View style={styles.bannerActions}>
              <TouchableOpacity onPress={handleResendToken} accessibilityRole="button">
                <Text style={[styles.bannerAction, { color: accentColor }]}>Resend token</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleContactSupport} accessibilityRole="button">
                <Text style={[styles.bannerAction, { color: accentColor }]}>Contact support</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {successBanner ? (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: withOpacity(colors.success || '#4B7A57', 0.2),
                borderColor: withOpacity(colors.success || '#4B7A57', 0.5),
              },
            ]}
          >
            <Text style={[styles.bannerText, { color: colors.success || '#4B7A57' }]}>Consent approved successfully — you’re now signed in.</Text>
            <TouchableOpacity onPress={handleDismissSuccess} accessibilityRole="button">
              <Text style={[styles.bannerAction, { color: accentColor }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={[styles.subtitle, { color: withOpacity(primaryFontColor, 0.75) }]}>Please review the child&apos;s account information and confirm consent using the secure token we sent.</Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: surfaceColor,
              borderColor,
              shadowColor: colors.shadow || '#000000',
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: primaryFontColor }]}>Child Account</Text>
          <InfoRow label="Name" value={user.name} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Date of Birth" value={user.dob} />
          <InfoRow label="Age" value={String(user.age)} />
          {user.parentEmail ? <InfoRow label="Parent Email" value={user.parentEmail} /> : null}
          {user.parentPhone ? <InfoRow label="Parent Phone" value={user.parentPhone} /> : null}
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: surfaceColor,
              borderColor,
              shadowColor: colors.shadow || '#000000',
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: primaryFontColor }]}>Consent Request</Text>
          <InfoRow label="Channel" value={consentLog.channel.toUpperCase()} />
          {consentLog.contact ? <InfoRow label="Sent To" value={consentLog.contact} /> : null}
          <InfoRow label="Request Date" value={formatDate(consentLog.createdAt)} />
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: surfaceColor,
              borderColor,
              shadowColor: colors.shadow || '#000000',
              gap: 16,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: primaryFontColor }]}>Consent Approval</Text>
          <FormField
            label="Consent token (sent to parent/guardian email)"
            value={token}
            onChangeText={setToken}
            editable={!consentToken}
            placeholder="Paste the secure token"
            accessibilityLabel="Consent token"
          />
          <Text style={[styles.helperText, { color: withOpacity(primaryFontColor, 0.65) }]}>A one-time code sent to the parent or guardian. Ask them to forward it to you or enter it here.</Text>
          <FormField
            label="Approver Name"
            value={approverName}
            onChangeText={setApproverName}
            placeholder="Parent or guardian full name"
            autoCapitalize="words"
            accessibilityLabel="Approver name"
          />
          <Text style={[styles.helperText, { color: withOpacity(primaryFontColor, 0.65) }]}>Full name of the parent/guardian who approved.</Text>
          {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}
          <PrimaryButton
            label="Approve Consent"
            onPress={handleSubmit}
            loading={loading}
            disabled={!token.trim() || loading}
            accessibilityLabel="Approve consent"
          />
        </View>

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: secondaryFontColor }]}>Consent granted already?</Text>
            <Text style={[styles.footerLink, { color: accentColor }]} onPress={onBackToLogin}> Return to Log In</Text>
          </View>
        </ScrollView>

        {toastMessage ? (
          <View
            style={[
              styles.toast,
              {
                backgroundColor: withOpacity(colors.surface || '#FFFFFF', 0.95),
                borderColor,
                shadowColor: colors.shadow || '#000000',
              },
            ]}
          >
            <Text style={[styles.toastText, { color: primaryFontColor }]}>{toastMessage}</Text>
          </View>
        ) : null}
      </ScreenContainer>
    </View>
  );
}

function InfoRow({ label, value }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const labelColor = colors.secondaryFont || '#5C5F5D';
  const valueColor = colors.primaryFont || '#220707';

  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor }]}>{value || '—'}</Text>
    </View>
  );
}

function formatDate(dateString) {
  if (!dateString) {
    return '—';
  }
  try {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch (error) {
    return dateString;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backLink: {
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  infoValue: {
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  error: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  banner: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  bannerAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toast: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 6,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ConsentScreen;

