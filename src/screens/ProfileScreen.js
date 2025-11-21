import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PrimaryButton from '../components/PrimaryButton';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import ChangePasswordScreen from './ChangePasswordScreen';
import TermsScreen from './TermsScreen';
import PrivacyScreen from './PrivacyScreen';
import AccountDetailsScreen from './AccountDetailsScreen';
import NailSizesScreen from './NailSizesScreen';

function ProfileScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const {
    state,
    handleUpdatePreferences,
    handleLogout,
    setState,
  } = useAppState();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const user = state.currentUser;

  const [activeView, setActiveView] = useState('main'); // 'main', 'changePassword', 'terms', 'privacy', 'account', 'nailSizes'
  const [confirmation, setConfirmation] = useState(null);


  useEffect(() => {
    if (!confirmation) {
      return undefined;
    }
    const timeout = setTimeout(() => setConfirmation(null), 3200);
    return () => clearTimeout(timeout);
  }, [confirmation]);

  if (!user) {
    return null;
  }

  // If activeView is 'changePassword', show the Change Password panel
  if (activeView === 'changePassword') {
    return (
      <ChangePasswordScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  // If activeView is 'terms', show the Terms & Conditions panel
  if (activeView === 'terms') {
    return (
      <TermsScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  // If activeView is 'privacy', show the Privacy Policy panel
  if (activeView === 'privacy') {
    return (
      <PrivacyScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  // If activeView is 'account', show the Account Details panel
  if (activeView === 'account') {
    return (
      <AccountDetailsScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  // If activeView is 'nailSizes', show the Nail Sizes panel
  if (activeView === 'nailSizes') {
    return (
      <NailSizesScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  const memberSince = formatDate(user.memberSince || user.createdAt);

  const handleChangePassword = () => {
    logEvent('profile_change_password');
    setActiveView('changePassword');
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
      onPress: () => {
        logEvent('profile_view_nail_sizes');
        setActiveView('nailSizes');
      },
    },
    {
      key: 'account',
      title: 'Account Details',
      description: 'Email and age group',
      icon: 'info',
      onPress: () => {
        logEvent('profile_view_account_details');
        setActiveView('account');
      },
    },
    {
      key: 'contact',
      title: 'Contact Us',
      description: 'Email support with questions',
      icon: 'mail',
      onPress: handleContact,
    },
    {
      key: 'terms',
      title: 'Terms & Conditions',
      description: 'View our terms and conditions',
      icon: 'fileText',
      onPress: () => {
        logEvent('profile_view_terms');
        setActiveView('terms');
      },
    },
    {
      key: 'privacy',
      title: 'Privacy Policy',
      description: 'View our privacy policy',
      icon: 'shield',
      onPress: () => {
        logEvent('profile_view_privacy');
        setActiveView('privacy');
      },
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
              <Text style={styles.accountMetaText}>
                Member since {memberSince}
              </Text>
            </View>
          </View>
          <PrimaryButton
            label="Edit Details"
            onPress={() => {
              logEvent('profile_edit_details_open');
              setActiveView('account');
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
                <View style={styles.rowAccessory}>
                  <Icon name="chevronRight" color={colors.secondaryFont} />
                </View>
              </TouchableOpacity>
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
    modalScrollView: {
      maxHeight: 300,
    },
    errorText: {
      fontSize: 13,
      marginTop: 8,
      marginBottom: 4,
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

