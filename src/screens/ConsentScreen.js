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
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme?.colors?.secondaryBackground || styles.header.backgroundColor,
            borderRadius: 12,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            { color: theme?.colors?.primaryFont || styles.title.color },
          ]}
        >
          Parent or Guardian Approval
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: theme?.colors?.secondaryFont || styles.subtitle.color },
          ]}
        >
          Please review the child&apos;s account information and confirm consent using the secure token we sent.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Child Account</Text>
        <InfoRow label="Name" value={user.name} />
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Date of Birth" value={user.dob} />
        <InfoRow label="Age" value={String(user.age)} />
        {user.parentEmail ? <InfoRow label="Parent Email" value={user.parentEmail} /> : null}
        {user.parentPhone ? <InfoRow label="Parent Phone" value={user.parentPhone} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Consent Request</Text>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label="Approve Consent"
        onPress={handleSubmit}
        loading={loading}
        disabled={!token.trim()}
      />

      <TouchableOpacity onPress={onBackToLogin} style={styles.switchRow}>
        <Text style={styles.switchText}>Consent granted already? </Text>
        <Text style={styles.switchLink}>Return to Log In</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#15133d',
  },
  subtitle: {
    marginTop: 8,
    color: '#484b7a',
    fontSize: 15,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e1e4ff',
  },
  cardTitle: {
    fontWeight: '600',
    color: '#272b75',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#5c5f8d',
    fontWeight: '500',
  },
  infoValue: {
    color: '#272b75',
    fontWeight: '600',
  },
  form: {
    marginBottom: 16,
  },
  error: {
    color: '#b00020',
    marginBottom: 16,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  switchText: {
    color: '#333',
  },
  switchLink: {
    color: '#272b75',
    fontWeight: '600',
  },
});

export default ConsentScreen;

