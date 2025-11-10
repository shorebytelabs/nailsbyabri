import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';

function ProfileScreen() {
  const { theme } = useTheme();
  const {
    state,
    handleUpdatePreferences,
    handleLogout,
    handleStartOrder,
    refreshConsentLogs,
  } = useAppState();
  const colors = theme?.colors || {};
  const {
    primaryBackground,
    secondaryBackground,
    surface,
    surfaceMuted,
    primaryFont,
    secondaryFont,
    accent,
    accentContrast,
    border,
    divider,
    success,
    error,
    warning,
    shadow,
  } = colors;

  const primaryBackgroundColor = primaryBackground || '#F4EBE3';
  const secondaryBackgroundColor = secondaryBackground || '#BF9B7A';
  const surfaceColor = surface || '#FFFFFF';
  const primaryFontColor = primaryFont || '#220707';
  const secondaryFontColor = secondaryFont || '#5C5F5D';
  const accentColor = accent || '#6F171F';
  const borderColor = border || '#D9C8A9';
  const dividerColor = divider || withOpacity('#000000', 0.05);
  const errorColor = error || '#B33A3A';
  const shadowColor = shadow || '#000000';

  const navigation = useNavigation();

  const user = state.currentUser;
  const [localPreferences, setLocalPreferences] = useState(state.preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalPreferences(state.preferences);
  }, [state.preferences]);

  const consentLogs = state.consentLogs || [];

  const latestConsent = useMemo(() => {
    if (!consentLogs.length) {
      return null;
    }
    return [...consentLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  }, [consentLogs]);

  if (!user) {
    return null;
  }

  const triggerSave = async () => {
    setSaving(true);
    await handleUpdatePreferences(localPreferences);
    setSaving(false);
  };

  const handleCreateSet = () => {
    const canProceed = handleStartOrder({ navigation });
    if (canProceed) {
      logEvent('tap_profile_create');
      navigation.navigate('NewOrderFlow');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: primaryBackgroundColor },
      ]}
    >
      <View
        style={[
          styles.hero,
          { backgroundColor: secondaryBackgroundColor },
        ]}
      >
        <Text
          style={[
            styles.heroTitle,
            { color: primaryFontColor },
          ]}
        >
          Welcome back, {user.name}
        </Text>
        <Text
          style={[
            styles.heroSubtitle,
            { color: secondaryFontColor },
          ]}
        >
          Manage your preferences and keep an eye on consent status and saved sets.
        </Text>
        <PrimaryButton
          label="Create a Set"
          onPress={handleCreateSet}
          disabled={Boolean(user.pendingConsent)}
          style={styles.heroButton}
          accessibilityLabel="Create new custom nail set"
        />
        {user.pendingConsent ? (
          <Text
            style={[
              styles.noticeText,
              { color: accentColor },
            ]}
          >
            Parental consent must be approved before placing an order.
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: surfaceColor,
            borderColor: borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.cardTitle,
            { color: primaryFontColor },
          ]}
        >
          Account details
        </Text>
        <InfoRow label="Email" value={user.email} accent={secondaryFontColor} dividerColor={withOpacity(shadowColor, 0.08)} />
        <InfoRow label="Date of birth" value={user.dob} accent={secondaryFontColor} dividerColor={withOpacity(shadowColor, 0.08)} />
        <InfoRow label="Age" value={String(user.age)} accent={secondaryFontColor} dividerColor={withOpacity(shadowColor, 0.08)} />
        <InfoRow
          label="Consent status"
          value={user.pendingConsent ? 'Pending approval' : 'Approved'}
          accent={secondaryFontColor}
          dividerColor={withOpacity(shadowColor, 0.08)}
        />
        {user.consentedAt ? (
          <InfoRow
            label="Approved at"
            value={formatDate(user.consentedAt)}
            accent={secondaryFontColor}
            dividerColor={withOpacity(shadowColor, 0.08)}
          />
        ) : null}
        {user.consentApprover ? (
          <InfoRow
            label="Approved by"
            value={user.consentApprover}
            accent={secondaryFontColor}
            dividerColor={withOpacity(shadowColor, 0.08)}
          />
        ) : null}
        <PrimaryButton
          label="Log out"
          onPress={handleLogout}
          style={[styles.logoutButton, { backgroundColor: errorColor }]}
          accessibilityLabel="Log out of Nails by Abri"
        />
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: surfaceColor,
            borderColor: borderColor,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text
            style={[
              styles.cardTitle,
              { color: primaryFontColor },
            ]}
          >
            Consent history
          </Text>
          <TouchableOpacity
            onPress={() => refreshConsentLogs(user.id)}
            style={styles.refreshButton}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.refreshText,
                { color: accentColor },
              ]}
            >
              Refresh
            </Text>
          </TouchableOpacity>
        </View>
        {latestConsent ? (
          <View
            style={[
              styles.consentHighlight,
              { backgroundColor: withOpacity(accentColor, 0.12) },
            ]}
          >
            <Text
              style={[
                styles.consentHighlightText,
                { color: accentColor },
              ]}
            >
              Latest: {latestConsent.status?.toUpperCase()} via {latestConsent.channel?.toUpperCase()} on {formatDate(latestConsent.createdAt)}
            </Text>
          </View>
        ) : (
          <Text
            style={[
              styles.placeholderText,
              { color: secondaryFontColor },
            ]}
          >
            No consent history yet.
          </Text>
        )}
        <View style={styles.logList}>
          {consentLogs.slice(0, 4).map((log) => (
            <View
              key={log.id}
              style={[styles.logItem, { borderBottomColor: withOpacity(shadowColor, 0.08) }]}
            >
              <Text
                style={[
                  styles.logLine,
                  { color: secondaryFontColor },
                ]}
              >
                {formatDate(log.createdAt)} • {log.status?.toUpperCase()} ({log.channel})
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: surfaceColor,
            borderColor: borderColor,
          },
        ]}
      >
        <Text
          style={[
            styles.cardTitle,
            { color: primaryFontColor },
          ]}
        >
          Saved preferences
        </Text>
        <FormField
          label="Favorite polish color"
          value={localPreferences.favoriteColor}
          onChangeText={(value) =>
            setLocalPreferences((prev) => ({ ...prev, favoriteColor: value }))
          }
          placeholder="e.g. Rose Gold"
        />
        <FormField
          label="Preferred nail shape"
          value={localPreferences.nailShape}
          onChangeText={(value) => setLocalPreferences((prev) => ({ ...prev, nailShape: value }))}
          placeholder="e.g. Almond"
        />
        <View style={styles.notesGroup}>
          <Text
            style={[
              styles.notesLabel,
              { color: primaryFontColor },
            ]}
          >
            Notes
          </Text>
          <TextInput
            value={localPreferences.notes}
            onChangeText={(value) => setLocalPreferences((prev) => ({ ...prev, notes: value }))}
            placeholder="Add inspiration ideas or appointment preferences"
            placeholderTextColor={secondaryFontColor}
            multiline
            style={[
              styles.notesInput,
              {
                borderColor: borderColor,
                color: primaryFontColor,
              },
            ]}
          />
        </View>
        <PrimaryButton
          label={saving ? 'Saving…' : 'Save preferences'}
          onPress={triggerSave}
          loading={saving}
          accessibilityLabel="Save your profile preferences"
        />
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, accent, dividerColor }) {
  const { theme } = useTheme();
  const themeColors = theme?.colors || {};
  const textColor = accent || themeColors.secondaryFont || '#5C5F5D';
  const shadowColor = themeColors.shadow || '#000000';
  const dividerTint = dividerColor || withOpacity(shadowColor, 0.08);

  return (
    <View style={[styles.infoRow, { borderBottomColor: dividerTint }]}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, { color: textColor }]}>{value || '—'}</Text>
    </View>
  );
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 20,
  },
  hero: {
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroButton: {
    alignSelf: 'flex-start',
  },
  noticeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  consentHighlight: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  consentHighlightText: {
    fontSize: 12,
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: 12,
  },
  logList: {
    gap: 8,
  },
  logItem: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logLine: {
    fontSize: 12,
  },
  notesGroup: {
    gap: 8,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    minHeight: 110,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  logoutButton: {
    marginTop: 12,
  },
});

export default ProfileScreen;

