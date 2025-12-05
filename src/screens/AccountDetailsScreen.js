import React, { useState, useEffect, useMemo } from 'react';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import AppText from '../components/AppText';
import ScreenContainer from '../components/ScreenContainer';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';

function AccountDetailsScreen({ navigation }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { state, setState } = useAppState();
  const user = state.currentUser;

  const [accountDraft, setAccountDraft] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [confirmation, setConfirmation] = useState(null);

  const primaryFont = colors.primaryFont || '#220707';
  const accent = colors.accent || '#6F171F';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const successColor = colors.success || '#4B7A57';

  useEffect(() => {
    if (user) {
      setAccountDraft({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (!confirmation) {
      return undefined;
    }
    const timeout = setTimeout(() => setConfirmation(null), 3200);
    return () => clearTimeout(timeout);
  }, [confirmation]);

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
    setConfirmation('Account details updated');
    
    // Navigate back after a brief delay
    setTimeout(() => {
      if (navigation.goBack) {
        navigation.goBack();
      }
    }, 1500);
  };

  return (
    <ScreenContainer scroll={false} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back to Profile"
        >
          <Icon name="chevronRight" color={primaryFont} style={styles.backIcon} size={24} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Account Details</AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <AppText style={[styles.subtitle, { color: secondaryFont }]}>
          Update how your name and email appear across the app.
        </AppText>

        <View style={styles.formSection}>
          <FormField
            label="Full name"
            value={accountDraft.name}
            onChangeText={(value) =>
              setAccountDraft((prev) => ({
                ...prev,
                name: value,
              }))
            }
            placeholder="Enter your full name"
            autoCapitalize="words"
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
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Age Group Display (read-only) */}
          <View style={styles.readOnlyField}>
            <AppText style={[styles.readOnlyLabel, { color: secondaryFont }]}>Age group</AppText>
            <AppText style={[styles.readOnlyValue, { color: primaryFont }]}>
              {user?.age_group || '—'}
            </AppText>
            <AppText style={[styles.readOnlyHint, { color: secondaryFont }]}>
              Age group cannot be changed
            </AppText>
          </View>

          {confirmation ? (
            <AppText style={[styles.successText, { color: successColor }]}>{confirmation}</AppText>
          ) : null}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Save Changes"
            onPress={handleSaveAccountDetails}
            accessibilityLabel="Save account details"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors) => StyleSheet.create({
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
    borderBottomColor: withOpacity(colors.border || '#000000', 0.08),
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
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  formSection: {
    gap: 16,
    marginBottom: 24,
  },
  readOnlyField: {
    marginTop: 8,
  },
  readOnlyLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  readOnlyValue: {
    fontSize: 16,
    marginBottom: 4,
  },
  readOnlyHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  actions: {
    marginTop: 8,
  },
});

export default AccountDetailsScreen;

