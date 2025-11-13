import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  View,
} from 'react-native';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import {
  normalizeNailSizes as normalizeStoredNailSizes,
  createEmptySizeValues,
} from '../storage/preferences';

const FINGER_DISPLAY = [
  { key: 'thumb', label: 'Thumb' },
  { key: 'index', label: 'Index' },
  { key: 'middle', label: 'Middle' },
  { key: 'ring', label: 'Ring' },
  { key: 'pinky', label: 'Pinky' },
];

const buildEmptyNailSizes = () => ({
  defaultProfile: {
    id: 'default',
    label: 'My default sizes',
    sizes: createEmptySizeValues(),
  },
  profiles: [],
});

const normalizeNailSizes = (value) =>
  value ? normalizeStoredNailSizes(value) : buildEmptyNailSizes();

function ProfileScreen() {
  const { theme } = useTheme();
  const {
    state,
    handleUpdatePreferences,
    handleLogout,
    refreshConsentLogs,
    setState,
  } = useAppState();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const user = state.currentUser;
  const consentLogs = state.consentLogs || [];

  const [accountDraft, setAccountDraft] = useState(() => ({
    name: user?.name || '',
    email: user?.email || '',
  }));
  const [nailSizesExpanded, setNailSizesExpanded] = useState(false);
  const [consentExpanded, setConsentExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [savingSizes, setSavingSizes] = useState(false);
  const [refreshingConsent, setRefreshingConsent] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [nailSizesDraft, setNailSizesDraft] = useState(() =>
    normalizeNailSizes(state.preferences?.nailSizes),
  );

  useEffect(() => {
    setNailSizesDraft(normalizeNailSizes(state.preferences?.nailSizes));
  }, [state.preferences?.nailSizes]);

  useEffect(() => {
    if (!user) {
      return;
    }
    setAccountDraft({
      name: user.name || '',
      email: user.email || '',
    });
  }, [user]);

  useEffect(() => {
    if (!confirmation) {
      return undefined;
    }
    const timeout = setTimeout(() => setConfirmation(null), 3200);
    return () => clearTimeout(timeout);
  }, [confirmation]);

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

  const statusLabel = user.pendingConsent ? 'Pending approval' : 'Approved';
  const statusTone = user.pendingConsent
    ? colors.warning || '#C27A3B'
    : colors.success || '#4B7A57';
  const memberSince = formatDate(
    user.memberSince || user.createdAt || user.consentedAt,
  );

  const handleDefaultProfileLabelChange = (value) => {
    setNailSizesDraft((prev) => ({
      ...prev,
      defaultProfile: {
        ...prev.defaultProfile,
        label: value,
      },
    }));
  };

  const handleDefaultSizeChange = (finger, value) => {
    setNailSizesDraft((prev) => ({
      ...prev,
      defaultProfile: {
        ...prev.defaultProfile,
        sizes: {
          ...prev.defaultProfile.sizes,
          [finger]: value,
        },
      },
    }));
  };

  const handleProfileNameChange = (profileId, value) => {
    setNailSizesDraft((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              label: value,
            }
          : profile,
      ),
    }));
  };

  const handleProfileSizeChange = (profileId, finger, value) => {
    setNailSizesDraft((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              sizes: {
                ...profile.sizes,
                [finger]: value,
              },
            }
          : profile,
      ),
    }));
  };

  const handleAddSizeProfile = () => {
    setNailSizesExpanded(true);
    const newProfile = {
      id: `profile_${Date.now()}`,
      label: `Additional profile ${nailSizesDraft.profiles.length + 1}`,
      sizes: createEmptySizeValues(),
    };
    setNailSizesDraft((prev) => ({
      ...prev,
      profiles: [...prev.profiles, newProfile],
    }));
    logEvent('profile_add_size_profile');
  };

  const handleRemoveSizeProfile = (profileId) => {
    setNailSizesDraft((prev) => ({
      ...prev,
      profiles: prev.profiles.filter((profile) => profile.id !== profileId),
    }));
    logEvent('profile_remove_size_profile', { profile_id: profileId });
  };

  const handleSaveNailSizes = async () => {
    setSavingSizes(true);
    try {
      const sanitized = normalizeNailSizes(nailSizesDraft);
      const nextPreferences = {
        ...state.preferences,
        nailSizes: sanitized,
      };
      await handleUpdatePreferences(nextPreferences);
      setConfirmation('Nail sizes saved');
      logEvent('profile_save_nail_sizes');
    } finally {
      setSavingSizes(false);
    }
  };

  const handleRefreshConsent = async () => {
    try {
      setRefreshingConsent(true);
      await refreshConsentLogs(user.id);
      setConfirmation('Consent history refreshed');
    } finally {
      setRefreshingConsent(false);
    }
  };

  const handleChangePassword = () => {
    logEvent('profile_change_password');
    Alert.alert(
      'Change Password',
      'Password management is coming soon. Contact support if you need immediate assistance.',
    );
  };

  const handleShippingAddress = () => {
    logEvent('profile_manage_shipping');
    Alert.alert(
      'Shipping Address',
      'Shipping address management will be available soon. Email us at NailsByAbriannaC@gmail.com with any updates.',
    );
  };

  const handleContact = async () => {
    logEvent('profile_contact_support');
    Alert.alert('Contact Support', 'Please email NailsByAbriannaC@gmail.com for assistance.');
  };

  const handleSaveAccountDetails = () => {
    logEvent('profile_edit_details_save', {
      name: accountDraft.name,
      email: accountDraft.email,
    });
    setState((prev) => ({
      ...prev,
      currentUser: {
        ...prev.currentUser,
        name: accountDraft.name,
        email: accountDraft.email,
      },
    }));
    setAccountModalVisible(false);
    setConfirmation('Account details updated');
  };

  const manageRows = [
    {
      key: 'password',
      title: 'Change Password',
      description: 'Update your login password',
      icon: 'lock',
      onPress: handleChangePassword,
    },
    {
      key: 'shipping',
      title: 'Shipping Address',
      description: 'Add or edit where your sets are delivered',
      icon: 'mapPin',
      onPress: handleShippingAddress,
    },
    {
      key: 'nailSizes',
      title: 'Nail Sizes',
      description: 'Manage your nail sizes',
      icon: 'sliders',
      expandable: true,
      expanded: nailSizesExpanded,
      onPress: () => setNailSizesExpanded((prev) => !prev),
    },
    {
      key: 'consent',
      title: 'Consent History',
      description: latestConsent
        ? `Latest: ${latestConsent.status?.toUpperCase()} on ${formatDate(
            latestConsent.createdAt,
          )}`
        : 'View parental consent activity',
      icon: 'shield',
      expandable: true,
      expanded: consentExpanded,
      onPress: () => setConsentExpanded((prev) => !prev),
    },
    {
      key: 'account',
      title: 'Account Details',
      description: 'Email, birthdate, age, consent status',
      icon: 'info',
      expandable: true,
      expanded: detailsExpanded,
      onPress: () => setDetailsExpanded((prev) => !prev),
    },
    {
      key: 'contact',
      title: 'Contact Us',
      description: 'Email support with questions',
      icon: 'mail',
      onPress: handleContact,
    },
  ];

  const DetailRow = ({ label, value, isLast = false }) => (
    <View
      style={[
        styles.detailRow,
        !isLast && styles.detailRowDivider,
      ]}
    >
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.primaryBackground }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>My Profile</Text>
          <Text style={styles.pageSubtitle}>
            Manage your account, nail sizes, and history
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardLeadingIcon}>
              <Icon name="profile" color={colors.accent} size={28} />
            </View>
            <View style={styles.cardHeaderContent}>
              <Text style={styles.accountName}>{user.name}</Text>
              <Text style={styles.accountEmail}>{user.email}</Text>
              <View style={styles.accountMetaRow}>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: withOpacity(statusTone, 0.12) },
                  ]}
                >
                  <Text style={[styles.statusPillText, { color: statusTone }]}>
                    {statusLabel}
                  </Text>
                </View>
                <Text style={styles.accountMetaText}>
                  Member since {memberSince}
                </Text>
              </View>
            </View>
          </View>
          <PrimaryButton
            label="Edit Details"
            onPress={() => {
              logEvent('profile_edit_details_open');
              setAccountModalVisible(true);
            }}
            style={styles.editButton}
            accessibilityLabel="Edit your profile details"
          />
        </View>

        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Manage Account</Text>
          </View>
          {manageRows.map((item, index) => (
            <View key={item.key}>
              <TouchableOpacity
                onPress={item.onPress}
                accessible
                accessibilityRole="button"
                accessibilityLabel={item.title}
                accessibilityHint={item.description}
                accessibilityState={
                  item.expandable
                    ? { expanded: Boolean(item.expanded) }
                    : undefined
                }
                style={[
                  styles.listRow,
                  index === 0 && styles.listRowFirst,
                ]}
                activeOpacity={0.75}
              >
                <View style={styles.rowIcon}>
                  <Icon name={item.icon} color={colors.accent} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.rowDescription}>{item.description}</Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.rowAccessory,
                    item.expandable && item.expanded && styles.rowAccessoryExpanded,
                  ]}
                >
                  <Icon name="chevronRight" color={colors.secondaryFont} />
                </View>
              </TouchableOpacity>
              {item.expandable && item.expanded ? (
                <View style={styles.rowExpansion}>
                  {item.key === 'nailSizes' ? (
                    <View style={styles.nailSizesSection}>
                      <View style={styles.sizeSectionHeader}>
                        <Text style={styles.sectionTitle}>Default nail sizes</Text>
                      </View>
                      {renderSizeProfileCard({
                        profile: nailSizesDraft.defaultProfile,
                        colors,
                        styles,
                        isDefault: true,
                        onChangeLabel: handleDefaultProfileLabelChange,
                        onChangeSize: handleDefaultSizeChange,
                      })}

                      <View style={styles.sizeSectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Additional profiles</Text>
                        <Text style={styles.sizeSectionHint}>
                          Save additional nail sizes.
                        </Text>
                      </View>
                      {nailSizesDraft.profiles.length
                        ? nailSizesDraft.profiles.map((profile) =>
                            renderSizeProfileCard({
                              profile,
                              colors,
                              styles,
                              isDefault: false,
                              onChangeLabel: (value) => handleProfileNameChange(profile.id, value),
                              onChangeSize: (finger, value) =>
                                handleProfileSizeChange(profile.id, finger, value),
                              onRemove: () => handleRemoveSizeProfile(profile.id),
                            }),
                          )
                        : null}

                      <TouchableOpacity
                        style={[
                          styles.addSizeButton,
                          { borderColor: withOpacity(colors.accent || '#6F171F', 0.3) },
                        ]}
                        onPress={handleAddSizeProfile}
                        accessibilityRole="button"
                      >
                        <Icon name="plus" color={colors.accent} size={16} />
                        <Text
                          style={[
                            styles.addSizeButtonText,
                            { color: colors.accent },
                          ]}
                        >
                          Add size profile
                        </Text>
                      </TouchableOpacity>

                      <PrimaryButton
                        label={savingSizes ? 'Saving…' : 'Save Nail Sizes'}
                        onPress={handleSaveNailSizes}
                        loading={savingSizes}
                        accessibilityLabel="Save nail size profiles"
                      />
                    </View>
                  ) : null}

                  {item.key === 'consent' ? (
                    <View style={styles.consentSection}>
                      {latestConsent ? (
                        <View
                          style={[
                            styles.consentHighlight,
                            { backgroundColor: withOpacity(colors.accent || '#6F171F', 0.12) },
                          ]}
                        >
                          <Text
                            style={[styles.consentHighlightText, { color: colors.accent || '#6F171F' }]}
                          >
                            Latest: {latestConsent.status?.toUpperCase()} via{' '}
                            {latestConsent.channel?.toUpperCase()} on{' '}
                            {formatDate(latestConsent.createdAt)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.placeholderText}>
                          No consent history yet.
                        </Text>
                      )}

                      <View style={styles.consentActionsRow}>
                        <TouchableOpacity
                          style={styles.inlineActionButton}
                          onPress={handleRefreshConsent}
                          disabled={refreshingConsent}
                          accessibilityRole="button"
                          accessibilityLabel="Refresh consent history"
                        >
                          <Text
                            style={[
                              styles.inlineActionText,
                              refreshingConsent && styles.inlineActionDisabled,
                            ]}
                          >
                            {refreshingConsent ? 'Refreshing…' : 'Refresh'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.consentListLabel}>Recent activity</Text>
                      </View>

                      <View style={styles.logList}>
                        {consentLogs.slice(0, 5).map((log) => (
                          <View
                            key={log.id}
                            style={[
                              styles.logItem,
                              {
                                borderBottomColor: withOpacity(
                                  colors.shadow || '#000000',
                                  0.08,
                                ),
                              },
                            ]}
                          >
                            <Text style={styles.logLine}>
                              {formatDate(log.createdAt)} • {log.status?.toUpperCase()} (
                              {log.channel})
                            </Text>
                          </View>
                        ))}
                        {!consentLogs.length ? (
                          <Text style={styles.placeholderText}>
                            Consent activity will appear here once approved.
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  {item.key === 'account' ? (
                    <View style={styles.detailList}>
                      <DetailRow label="Email" value={user.email} />
                      <DetailRow label="Date of birth" value={user.dob} />
                      <DetailRow label="Age" value={String(user.age)} />
                      <DetailRow
                        label="Consent status"
                        value={user.pendingConsent ? 'Pending approval' : 'Approved'}
                      />
                      <DetailRow label="Approved at" value={formatDate(user.consentedAt)} />
                      <DetailRow
                        label="Approved by"
                        value={user.consentApprover || '—'}
                        isLast
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <PrimaryButton
          label="Log Out"
          onPress={handleLogout}
          style={[
            styles.logoutButton,
            { backgroundColor: colors.error || '#B33A3A' },
          ]}
          accessibilityLabel="Log out of Nails by Abri"
        />
      </ScrollView>

      {confirmation ? (
        <View
          style={[
            styles.toast,
            { backgroundColor: withOpacity(colors.accent || '#6F171F', 0.92) },
          ]}
        >
          <Text style={[styles.toastText, { color: colors.accentContrast || '#FFFFFF' }]}>
            {confirmation}
          </Text>
        </View>
      ) : null}

      <Modal
        visible={accountModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAccountModalVisible(false)}
      >
        <View
          style={[
            styles.modalBackdrop,
            { backgroundColor: withOpacity(colors.shadow || '#000000', 0.35) },
          ]}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface || '#FFFFFF',
                borderColor: withOpacity(colors.divider || '#E6DCD0', 0.6),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Details</Text>
              <Text style={styles.modalSubtitle}>
                Update how your name and email appear across the app.
              </Text>
            </View>
            <FormField
              label="Full name"
              value={accountDraft.name}
              onChangeText={(value) =>
                setAccountDraft((prev) => ({
                  ...prev,
                  name: value,
                }))
              }
            />
            <FormField
              label="Email"
              value={accountDraft.email}
              onChangeText={(value) =>
                setAccountDraft((prev) => ({
                  ...prev,
                  email: value,
                }))
              }
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <PrimaryButton
                label="Save Changes"
                onPress={handleSaveAccountDetails}
                accessibilityLabel="Save account details"
              />
              <TouchableOpacity
                onPress={() => setAccountModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel editing account details"
                style={styles.modalSecondaryButton}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function renderSizeProfileCard({
  profile,
  colors,
  styles,
  isDefault,
  onChangeLabel,
  onChangeSize,
  onRemove,
}) {
  return (
    <View
      key={profile.id}
      style={[
        styles.sizeProfileCard,
        {
          borderColor: withOpacity(colors.divider || '#E6DCD0', 0.8),
          backgroundColor: colors.surface || '#FFFFFF',
        },
      ]}
    >
      <View style={styles.sizeProfileHeader}>
        <View style={styles.sizeProfileHeaderText}>
          <Text style={styles.sizeProfileTitle}>
            {isDefault ? 'Default profile' : 'Additional profile'}
          </Text>
        </View>
        {!isDefault && (
          <TouchableOpacity
            onPress={onRemove}
            accessibilityRole='button'
            style={styles.sizeRemoveButton}
          >
            <Icon name="trash" color={withOpacity(colors.primaryFont || '#220707', 0.6)} size={16} />
            <Text
              style={[
                styles.sizeRemoveText,
                { color: withOpacity(colors.primaryFont || '#220707', 0.6) },
              ]}
            >
              Remove
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={[
          styles.sizeProfileNameInput,
          {
            borderColor: colors.divider || '#E6DCD0',
            color: colors.primaryFont || '#220707',
            backgroundColor: colors.surfaceMuted || withOpacity(colors.accent || '#6F171F', 0.05),
          },
        ]}
        value={profile.label}
        onChangeText={onChangeLabel}
        placeholder={isDefault ? 'My default sizes' : 'Profile name'}
        placeholderTextColor={withOpacity(colors.secondaryFont || '#5C5F5D', 0.6)}
      />

      <View style={styles.sizeGrid}>
        {FINGER_DISPLAY.map(({ key, label }) => (
          <View key={`${profile.id}_${key}`} style={styles.sizeCell}>
            <Text style={[styles.sizeLabel, { color: colors.secondaryFont || '#5C5F5D' }]}>
              {label}
            </Text>
            <TextInput
              style={[
                styles.sizeInput,
                {
                  borderColor: colors.divider || '#E6DCD0',
                  color: colors.primaryFont || '#220707',
                  backgroundColor: colors.surface || '#FFFFFF',
                },
              ]}
              value={profile.sizes?.[key] || ''}
              onChangeText={(value) => onChangeSize(key, value)}
              placeholder="e.g. 3"
              placeholderTextColor={withOpacity(colors.secondaryFont || '#5C5F5D', 0.5)}
              keyboardType="number-pad"
            />
          </View>
        ))}
      </View>
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

function createStyles(colors) {
  const primaryFont = colors.primaryFont || '#354037';
  const secondaryFont = colors.secondaryFont || '#767154';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.divider || '#E6DCD0';

  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      gap: 20,
    },
    pageHeader: {
      gap: 6,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: primaryFont,
    },
    pageSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: secondaryFont,
    },
    card: {
      borderRadius: 20,
      backgroundColor: surface,
      padding: 20,
      gap: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor,
      shadowColor: colors.shadow || '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    cardLeadingIcon: {
      height: 44,
      width: 44,
      borderRadius: 22,
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardHeaderContent: {
      flex: 1,
      gap: 6,
    },
    accountName: {
      fontSize: 20,
      fontWeight: '700',
      color: primaryFont,
    },
    accountEmail: {
      fontSize: 14,
      color: secondaryFont,
    },
    accountMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      alignItems: 'center',
    },
    accountMetaText: {
      fontSize: 12,
      color: secondaryFont,
    },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    editButton: {
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    listCard: {
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor,
      backgroundColor: surface,
      overflow: 'hidden',
      shadowColor: colors.shadow || '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    listHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: primaryFont,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: borderColor,
      backgroundColor: surface,
    },
    listRowFirst: {
      borderTopWidth: 0,
    },
    rowIcon: {
      height: 32,
      width: 32,
      borderRadius: 16,
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.08),
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: primaryFont,
    },
    rowDescription: {
      fontSize: 13,
      color: secondaryFont,
      lineHeight: 18,
    },
    rowAccessory: {
      marginLeft: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowAccessoryExpanded: {
      transform: [{ rotate: '90deg' }],
    },
    rowExpansion: {
      backgroundColor:
        colors.surfaceMuted || withOpacity(colors.accent || '#6F171F', 0.04),
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: borderColor,
    },
    nailSizesSection: {
      gap: 18,
    },
    sizeSectionHeader: {
      gap: 6,
    },
    sizeSectionHeaderRow: {
      gap: 2,
    },
    sizeSectionHint: {
      fontSize: 12,
      color: secondaryFont,
    },
    sizeProfileCard: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 18,
      padding: 16,
      gap: 16,
    },
    sizeProfileHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    sizeProfileHeaderText: {
      flex: 1,
      gap: 4,
    },
    sizeProfileTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: primaryFont,
    },
    sizeProfileNameInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontWeight: '600',
    },
    sizeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    sizeCell: {
      width: '30%',
      minWidth: 96,
      gap: 4,
    },
    sizeLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    sizeInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    sizeRemoveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    sizeRemoveText: {
      fontSize: 12,
      fontWeight: '600',
    },
    addSizeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      paddingVertical: 10,
    },
    addSizeButtonText: {
      fontSize: 13,
      fontWeight: '700',
    },
    consentSection: {
      gap: 12,
    },
    consentHighlight: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    consentHighlightText: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
    },
    placeholderText: {
      fontSize: 13,
      color: secondaryFont,
    },
    consentActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    inlineActionButton: {
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    inlineActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent || '#6F171F',
    },
    inlineActionDisabled: {
      opacity: 0.5,
    },
    consentListLabel: {
      fontSize: 12,
      color: secondaryFont,
    },
    logList: {
      gap: 8,
    },
    logItem: {
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    logLine: {
      fontSize: 12,
      color: secondaryFont,
      lineHeight: 18,
    },
    detailList: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor,
      overflow: 'hidden',
      backgroundColor: surface,
    },
    detailRow: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    detailRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderColor,
    },
    detailLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: primaryFont,
      marginBottom: 4,
    },
    detailValue: {
      fontSize: 13,
      color: secondaryFont,
    },
    logoutButton: {
      marginTop: 8,
    },
    toast: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 24,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 14,
      shadowColor: colors.shadow || '#000000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      alignItems: 'center',
    },
    toastText: {
      fontSize: 13,
      fontWeight: '600',
    },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      padding: 24,
      gap: 16,
      borderWidth: StyleSheet.hairlineWidth,
      shadowColor: colors.shadow || '#000000',
      shadowOpacity: 0.2,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    modalHeader: {
      gap: 6,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: primaryFont,
    },
    modalSubtitle: {
      fontSize: 13,
      color: secondaryFont,
      lineHeight: 18,
    },
    modalActions: {
      gap: 12,
      marginTop: 12,
    },
    modalSecondaryButton: {
      alignSelf: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    modalSecondaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent || '#6F171F',
    },
  });
}

export default ProfileScreen;

