import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { submitConsent } from '../services/api';
import { useTheme } from '../theme';

function ConsentScreen({ user, consentLog, consentToken, onConsentComplete, onBackToLogin }) {
  const [token, setToken] = useState(consentToken || '');
  const [approverName, setApproverName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const accentColor = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await submitConsent({
        token,
        approverName: approverName || undefined,
      });
      onConsentComplete(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to approve consent.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: secondaryBackgroundColor }]}>
        <Text style={[styles.title, { color: primaryFontColor }]}>
          Parent or Guardian Approval
        </Text>
        <Text style={[styles.subtitle, { color: secondaryFontColor }]}>
          Please review the child&apos;s account information and confirm consent using the secure token we sent.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
        <Text style={[styles.cardTitle, { color: primaryFontColor }]}>Child Account</Text>
        <InfoRow label="Name" value={user.name} />
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Date of Birth" value={user.dob} />
        <InfoRow label="Age" value={String(user.age)} />
        {user.parentEmail ? <InfoRow label="Parent Email" value={user.parentEmail} /> : null}
        {user.parentPhone ? <InfoRow label="Parent Phone" value={user.parentPhone} /> : null}
      </View>

      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
        <Text style={[styles.cardTitle, { color: primaryFontColor }]}>Consent Request</Text>
        <InfoRow label="Channel" value={consentLog.channel.toUpperCase()} />
        {consentLog.contact ? <InfoRow label="Sent To" value={consentLog.contact} /> : null}
        <InfoRow label="Request Date" value={formatDate(consentLog.createdAt)} />
      </View>

      <View style={styles.form}>
        <FormField
          label="Consent Token"
          value={token}
          onChangeText={setToken}
          editable={!consentToken}
          placeholder="Paste the secure token"
        />
        <FormField
          label="Approver Name"
          value={approverName}
          onChangeText={setApproverName}
          placeholder="Parent or guardian full name"
          autoCapitalize="words"
        />
      </View>

      {error ? <Text style={[styles.error, { color: errorColor }]}>{error}</Text> : null}

      <PrimaryButton
        label="Approve Consent"
        onPress={handleSubmit}
        loading={loading}
        disabled={!token.trim()}
      />

      <TouchableOpacity onPress={onBackToLogin} style={styles.switchRow}>
        <Text style={[styles.switchText, { color: secondaryFontColor }]}>
          Consent granted already?{' '}
        </Text>
        <Text style={[styles.switchLink, { color: accentColor }]}>Return to Log In</Text>
      </TouchableOpacity>
    </ScreenContainer>
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
  header: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: '500',
  },
  infoValue: {
    fontWeight: '600',
  },
  form: {
    marginBottom: 16,
  },
  error: {
    marginBottom: 16,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  switchText: {
  },
  switchLink: {
    fontWeight: '600',
  },
});

export default ConsentScreen;

