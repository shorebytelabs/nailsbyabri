/**
 * Manage Theme Screen
 * Admin-only screen for selecting the global app theme
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
  getActiveTheme, 
  setActiveTheme,
  getActiveAnimation,
  setActiveAnimation 
} from '../services/appSettingsService';
import { animationRegistry } from '../animations';

function ManageThemeScreen({ navigation }) {
  const { theme, availableThemes, setThemeById } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;
  const currentUserId = state.currentUser?.id;

  const [activeThemeId, setActiveThemeId] = useState(null);
  const [activeAnimationId, setActiveAnimationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAnimation, setSavingAnimation] = useState(false);

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
      const [themeId, animationId] = await Promise.all([
        getActiveTheme(),
        getActiveAnimation(),
      ]);
      setActiveThemeId(themeId);
      setActiveAnimationId(animationId || 'none');
      // Update local theme to match global theme
      setThemeById(themeId);
    } catch (error) {
      console.error('[ManageTheme] Error loading settings:', error);
      Alert.alert('Error', error.message || 'Failed to load settings. Please try again.');
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

  const handleSelectAnimation = async (animationId) => {
    if (animationId === activeAnimationId) {
      return; // Already selected
    }

    try {
      setSavingAnimation(true);
      
      if (!currentUserId) {
        Alert.alert('Error', 'Admin user ID not found');
        return;
      }

      await setActiveAnimation(animationId, currentUserId);
      
      // Normalize animationId: null or undefined becomes 'none'
      const normalizedId = animationId || 'none';
      
      // Immediately update local state for the admin panel
      setActiveAnimationId(normalizedId);
      
      // Force reload the animation in ThemeProvider by reloading it
      // This ensures the global app state updates even if real-time subscription doesn't fire
      try {
        // Small delay to ensure database write is complete
        await new Promise(resolve => setTimeout(resolve, 300));
        const updatedAnimationId = await getActiveAnimation();
        if (__DEV__) {
          console.log('[ManageTheme] Reloaded animation after update:', updatedAnimationId);
        }
        const finalId = updatedAnimationId || 'none';
        setActiveAnimationId(finalId);
        
        // Also update the theme provider's state by triggering a reload
        // The real-time subscription should handle this, but if it doesn't, 
        // the user will need to refresh the app
        if (__DEV__) {
          console.log('[ManageTheme] Animation updated. If animation does not change, try refreshing the app.');
        }
      } catch (error) {
        console.error('[ManageTheme] Error reloading animation:', error);
      }
      
      const animationName = animationRegistry.find(a => a.id === normalizedId)?.name || normalizedId;
      Alert.alert(
        'Success', 
        `Background animation updated to "${animationName}". ${normalizedId === 'none' ? 'The animation should disappear.' : 'All users will see the new animation.'}\n\nIf you don't see the change, try refreshing the app.`
      );
    } catch (error) {
      console.error('[ManageTheme] Error setting animation:', error);
      Alert.alert('Error', error.message || 'Failed to update animation. Please try again.');
    } finally {
      setSavingAnimation(false);
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
          <AppText style={[styles.headerTitle, { color: primaryFont }]}>Theme Selector</AppText>
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
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Theme Selector</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Theme Selection Section */}
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Theme</AppText>
          <AppText style={[styles.description, { color: secondaryFont }]}>
            Select the active theme for the entire application. All users will see the selected theme.
          </AppText>
          
          {activeThemeId && (
            <View style={styles.currentThemeContainer}>
              <AppText style={[styles.currentThemeLabel, { color: secondaryFont }]}>Current Theme:</AppText>
              <AppText style={[styles.currentThemeName, { color: primaryFont }]}>
                {availableThemes.find(t => t.id === activeThemeId)?.name || activeThemeId}
              </AppText>
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
                        <AppText style={[styles.themeName, { color: primaryFont }]}>
                          {themeOption.name}
                        </AppText>
                        <AppText style={[styles.themeId, { color: secondaryFont }]}>
                          {themeOption.id}
                        </AppText>
                      </View>
                    </View>
                    <View style={styles.themeCardRight}>
                      {isSelected ? (
                        <View style={[styles.selectedBadge, { backgroundColor: withOpacity(accent, 0.1) }]}>
                          <Icon name="check" color={accent} size={18} />
                          <AppText style={[styles.selectedText, { color: accent }]}>Active</AppText>
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

        {/* Background Animation Section */}
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Background Animation</AppText>
          <AppText style={[styles.description, { color: secondaryFont }]}>
            Select a background animation to display across the app. Animations are independent of themes and can be enabled on any theme. Choose "None" to disable animations.
          </AppText>
          
          {activeAnimationId && (
            <View style={styles.currentThemeContainer}>
              <AppText style={[styles.currentThemeLabel, { color: secondaryFont }]}>Current Animation:</AppText>
              <AppText style={[styles.currentThemeName, { color: primaryFont }]}>
                {animationRegistry.find(a => a.id === activeAnimationId)?.name || activeAnimationId}
              </AppText>
            </View>
          )}

          <View style={styles.themesList}>
            {animationRegistry.map((animationOption) => {
              const isSelected = animationOption.id === activeAnimationId;
              
              return (
                <TouchableOpacity
                  key={animationOption.id}
                  onPress={() => handleSelectAnimation(animationOption.id)}
                  disabled={savingAnimation || isSelected}
                  style={[
                    styles.themeCard,
                    {
                      backgroundColor: surface,
                      borderColor: isSelected ? accent : borderColor,
                      borderWidth: isSelected ? 2 : 1,
                      opacity: savingAnimation && !isSelected ? 0.6 : 1,
                    },
                  ]}
                  activeOpacity={0.75}
                >
                  <View style={styles.themeCardContent}>
                    <View style={styles.themeCardLeft}>
                      <View 
                        style={[
                          styles.themePreview, 
                          { 
                            backgroundColor: animationOption.id === 'snow' 
                              ? '#E8F0F5' 
                              : animationOption.id === 'none'
                              ? '#F5F5F5'
                              : accent 
                          }
                        ]} 
                      />
                      <View style={styles.themeInfo}>
                        <AppText style={[styles.themeName, { color: primaryFont }]}>
                          {animationOption.name}
                        </AppText>
                        <AppText style={[styles.themeId, { color: secondaryFont }]}>
                          {animationOption.id === 'none' ? 'No animation' : animationOption.id}
                        </AppText>
                      </View>
                    </View>
                    <View style={styles.themeCardRight}>
                      {isSelected ? (
                        <View style={[styles.selectedBadge, { backgroundColor: withOpacity(accent, 0.1) }]}>
                          <Icon name="check" color={accent} size={18} />
                          <AppText style={[styles.selectedText, { color: accent }]}>Active</AppText>
                        </View>
                      ) : savingAnimation ? (
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
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
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

