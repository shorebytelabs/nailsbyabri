import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import AppText from '../components/AppText';
import PrimaryButton from '../components/PrimaryButton';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import { deleteAccount } from '../services/accountDeletionService';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';

function DeleteAccountScreen({ navigation, onDeleteAccount }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const { handleLogout } = useAppState();
  const styles = createStyles(colors);

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const errorColor = colors.error || '#B33A3A';

  const handleDelete = async () => {
    logEvent('profile_delete_account_attempt');
    
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => logEvent('profile_delete_account_cancelled'),
        },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              logEvent('profile_delete_account_confirmed');
              await deleteAccount();
              // User will be automatically signed out by the service
              handleLogout();
            } catch (error) {
              logEvent('profile_delete_account_error');
              Alert.alert(
                'Deletion Failed',
                error.message || 'Unable to delete account. Please contact support if this issue persists.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevronRight" color={primaryFont} style={styles.backIcon} size={24} />
        </TouchableOpacity>
        <AppText variant="ui" style={[styles.headerTitle, { color: primaryFont }]}>
          Delete My Account
        </AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.warningSection}>
          <AppText style={[styles.warningIcon, { color: errorColor }]}>⚠️</AppText>
          <AppText variant="ui" style={[styles.warningTitle, { color: primaryFont }]}>
            This action cannot be undone
          </AppText>
          <AppText style={[styles.warningText, { color: secondaryFont }]}>
            Deleting your account will permanently remove your personal information and cannot be reversed.
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <AppText variant="ui" style={[styles.sectionTitle, { color: primaryFont }]}>
            What will be deleted:
          </AppText>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <AppText style={[styles.bullet, { color: errorColor }]}>•</AppText>
              <AppText style={[styles.listText, { color: primaryFont }]}>
                Your personal information (name, email, phone number)
              </AppText>
            </View>
            <View style={styles.listItem}>
              <AppText style={[styles.bullet, { color: errorColor }]}>•</AppText>
              <AppText style={[styles.listText, { color: primaryFont }]}>
                All saved shipping addresses
              </AppText>
            </View>
            <View style={styles.listItem}>
              <AppText style={[styles.bullet, { color: errorColor }]}>•</AppText>
              <AppText style={[styles.listText, { color: primaryFont }]}>
                Your saved nail size profiles
              </AppText>
            </View>
            <View style={styles.listItem}>
              <AppText style={[styles.bullet, { color: errorColor }]}>•</AppText>
              <AppText style={[styles.listText, { color: primaryFont }]}>
                Your account preferences and settings
              </AppText>
            </View>
            <View style={styles.listItem}>
              <AppText style={[styles.bullet, { color: errorColor }]}>•</AppText>
              <AppText style={[styles.listText, { color: primaryFont }]}>
                Access to your account (you will be logged out permanently)
              </AppText>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: surface, borderColor }]}>
          <AppText variant="ui" style={[styles.sectionTitle, { color: primaryFont }]}>
            What will be kept:
          </AppText>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <Icon name="check" color={colors.success || '#4B7A57'} size={16} />
              <AppText style={[styles.listText, { color: primaryFont }]}>
                Your order history (for tax and business records)
              </AppText>
            </View>
            <View style={styles.listItem}>
              <Icon name="check" color={colors.success || '#4B7A57'} size={16} />
              <AppText style={[styles.listText, { color: primaryFont }]}>
                Order pricing and transaction data
              </AppText>
            </View>
            <View style={styles.listItem}>
              <Icon name="check" color={colors.success || '#4B7A57'} size={16} />
              <AppText style={[styles.listText, { color: primaryFont }]}>
                Order status and fulfillment information
              </AppText>
            </View>
          </View>
          <View style={styles.noteSection}>
            <AppText style={[styles.noteText, { color: secondaryFont }]}>
              Note: Personal information in order records will be anonymized (e.g., addresses will show as "[REDACTED]") to protect your privacy while maintaining business records for tax purposes.
            </AppText>
          </View>
        </View>

        <View style={styles.helpSection}>
          <AppText style={[styles.helpText, { color: secondaryFont }]}>
            Need help or have questions? Contact us at{' '}
            <AppText style={{ color: colors.accent || '#6F171F', textDecorationLine: 'underline' }}>
              NailsByAbriannaC@gmail.com
            </AppText>
          </AppText>
        </View>

        <PrimaryButton
          label="Delete My Account"
          onPress={handleDelete}
          style={[styles.deleteButton, { backgroundColor: errorColor }]}
          accessibilityLabel="Delete account"
        />
      </ScrollView>
    </View>
  );
}

function createStyles(colors) {
  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: borderColor,
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    backIcon: {
      transform: [{ rotate: '180deg' }],
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      flex: 1,
      textAlign: 'center',
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    warningSection: {
      alignItems: 'center',
      padding: 24,
      marginBottom: 24,
      gap: 12,
    },
    warningTitle: {
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    warningText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    card: {
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    list: {
      gap: 12,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    bullet: {
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 20,
      width: 16,
    },
    listText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
    },
    noteSection: {
      marginTop: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: withOpacity(colors.secondaryBackground || '#E7D8CA', 0.5),
    },
    noteText: {
      fontSize: 12,
      lineHeight: 18,
      fontStyle: 'italic',
    },
    helpSection: {
      marginTop: 8,
      marginBottom: 24,
      padding: 16,
      borderRadius: 12,
      backgroundColor: withOpacity(colors.surface || '#FFFFFF', 0.8),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: borderColor,
    },
    helpText: {
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
    },
    deleteButton: {
      marginTop: 8,
    },
  });
}

export default DeleteAccountScreen;

