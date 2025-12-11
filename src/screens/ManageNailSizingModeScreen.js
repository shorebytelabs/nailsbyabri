/**
 * Manage Nail Sizing Mode Screen
 * Admin-only screen for selecting the nail sizing mode (camera vs manual)
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
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

  const [nailSizingMode, setNailSizingModeState] = useState('manual');
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
      setNailSizingModeState(mode);
    } catch (error) {
      console.error('[ManageNailSizingMode] Error loading nail sizing mode:', error);
      Alert.alert('Error', 'Failed to load nail sizing mode. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveMode = useCallback(async (mode) => {
    if (!currentUserId) {
      Alert.alert('Error', 'Admin user ID not found');
      return;
    }

    if (mode === nailSizingMode) {
      // Already set to this mode, no need to save
      return;
    }

    try {
      setSaving(true);
      await setNailSizingMode(mode, currentUserId);
      setNailSizingModeState(mode);
      Alert.alert('Success', `Nail sizing mode set to ${mode === 'camera' ? 'Camera Sizing' : 'Manual Entry'}`);
    } catch (error) {
      console.error('[ManageNailSizingMode] Error saving nail sizing mode:', error);
      Alert.alert('Error', error.message || 'Failed to save nail sizing mode. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [currentUserId, nailSizingMode]);

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
          <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Choose Sizing Method</AppText>
          <AppText style={[styles.sectionDescription, { color: secondaryFont }]}>
            Select how users will enter their nail sizes. Camera mode allows users to take photos for sizing, while manual mode requires them to enter measurements directly.
          </AppText>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              onPress={() => handleSaveMode('camera')}
              disabled={saving}
              style={[
                styles.optionCard,
                {
                  backgroundColor: nailSizingMode === 'camera' ? accent : surface,
                  borderColor: nailSizingMode === 'camera' ? accent : withOpacity(borderColor, 0.5),
                  opacity: saving ? 0.5 : 1,
                },
              ]}
            >
              <View style={styles.optionHeader}>
                <Icon 
                  name="image" 
                  color={nailSizingMode === 'camera' ? (colors.accentContrast || '#FFFFFF') : accent} 
                  size={24} 
                />
                <AppText
                  style={[
                    styles.optionTitle,
                    {
                      color: nailSizingMode === 'camera' ? (colors.accentContrast || '#FFFFFF') : primaryFont,
                    },
                  ]}
                >
                  Camera Sizing
                </AppText>
              </View>
              <AppText
                style={[
                  styles.optionDescription,
                  {
                    color: nailSizingMode === 'camera' ? (colors.accentContrast || '#FFFFFF') : secondaryFont,
                  },
                ]}
              >
                Users can take photos of their nails with a reference object (like a quarter) for accurate sizing.
              </AppText>
              {nailSizingMode === 'camera' && (
                <View style={styles.selectedBadge}>
                  <Icon name="check" color={colors.accentContrast || '#FFFFFF'} size={16} />
                  <AppText style={[styles.selectedText, { color: colors.accentContrast || '#FFFFFF' }]}>
                    Currently Active
                  </AppText>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSaveMode('manual')}
              disabled={saving}
              style={[
                styles.optionCard,
                {
                  backgroundColor: nailSizingMode === 'manual' ? accent : surface,
                  borderColor: nailSizingMode === 'manual' ? accent : withOpacity(borderColor, 0.5),
                  opacity: saving ? 0.5 : 1,
                },
              ]}
            >
              <View style={styles.optionHeader}>
                <Icon 
                  name="edit" 
                  color={nailSizingMode === 'manual' ? (colors.accentContrast || '#FFFFFF') : accent} 
                  size={24} 
                />
                <AppText
                  style={[
                    styles.optionTitle,
                    {
                      color: nailSizingMode === 'manual' ? (colors.accentContrast || '#FFFFFF') : primaryFont,
                    },
                  ]}
                >
                  Manual Entry
                </AppText>
              </View>
              <AppText
                style={[
                  styles.optionDescription,
                  {
                    color: nailSizingMode === 'manual' ? (colors.accentContrast || '#FFFFFF') : secondaryFont,
                  },
                ]}
              >
                Users enter nail sizes manually by typing measurements for each finger.
              </AppText>
              {nailSizingMode === 'manual' && (
                <View style={styles.selectedBadge}>
                  <Icon name="check" color={colors.accentContrast || '#FFFFFF'} size={16} />
                  <AppText style={[styles.selectedText, { color: colors.accentContrast || '#FFFFFF' }]}>
                    Currently Active
                  </AppText>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Icon name="info" color={accent} size={18} />
            <AppText style={[styles.infoText, { color: secondaryFont }]}>
              Changing this setting will immediately affect all new orders. Existing orders will not be affected.
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
  optionsContainer: {
    gap: 16,
    marginTop: 8,
  },
  optionCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: withOpacity(colors.accentContrast || '#FFFFFF', 0.2),
  },
  selectedText: {
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

