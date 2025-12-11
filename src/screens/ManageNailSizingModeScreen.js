/**
 * Manage Nail Sizing Mode Screen
 * Admin-only screen for selecting the nail sizing mode (camera vs manual)
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View} from 'react-native';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import { 
  getNailSizingMode, 
  setNailSizingMode 
} from '../services/appSettingsService';

function ManageNailSizingModeScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;
  const currentUserId = state.currentUser?.id;

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadNailSizingMode();
  }, [isAdmin, navigation]);

  const loadNailSizingMode = useCallback(async () => {
    try {
      setLoading(true);
      const mode = await getNailSizingMode();
      setCameraEnabled(mode === 'camera');
    } catch (error) {
      console.error('[ManageNailSizingMode] Error loading nail sizing mode:', error);
      Alert.alert('Error', 'Failed to load nail sizing mode. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleCamera = useCallback(async (enabled) => {
    if (!currentUserId) {
      Alert.alert('Error', 'Admin user ID not found');
      return;
    }

    if (enabled === cameraEnabled) {
      // Already set to this state, no need to save
      return;
    }

    const mode = enabled ? 'camera' : 'manual';

    try {
      setSaving(true);
      await setNailSizingMode(mode, currentUserId);
      setCameraEnabled(enabled);
      // Don't show alert for toggle - it's immediate feedback
    } catch (error) {
      console.error('[ManageNailSizingMode] Error saving nail sizing mode:', error);
      Alert.alert('Error', error.message || 'Failed to save setting. Please try again.');
      // Revert toggle on error
      setCameraEnabled(!enabled);
    } finally {
      setSaving(false);
    }
  }, [currentUserId, cameraEnabled]);

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const accent = colors.accent || '#6F171F';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevronRight" color={primaryFont} size={20} />
          </TouchableOpacity>
          <AppText style={[styles.headerTitle, { color: primaryFont }]}>Nail Sizing Mode</AppText>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronLeft" color={primaryFont} size={20} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Nail Sizing Mode</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Camera Sizing</AppText>
          <AppText style={[styles.sectionDescription, { color: secondaryFont }]}>
            Enable camera-based nail sizing to allow users to take photos of their nails for accurate sizing. Manual entry will always be available regardless of this setting.
          </AppText>

          <View style={[
            styles.toggleCard,
            {
              backgroundColor: surface,
              borderColor: withOpacity(borderColor, 0.5),
            },
          ]}>
            <View style={styles.toggleContent}>
              <View style={styles.toggleHeader}>
                <Icon 
                  name="camera" 
                  color={accent} 
                  size={24} 
                />
                <View style={styles.toggleTextContainer}>
                  <AppText style={[styles.toggleTitle, { color: primaryFont }]}>
                    Enable Camera Sizing
                  </AppText>
                  <AppText style={[styles.toggleDescription, { color: secondaryFont }]}>
                    When enabled, users can take photos of their nails with a reference object (like a quarter) for accurate sizing.
                  </AppText>
                </View>
              </View>
              <Switch
                value={cameraEnabled}
                onValueChange={handleToggleCamera}
                disabled={saving}
                trackColor={{
                  false: withOpacity(borderColor, 0.6),
                  true: withOpacity(accent, 0.4),
                }}
                thumbColor={cameraEnabled ? accent : surface}
                ios_backgroundColor={withOpacity(borderColor, 0.6)}
              />
            </View>
            {cameraEnabled && (
              <View style={styles.statusBadge}>
                <Icon name="check" color={accent} size={14} />
                <AppText style={[styles.statusText, { color: accent }]}>
                  Camera sizing is enabled
                </AppText>
              </View>
            )}
          </View>

          <View style={styles.infoBox}>
            <Icon name="info" color={accent} size={18} />
            <AppText style={[styles.infoText, { color: secondaryFont }]}>
              When enabled, users will see both "Enter your nail sizes" and "Take a photo to measure" options. When disabled, only "Enter your nail sizes" will be available. Manual entry is always available regardless of this setting.
            </AppText>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withOpacity(colors.border || '#D9C8A9', 0.3),
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginRight: -36, // Compensate for back button width
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 20,
    gap: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  toggleCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    gap: 12,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  toggleTextContainer: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withOpacity(colors.border || '#D9C8A9', 0.3),
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: withOpacity(colors.accent || '#6F171F', 0.08),
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default ManageNailSizingModeScreen;

