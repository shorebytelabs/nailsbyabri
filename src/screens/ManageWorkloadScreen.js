/**
 * Manage Workload Screen
 * Admin-only screen for managing weekly order capacity
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import {
  getWeeklyCapacity,
  updateWeeklyCapacity,
  resetCurrentWeekCount,
  createNextWeekCapacity,
  formatNextWeekStartForAdmin,
  getNextWeekStartDateTime,
} from '../services/workloadService';
import PrimaryButton from '../components/PrimaryButton';

function ManageWorkloadScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  const [workloadInfo, setWorkloadInfo] = useState(null);
  const [workloadLoading, setWorkloadLoading] = useState(true);
  const [capacityInput, setCapacityInput] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [resettingWeek, setResettingWeek] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadWorkloadInfo();
  }, [isAdmin, navigation]);

  const loadWorkloadInfo = useCallback(async () => {
    try {
      setWorkloadLoading(true);
      const info = await getWeeklyCapacity();
      setWorkloadInfo(info);
      setCapacityInput(String(info.weeklyCapacity));
    } catch (error) {
      console.error('[ManageWorkload] Error loading workload info:', error);
      
      // Check if table doesn't exist
      if (error?.code === 'PGRST205') {
        Alert.alert(
          'Database Migration Required',
          'The workload_capacity table does not exist yet. Please run the SQL migration script in your Supabase SQL Editor:\n\n' +
          'File: docs/supabase-create-workload-capacity.sql\n\n' +
          'After running the script, wait a few seconds for the schema cache to refresh, then try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', error?.message || 'Failed to load workload information. Please try again.');
      }
    } finally {
      setWorkloadLoading(false);
    }
  }, []);

  const handleUpdateCapacity = async () => {
    const capacity = parseInt(capacityInput, 10);
    if (isNaN(capacity) || capacity < 1) {
      Alert.alert('Invalid Input', 'Please enter a valid capacity number (minimum 1).');
      return;
    }

    try {
      setSavingCapacity(true);
      await updateWeeklyCapacity(capacity);
      await loadWorkloadInfo();
      Alert.alert('Success', 'Weekly capacity updated');
    } catch (error) {
      console.error('[ManageWorkload] Error updating capacity:', error);
      Alert.alert('Error', error.message || 'Failed to update capacity. Please try again.');
    } finally {
      setSavingCapacity(false);
    }
  };

  const handleResetWeekCount = async () => {
    Alert.alert(
      'Reset Week Count',
      'This will reset the current week\'s order count to 0. This is useful for testing weekly resets.\n\n' +
      'Note: This only resets the count for the current week. The capacity setting will remain unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setResettingWeek(true);
              await resetCurrentWeekCount();
              await loadWorkloadInfo();
              Alert.alert('Success', 'Week count reset to 0');
            } catch (error) {
              console.error('[ManageWorkload] Error resetting week count:', error);
              Alert.alert('Error', error.message || 'Failed to reset week count. Please try again.');
            } finally {
              setResettingWeek(false);
            }
          },
        },
      ]
    );
  };

  const handleCreateNextWeek = async () => {
    Alert.alert(
      'Create Next Week',
      'This will create a capacity record for next week (starting Monday). This simulates what happens when the week automatically resets.\n\n' +
      'The next week will inherit the current week\'s capacity setting and start with 0 orders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            try {
              setResettingWeek(true);
              await createNextWeekCapacity();
              await loadWorkloadInfo();
              Alert.alert('Success', 'Next week capacity created');
            } catch (error) {
              console.error('[ManageWorkload] Error creating next week:', error);
              Alert.alert('Error', error.message || 'Failed to create next week. Please try again.');
            } finally {
              setResettingWeek(false);
            }
          },
        },
      ]
    );
  };

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';
  const warningColor = colors.warning || '#FF9800';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronRight" color={primaryFont} size={20} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Manage Workload</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {workloadLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={accent} />
          <AppText style={[styles.loadingText, { color: secondaryFont }]}>Loading workload information...</AppText>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.section}>
            <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Weekly Capacity</AppText>

            {workloadInfo ? (
              <View style={[styles.infoCard, { backgroundColor: surface, borderColor: withOpacity(borderColor, 0.5) }]}>
                <View style={styles.statRow}>
                  <AppText style={[styles.statLabel, { color: secondaryFont }]}>Current Weekly Capacity:</AppText>
                  <AppText style={[styles.statValue, { color: primaryFont }]}>
                    {workloadInfo.weeklyCapacity} orders
                  </AppText>
                </View>
                <View style={styles.statRow}>
                  <AppText style={[styles.statLabel, { color: secondaryFont }]}>Orders Submitted This Week:</AppText>
                  <AppText style={[styles.statValue, { color: primaryFont }]}>
                    {workloadInfo.ordersCount}
                  </AppText>
                </View>
                <View style={styles.statRow}>
                  <AppText style={[styles.statLabel, { color: secondaryFont }]}>Remaining Capacity:</AppText>
                  <AppText
                    style={[
                      styles.statValue,
                      {
                        color:
                          workloadInfo.remaining <= 3
                            ? warningColor
                            : workloadInfo.remaining <= 0
                            ? colors.error || '#B33A3A'
                            : accent,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {workloadInfo.remaining} orders
                  </AppText>
                </View>
                <View style={styles.statRow}>
                  <AppText style={[styles.statLabel, { color: secondaryFont }]}>Current Week Start:</AppText>
                  <AppText style={[styles.statValue, { color: primaryFont }]}>
                    {workloadInfo.weekStart
                      ? new Date(workloadInfo.weekStart).toLocaleDateString() + ' at 9:00 AM PST'
                      : '—'}
                  </AppText>
                </View>
                <View style={styles.statRow}>
                  <AppText style={[styles.statLabel, { color: secondaryFont }]}>Next Week Opens:</AppText>
                  <AppText style={[styles.statValue, { color: primaryFont, fontWeight: '700' }]}>
                    {workloadInfo.nextWeekStart
                      ? formatNextWeekStartForAdmin(getNextWeekStartDateTime())
                      : '—'}
                  </AppText>
                </View>
              </View>
            ) : null}

            <View style={[styles.editSection, { borderColor: withOpacity(borderColor, 0.3) }]}>
              <AppText style={[styles.formLabel, { color: primaryFont }]}>Update Weekly Capacity</AppText>
              <View style={styles.capacityInputRow}>
                <TextInput
                  style={[
                    styles.capacityInput,
                    {
                      borderColor: withOpacity(borderColor, 0.5),
                      color: primaryFont,
                      backgroundColor: surface,
                    },
                  ]}
                  value={capacityInput}
                  onChangeText={setCapacityInput}
                  placeholder="50"
                  keyboardType="number-pad"
                />
                <PrimaryButton
                  label={savingCapacity ? 'Saving...' : 'Save'}
                  onPress={handleUpdateCapacity}
                  disabled={savingCapacity || !capacityInput.trim()}
                  style={styles.saveButton}
                />
              </View>
              <AppText style={[styles.helpText, { color: secondaryFont }]}>
                Set how many orders can be accepted per week. Capacity resets automatically each Monday at 9:00 AM PST.
              </AppText>
            </View>

            {/* Testing/Admin Controls */}
            <View style={[styles.testingSection, { borderColor: withOpacity(borderColor, 0.3) }]}>
              <AppText style={[styles.testingSectionTitle, { color: primaryFont }]}>
                Testing Controls
              </AppText>
              <AppText style={[styles.helpText, { color: secondaryFont, marginBottom: 12 }]}>
                Use these controls to test weekly reset behavior without waiting for Monday.
              </AppText>
              <View style={styles.testingButtonsRow}>
                <TouchableOpacity
                  onPress={handleResetWeekCount}
                  disabled={resettingWeek || workloadLoading}
                  style={[
                    styles.testingButton,
                    {
                      backgroundColor: withOpacity(warningColor, 0.1),
                      borderColor: withOpacity(warningColor, 0.3),
                    },
                  ]}
                >
                  <AppText style={[styles.testingButtonText, { color: warningColor }]}>
                    {resettingWeek ? 'Resetting...' : 'Reset Week Count'}
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateNextWeek}
                  disabled={resettingWeek || workloadLoading}
                  style={[
                    styles.testingButton,
                    {
                      backgroundColor: withOpacity(accent, 0.1),
                      borderColor: withOpacity(accent, 0.3),
                    },
                  ]}
                >
                  <AppText style={[styles.testingButtonText, { color: accent }]}>
                    {resettingWeek ? 'Creating...' : 'Create Next Week'}
                  </AppText>
                </TouchableOpacity>
              </View>
              <AppText style={[styles.helpText, { color: secondaryFont, fontSize: 11, marginTop: 8 }]}>
                Reset Week Count: Sets current week's order count to 0.{'\n'}
                Create Next Week: Creates next week's capacity record (simulates Monday reset).
              </AppText>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors) {
  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';

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
      borderBottomColor: withOpacity(colors.shadow || '#000000', 0.08),
    },
    backButton: {
      padding: 8,
      transform: [{ rotate: '180deg' }],
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    headerSpacer: {
      width: 36,
    },
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      marginTop: 8,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
    },
    section: {
      gap: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    infoCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 14,
      flex: 1,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    editSection: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
    },
    formLabel: {
      fontSize: 16,
      fontWeight: '600',
    },
    capacityInputRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    capacityInput: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 16,
    },
    saveButton: {
      minWidth: 100,
    },
    helpText: {
      fontSize: 13,
      lineHeight: 18,
    },
    testingSection: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
    },
    testingSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    testingButtonsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    testingButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    testingButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
}

export default ManageWorkloadScreen;

