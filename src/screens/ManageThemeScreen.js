/**
 * Manage Theme Screen
 * Admin-only screen for selecting the global app theme
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import { getActiveTheme, setActiveTheme } from '../services/appSettingsService';

function ManageThemeScreen({ navigation }) {
  const { theme, availableThemes, setThemeById } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;
  const currentUserId = state.currentUser?.id;

  const [activeThemeId, setActiveThemeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadActiveTheme();
  }, [isAdmin, navigation]);

  const loadActiveTheme = useCallback(async () => {
    try {
      setLoading(true);
      const themeId = await getActiveTheme();
      setActiveThemeId(themeId);
      // Update local theme to match global theme
      setThemeById(themeId);
    } catch (error) {
      console.error('[ManageTheme] Error loading active theme:', error);
      Alert.alert('Error', error.message || 'Failed to load theme information. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [setThemeById]);

  const handleSelectTheme = async (themeId) => {
    if (themeId === activeThemeId) {
      return; // Already selected
    }

    try {
      setSaving(true);
      
      if (!currentUserId) {
        Alert.alert('Error', 'Admin user ID not found');
        return;
      }

      await setActiveTheme(themeId, currentUserId);
      setActiveThemeId(themeId);
      // Update local theme immediately
      setThemeById(themeId);
      
      Alert.alert('Success', `Theme updated to "${availableThemes.find(t => t.id === themeId)?.name || themeId}". All users will see the new theme.`);
    } catch (error) {
      console.error('[ManageTheme] Error setting theme:', error);
      Alert.alert('Error', error.message || 'Failed to update theme. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';
  const primaryBackground = colors.primaryBackground || '#F4EBE3';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: primaryBackground }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevronLeft" color={primaryFont} size={20} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: primaryFont }]}>Theme Selector</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: primaryBackground }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronLeft" color={primaryFont} size={20} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Theme Selector</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.description, { color: secondaryFont }]}>
            Select the active theme for the entire application. All users will see the selected theme.
          </Text>
          
          {activeThemeId && (
            <View style={styles.currentThemeContainer}>
              <Text style={[styles.currentThemeLabel, { color: secondaryFont }]}>Current Theme:</Text>
              <Text style={[styles.currentThemeName, { color: primaryFont }]}>
                {availableThemes.find(t => t.id === activeThemeId)?.name || activeThemeId}
              </Text>
            </View>
          )}

          <View style={styles.themesList}>
            {availableThemes.map((themeOption) => {
              const isSelected = themeOption.id === activeThemeId;
              const isActive = isSelected && !saving;
              
              return (
                <TouchableOpacity
                  key={themeOption.id}
                  onPress={() => handleSelectTheme(themeOption.id)}
                  disabled={saving || isSelected}
                  style={[
                    styles.themeCard,
                    {
                      backgroundColor: surface,
                      borderColor: isSelected ? accent : borderColor,
                      borderWidth: isSelected ? 2 : 1,
                      opacity: saving && !isSelected ? 0.6 : 1,
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <View style={styles.themeCardContent}>
                    <View style={styles.themeCardLeft}>
                      <View style={[styles.themePreview, { backgroundColor: themeOption.colors?.accent || accent }]} />
                      <View style={styles.themeInfo}>
                        <Text style={[styles.themeName, { color: primaryFont }]}>
                          {themeOption.name}
                        </Text>
                        <Text style={[styles.themeId, { color: secondaryFont }]}>
                          {themeOption.id}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.themeCardRight}>
                      {isSelected ? (
                        <View style={[styles.selectedBadge, { backgroundColor: withOpacity(accent, 0.1) }]}>
                          <Icon name="check" color={accent} size={18} />
                          <Text style={[styles.selectedText, { color: accent }]}>Active</Text>
                        </View>
                      ) : saving ? (
                        <ActivityIndicator size="small" color={accent} />
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || '#D9C8A9',
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 36,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
    },
    currentThemeContainer: {
      backgroundColor: colors.surface || '#FFFFFF',
      padding: 16,
      borderRadius: 8,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border || '#D9C8A9',
    },
    currentThemeLabel: {
      fontSize: 12,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    currentThemeName: {
      fontSize: 18,
      fontWeight: '600',
    },
    themesList: {
      gap: 12,
    },
    themeCard: {
      borderRadius: 8,
      padding: 16,
    },
    themeCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    themeCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    themePreview: {
      width: 40,
      height: 40,
      borderRadius: 8,
      marginRight: 12,
    },
    themeInfo: {
      flex: 1,
    },
    themeName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    themeId: {
      fontSize: 12,
    },
    themeCardRight: {
      marginLeft: 12,
    },
    selectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    selectedText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });

export default ManageThemeScreen;

