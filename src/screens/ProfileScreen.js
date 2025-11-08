import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { useTheme } from '../theme';

function ProfileScreen({
  user,
  consentLogs,
  preferences,
  onUpdatePreferences,
  onLogout,
  onRefreshConsentLogs,
  onStartOrder,
  canStartOrder = true,
}) {
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const latestConsent = useMemo(() => {
    if (!consentLogs.length) {
      return null;
    }
    return [...consentLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  }, [consentLogs]);

  const handleSavePreferences = () => {
    setSaving(true);
    Promise.resolve(onUpdatePreferences(localPreferences)).finally(() => {
      setSaving(false);
    });
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
          Welcome, {user.name}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: theme?.colors?.secondaryFont || styles.subtitle.color },
          ]}
        >
          Manage your profile, consent history, and saved preferences.
        </Text>
      </View>

      <PrimaryButton
        label="Start New Order"
        onPress={onStartOrder}
        style={styles.startOrderButton}
        disabled={!canStartOrder}
      />
      {!canStartOrder ? (
        <Text style={styles.helperText}>
          Parental consent must be approved before placing an order.
        </Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Child Profile</Text>
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Date of Birth" value={user.dob} />
        <InfoRow label="Age" value={String(user.age)} />
        <InfoRow label="Consent Status" value={user.pendingConsent ? 'Pending' : 'Approved'} />
        {user.consentedAt ? <InfoRow label="Approved At" value={formatDate(user.consentedAt)} /> : null}
        {user.consentApprover ? <InfoRow label="Approved By" value={user.consentApprover} /> : null}
        {user.parentEmail ? <InfoRow label="Parent Email" value={user.parentEmail} /> : null}
        {user.parentPhone ? <InfoRow label="Parent Phone" value={user.parentPhone} /> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Consent History</Text>
          <TouchableOpacity onPress={onRefreshConsentLogs}>
            <Text style={styles.refreshLink}>Refresh</Text>
          </TouchableOpacity>
        </View>
        {latestConsent ? (
          <InfoRow
            label="Latest Status"
            value={`${latestConsent.status.toUpperCase()} • ${latestConsent.channel.toUpperCase()}`}
          />
        ) : (
          <Text style={styles.emptyText}>No consent activity yet.</Text>
        )}
        <View style={styles.logList}>
          {consentLogs.length ? (
            consentLogs.map((item) => <ConsentListItem key={item.id} log={item} />)
          ) : (
            <Text style={styles.emptyText}>No consent logs recorded.</Text>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Saved Preferences</Text>
        <FormField
          label="Favorite Polish Color"
          value={localPreferences.favoriteColor}
          onChangeText={(value) =>
            setLocalPreferences((prev) => ({ ...prev, favoriteColor: value }))
          }
          placeholder="e.g. Rose Gold"
        />
        <FormField
          label="Preferred Nail Shape"
          value={localPreferences.nailShape}
          onChangeText={(value) => setLocalPreferences((prev) => ({ ...prev, nailShape: value }))}
          placeholder="e.g. Almond"
        />
        <View style={styles.notesField}>
          <Text style={styles.notesLabel}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            numberOfLines={4}
            value={localPreferences.notes}
            onChangeText={(value) => setLocalPreferences((prev) => ({ ...prev, notes: value }))}
            placeholder="Add inspiration ideas or appointment preferences"
            placeholderTextColor="#999"
          />
        </View>
        <PrimaryButton
          label={saving ? 'Saving...' : 'Save Preferences'}
          onPress={handleSavePreferences}
          loading={saving}
        />
      </View>

      <PrimaryButton label="Log Out" onPress={onLogout} style={styles.logoutButton} />
    </ScreenContainer>
  );
}

function ConsentListItem({ log }) {
  return (
    <View style={styles.logItem}>
      <Text style={styles.logText}>
        {log.status.toUpperCase()} via {log.channel.toUpperCase()}
      </Text>
      <Text style={styles.logMeta}>{formatDate(log.createdAt)}</Text>
      {log.approvedAt ? <Text style={styles.logMeta}>Approved at {formatDate(log.approvedAt)}</Text> : null}
      {log.approverName ? <Text style={styles.logMeta}>By {log.approverName}</Text> : null}
    </View>
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

function formatDate(value) {
  if (!value) {
    return '—';
  }
  try {
    const date = new Date(value);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } catch (error) {
    return value;
  }
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
    padding: 16,
  },
  title: {
    fontSize: 26,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '600',
    color: '#272b75',
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
    maxWidth: '60%',
    textAlign: 'right',
  },
  refreshLink: {
    color: '#272b75',
    fontWeight: '600',
  },
  emptyText: {
    color: '#5c5f8d',
  },
  logList: {
    marginTop: 12,
  },
  logItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d9ddff',
  },
  logText: {
    color: '#272b75',
    fontWeight: '600',
  },
  logMeta: {
    color: '#5c5f8d',
    fontSize: 12,
  },
  notesField: {
    marginBottom: 16,
  },
  notesLabel: {
    color: '#333',
    fontWeight: '600',
    marginBottom: 6,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  logoutButton: {
    marginTop: 12,
    backgroundColor: '#b00020',
  },
  startOrderButton: {
    marginBottom: 20,
  },
  helperText: {
    color: '#5c5f8d',
    marginBottom: 12,
  },
});

export default ProfileScreen;

