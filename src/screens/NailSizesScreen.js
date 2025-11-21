import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Alert, Switch, ActivityIndicator } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import {
  normalizeNailSizes as normalizeStoredNailSizes,
  createEmptySizeValues,
  loadPreferences,
} from '../storage/preferences';
import { deleteNailSizeProfile, upsertNailSizeProfile, getNailSizeProfiles } from '../services/supabaseService';

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

function NailSizesScreen({ navigation }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { state, handleUpdatePreferences } = useAppState();
  const user = state.currentUser;

  const [nailSizesDraft, setNailSizesDraft] = useState(() =>
    normalizeNailSizes(state.preferences?.nailSizes),
  );
  const [savingSizes, setSavingSizes] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null); // null = new, object = editing
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const [profileForm, setProfileForm] = useState({
    label: '',
    sizes: createEmptySizeValues(),
    isDefault: false,
  });

  const primaryFont = colors.primaryFont || '#220707';
  const accent = colors.accent || '#6F171F';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const successColor = colors.success || '#4B7A57';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const surface = colors.surface || '#FFFFFF';

  useEffect(() => {
    setNailSizesDraft(normalizeNailSizes(state.preferences?.nailSizes));
  }, [state.preferences?.nailSizes]);

  useEffect(() => {
    if (!confirmation) {
      return undefined;
    }
    const timeout = setTimeout(() => setConfirmation(null), 3200);
    return () => clearTimeout(timeout);
  }, [confirmation]);

  // Get all profiles (default + additional) as a flat list for display
  // Only include profiles that have actual size values (not just labels)
  const allProfiles = useMemo(() => {
    const profiles = [];
    
    // Check if default profile has actual size values (not just a label)
    const defaultHasSizes = nailSizesDraft.defaultProfile && 
      nailSizesDraft.defaultProfile.sizes && 
      Object.values(nailSizesDraft.defaultProfile.sizes).some(val => val && val.toString().trim());
    
    // Only include default if it has actual size values
    if (defaultHasSizes) {
      profiles.push({
        ...nailSizesDraft.defaultProfile,
        isDefault: true,
      });
    }
    
    // Only include additional profiles that have size values
    const profilesWithSizes = nailSizesDraft.profiles.filter(profile => {
      return profile.sizes && 
        Object.values(profile.sizes).some(val => val && val.toString().trim());
    });
    profiles.push(...profilesWithSizes.map(p => ({ ...p, isDefault: false })));
    
    return profiles;
  }, [nailSizesDraft]);

  const handleAddNew = () => {
    setEditingProfile(null);
    setProfileForm({
      label: '',
      sizes: createEmptySizeValues(),
      isDefault: allProfiles.length === 0, // Make first profile default if none exist
    });
    setShowProfileForm(true);
    setError(null);
  };

  const handleEdit = (profile) => {
    setEditingProfile(profile);
    setProfileForm({
      label: profile.label || '',
      sizes: profile.sizes || createEmptySizeValues(),
      isDefault: profile.isDefault || false,
    });
    setShowProfileForm(true);
    setError(null);
  };

  const handleDelete = (profileId) => {
    Alert.alert(
      'Delete Profile',
      'Are you sure you want to delete this nail size profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(profileId);
              
              // First, update the draft state to remove the profile
              let updatedDraft;
              if (profileId === 'default') {
                // Reset default profile to empty
                updatedDraft = {
                  ...nailSizesDraft,
                  defaultProfile: {
                    id: 'default',
                    label: 'My default sizes',
                    sizes: createEmptySizeValues(),
                  },
                };
              } else {
                // Delete from Supabase if it's a real profile (not a temporary ID)
                // Check if it's a UUID (real ID) or temporary ID
                const isTemporaryId = profileId.startsWith('profile_') || profileId.startsWith('temp_');
                if (!isTemporaryId && user?.id) {
                  try {
                    await deleteNailSizeProfile(user.id, profileId);
                  } catch (deleteError) {
                    console.error('[NailSizesScreen] Error deleting from Supabase:', deleteError);
                    // Continue to remove from UI even if Supabase delete fails
                  }
                }
                // Remove from UI
                updatedDraft = {
                  ...nailSizesDraft,
                  profiles: nailSizesDraft.profiles.filter((profile) => profile.id !== profileId),
                };
              }
              
              // Update state immediately
              setNailSizesDraft(updatedDraft);
              
              // Save using the updated draft (without the deleted profile)
              const sanitized = normalizeNailSizes(updatedDraft);
              const nextPreferences = {
                ...state.preferences,
                nailSizes: sanitized,
              };
              await handleUpdatePreferences(nextPreferences);
              
              // Reload preferences from Supabase to get fresh data
              if (user?.id) {
                const reloadedPreferences = await loadPreferences(user.id);
                if (reloadedPreferences?.nailSizes) {
                  setNailSizesDraft(normalizeNailSizes(reloadedPreferences.nailSizes));
                }
              }
              
              setConfirmation('Profile deleted successfully');
              logEvent('profile_delete_nail_size_profile', { profile_id: profileId });
            } catch (err) {
              console.error('[NailSizesScreen] Error deleting profile:', err);
              Alert.alert('Error', err.message || 'Failed to delete profile');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (profileId) => {
    try {
      // Find the profile being set as default
      const profileToSetDefault = allProfiles.find(p => p.id === profileId);
      if (!profileToSetDefault) {
        console.warn('[NailSizesScreen] Profile not found for set default:', profileId);
        return;
      }

      // If it's already the default, no change needed
      if (profileId === 'default' && profileToSetDefault.isDefault) {
        return;
      }

      if (!user?.id) {
        Alert.alert('Error', 'User not found');
        return;
      }

      // Get the current default profile's real ID from the database
      const existingProfiles = await getNailSizeProfiles(user.id);
      const existingDefault = existingProfiles.find((p) => p.is_default);
      const oldDefaultId = existingDefault?.id;

      // If profileId is a real UUID (not 'default' or temporary), update it directly in the database
      if (profileId && profileId !== 'default' && !profileId.startsWith('profile_') && !profileId.startsWith('temp_')) {
        // First, unset the old default if it exists and is different from the new one
        if (oldDefaultId && oldDefaultId !== profileId) {
          await upsertNailSizeProfile(user.id, {
            id: oldDefaultId,
            label: existingDefault.label || 'My default sizes',
            is_default: false,
            sizes: existingDefault.sizes || createEmptySizeValues(),
          });
        }
        
        // Then set the new profile as default
        await upsertNailSizeProfile(user.id, {
          id: profileId,
          label: profileToSetDefault.label || 'My default sizes',
          is_default: true,
          sizes: profileToSetDefault.sizes || createEmptySizeValues(),
        });
      }

      // Get current default profile from allProfiles (for UI state)
      const currentDefault = allProfiles.find(p => p.isDefault && p.id === 'default');

      // Update the draft: move selected profile to default, move current default to profiles
      setNailSizesDraft((prev) => {
        const newDefault = {
          id: 'default',
          label: profileToSetDefault.label || 'My default sizes',
          sizes: profileToSetDefault.sizes || createEmptySizeValues(),
        };

        // If old default exists and has size values, add it to profiles with its real ID
        const currentDefaultHasSizes = existingDefault && 
          existingDefault.sizes && 
          Object.values(existingDefault.sizes || {}).some(v => v && v.toString().trim());
        
        const currentDefaultToAdd = currentDefaultHasSizes && oldDefaultId && oldDefaultId !== profileId
          ? {
              // Use the real ID from the database
              id: oldDefaultId,
              label: existingDefault.label || 'My default sizes',
              sizes: existingDefault.sizes || createEmptySizeValues(),
            }
          : null;

        // Filter out the profile being set as default AND any existing default profile from profiles
        const filteredProfiles = prev.profiles.filter(p => 
          p.id !== profileId && p.id !== 'default' && p.id !== oldDefaultId
        );

        return {
          ...prev,
          defaultProfile: newDefault,
          profiles: [
            ...(currentDefaultToAdd ? [currentDefaultToAdd] : []),
            ...filteredProfiles,
          ],
        };
      });

      // Reload preferences to get fresh data
      const reloadedPreferences = await loadPreferences(user.id);
      if (reloadedPreferences?.nailSizes) {
        setNailSizesDraft(normalizeNailSizes(reloadedPreferences.nailSizes));
      }
      
      setConfirmation('Default profile updated');
      logEvent('profile_set_default_nail_size', { profile_id: profileId });
    } catch (err) {
      console.error('[NailSizesScreen] Error setting default profile:', err);
      Alert.alert('Error', err.message || 'Failed to set default profile');
    }
  };

  const handleSaveProfile = async () => {
    setError(null);

    // Validation
    if (!profileForm.label.trim()) {
      setError('Profile name is required');
      return;
    }

    setSaving(true);
    try {
      let updatedDraft;
      
      if (editingProfile) {
        // Update existing profile
        if (editingProfile.id === 'default') {
          // Update default profile
          updatedDraft = {
            ...nailSizesDraft,
            defaultProfile: {
              id: 'default',
              label: profileForm.label.trim(),
              sizes: profileForm.sizes,
            },
          };
        } else {
          // Update additional profile
          if (profileForm.isDefault) {
            // Move this profile to default, move current default to profiles
            const currentDefault = nailSizesDraft.defaultProfile;
            updatedDraft = {
              ...nailSizesDraft,
              defaultProfile: {
                id: 'default',
                label: profileForm.label.trim(),
                sizes: profileForm.sizes,
              },
              profiles: [
                ...(currentDefault && Object.values(currentDefault.sizes || {}).some(v => v) 
                  ? [{
                      id: `profile_${Date.now()}`,
                      label: currentDefault.label || 'My default sizes',
                      sizes: currentDefault.sizes,
                    }]
                  : []),
                ...nailSizesDraft.profiles.filter(p => p.id !== editingProfile.id),
              ],
            };
          } else {
            // Just update the profile
            updatedDraft = {
              ...nailSizesDraft,
              profiles: nailSizesDraft.profiles.map((profile) =>
                profile.id === editingProfile.id
                  ? {
                      ...profile,
                      label: profileForm.label.trim(),
                      sizes: profileForm.sizes,
                    }
                  : profile,
              ),
            };
          }
        }
      } else {
        // Add new profile
        const newProfile = {
          id: `profile_${Date.now()}`,
          label: profileForm.label.trim(),
          sizes: profileForm.sizes,
        };

        if (profileForm.isDefault) {
          // Move current default to profiles, set new as default
          const currentDefault = nailSizesDraft.defaultProfile;
          updatedDraft = {
            ...nailSizesDraft,
            defaultProfile: {
              id: 'default',
              label: newProfile.label,
              sizes: newProfile.sizes,
            },
            profiles: [
              ...(currentDefault && Object.values(currentDefault.sizes || {}).some(v => v) 
                ? [{
                    id: `profile_${Date.now() + 1}`,
                    label: currentDefault.label || 'My default sizes',
                    sizes: currentDefault.sizes,
                  }]
                : []),
              ...nailSizesDraft.profiles,
            ],
          };
        } else {
          // Add as additional profile
          updatedDraft = {
            ...nailSizesDraft,
            profiles: [...nailSizesDraft.profiles, newProfile],
          };
        }
      }

      // Update state
      setNailSizesDraft(updatedDraft);

      // Save to backend using the updated draft
      const sanitized = normalizeNailSizes(updatedDraft);
      if (__DEV__) {
        console.log('[NailSizesScreen] Saving profile with sizes:', profileForm.sizes);
        console.log('[NailSizesScreen] Sanitized nail sizes:', sanitized);
      }
      const nextPreferences = {
        ...state.preferences,
        nailSizes: sanitized,
      };
      await handleUpdatePreferences(nextPreferences);
      setConfirmation('Nail sizes saved');
      logEvent('profile_save_nail_sizes');
      
      setShowProfileForm(false);
      setError(null);
    } catch (err) {
      console.error('[NailSizesScreen] Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowProfileForm(false);
    setError(null);
    setProfileForm({
      label: '',
      sizes: createEmptySizeValues(),
      isDefault: false,
    });
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
      
      // Reload preferences from Supabase to get real IDs and prevent duplicates
      if (user?.id) {
        const reloadedPreferences = await loadPreferences(user.id);
        if (reloadedPreferences?.nailSizes) {
          setNailSizesDraft(normalizeNailSizes(reloadedPreferences.nailSizes));
        }
      }
      
      setConfirmation('Nail sizes saved');
      logEvent('profile_save_nail_sizes');
      // Don't navigate back automatically - let user stay on the screen
    } finally {
      setSavingSizes(false);
    }
  };

  const renderSizeProfileCard = (profile, index) => {
    const isDefault = profile.isDefault;
    const errorColor = colors.error || '#B33A3A';
    // Use a unique key combining id and index to prevent duplicate key errors
    const uniqueKey = `${profile.id}-${index}-${isDefault ? 'default' : 'profile'}`;

    return (
      <View
        key={uniqueKey}
        style={[
          styles.sizeProfileCard,
          {
            borderColor: isDefault ? accent : borderColor,
            backgroundColor: isDefault ? withOpacity(accent, 0.05) : surface,
          },
        ]}
      >
        <View style={styles.sizeProfileHeader}>
          <View style={styles.sizeProfileHeaderLeft}>
            <Text style={[styles.sizeProfileLabel, { color: accent }]}>
              {profile.label || (isDefault ? 'My default sizes' : 'Profile name')}
            </Text>
            {isDefault && (
              <View style={[styles.defaultBadge, { backgroundColor: accent }]}>
                <Text style={[styles.defaultBadgeText, { color: surface }]}>Default</Text>
              </View>
            )}
          </View>
          <View style={styles.sizeProfileActions}>
            <TouchableOpacity
              onPress={() => handleEdit(profile)}
              style={styles.actionButton}
              accessibilityLabel="Edit profile"
            >
              <Icon name="edit" color={accent} size={18} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(profile.id)}
              style={styles.actionButton}
              disabled={deletingId === profile.id}
              accessibilityLabel="Delete profile"
            >
              <Icon name="trash" color={errorColor} size={18} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.sizeProfileBody}>
          <View style={styles.sizeContainer}>
            <View style={styles.sizeLabelsRow}>
              {FINGER_DISPLAY.map(({ key, label }) => (
                <View key={`${profile.id}_${key}_label`} style={styles.sizeLabelCell}>
                  <Text style={[styles.sizeLabel, { color: primaryFont }]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.sizeInputsRow}>
              {FINGER_DISPLAY.map(({ key, label }) => (
                <View key={`${profile.id}_${key}_value`} style={styles.sizeValueCell}>
                  <Text style={[styles.sizeValue, { color: secondaryFont }]}>
                    {profile.sizes?.[key] || '-'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        {!isDefault && (
          <TouchableOpacity
            onPress={() => handleSetDefault(profile.id)}
            style={styles.setDefaultButton}
          >
            <Text style={[styles.setDefaultText, { color: accent }]}>
              Set as default
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
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
          <Icon name="chevronRight" color={primaryFont} style={styles.backIcon} size={20} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Nail Sizes</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <Text style={[styles.subtitle, { color: secondaryFont }]}>
            Manage your nail sizes and create additional profiles for different sets.
          </Text>
        </View>

        <View style={styles.sizesSection}>
          <View style={styles.addButtonBottomContainer}>
            <TouchableOpacity
              onPress={handleAddNew}
              style={[
                styles.addButtonTop,
                {
                  borderColor: withOpacity(accent, 0.35),
                  backgroundColor: withOpacity(accent, 0.08),
                },
              ]}
            >
              <Icon name="plus" color={accent} size={16} />
              <Text style={[styles.addButtonTopText, { color: accent }]}>Add Size Profile</Text>
            </TouchableOpacity>
          </View>
          {allProfiles.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="settings" color={withOpacity(secondaryFont, 0.4)} size={48} />
              <Text style={[styles.emptyTitle, { color: primaryFont }]}>No saved nail sizes</Text>
              <Text style={[styles.emptyText, { color: secondaryFont }]}>
                Add a profile to save your nail sizes
              </Text>
            </View>
          ) : (
            <View style={styles.profileList}>
              {allProfiles.map((profile, index) => renderSizeProfileCard(profile, index))}
            </View>
          )}

          {error && !showProfileForm ? (
            <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Profile Form Modal */}
      <Modal
        visible={showProfileForm}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surface }]} collapsable={false}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryFont }]}>
                {editingProfile ? 'Edit Profile' : 'Add Size Profile'}
              </Text>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.modalCloseButton}
                accessibilityLabel="Close"
              >
                <Icon name="close" color={primaryFont} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.formLabel, { color: primaryFont }]}>Profile Name *</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={profileForm.label}
                onChangeText={(value) => {
                  setProfileForm((prev) => ({ ...prev, label: value }));
                  if (error) setError(null);
                }}
                placeholder="My default sizes"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Nail Sizes *</Text>
              <View style={styles.sizeContainer}>
                <View style={styles.sizeLabelsRow}>
                  {FINGER_DISPLAY.map(({ key, label }) => (
                    <View key={`form_${key}_label`} style={styles.sizeLabelCell}>
                      <Text style={[styles.sizeLabel, { color: primaryFont }]}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.sizeInputsRow}>
                  {FINGER_DISPLAY.map(({ key, label }) => (
                    <View key={`form_${key}_input`} style={styles.sizeInputCell}>
                      <TextInput
                        style={[
                          styles.sizeInput,
                          {
                            borderColor: withOpacity(borderColor, 0.5),
                            color: primaryFont,
                            backgroundColor: surface,
                          },
                        ]}
                        value={profileForm.sizes?.[key] || ''}
                        onChangeText={(value) => {
                          setProfileForm((prev) => ({
                            ...prev,
                            sizes: {
                              ...prev.sizes,
                              [key]: value,
                            },
                          }));
                          if (error) setError(null);
                        }}
                        placeholder="e.g. 3"
                        placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                        keyboardType="number-pad"
                      />
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.defaultProfileRow}>
                <View style={styles.defaultProfileLabel}>
                  <Text style={[styles.defaultProfileLabelText, { color: primaryFont }]}>
                    Set as default profile
                  </Text>
                </View>
                <Switch
                  value={profileForm.isDefault}
                  onValueChange={(value) => {
                    setProfileForm((prev) => ({ ...prev, isDefault: value }));
                  }}
                  trackColor={{
                    false: withOpacity(borderColor, 0.6),
                    true: withOpacity(accent, 0.4),
                  }}
                  thumbColor={profileForm.isDefault ? accent : surface}
                  ios_backgroundColor={withOpacity(borderColor, 0.6)}
                />
              </View>

              {error ? (
                <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={handleCancel}
                style={[styles.modalButton, { borderColor: withOpacity(borderColor, 0.5) }]}
              >
                <Text style={[styles.modalButtonText, { color: primaryFont }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={saving || !profileForm.label.trim()}
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  {
                    backgroundColor: accent,
                    opacity: (saving || !profileForm.label.trim()) ? 0.5 : 1,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.accentContrast || '#FFFFFF'} />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonPrimaryText, { color: colors.accentContrast || '#FFFFFF' }]}>
                    {editingProfile ? 'Update Profile' : 'Save Profile'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerSection: {
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  sizesSection: {
    gap: 0,
  },
  addButtonBottomContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonTopText: {
    fontSize: 13,
    fontWeight: '700',
  },
  profileList: {
    gap: 12,
    marginBottom: 24,
  },
  sizeProfileCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sizeProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sizeProfileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sizeProfileLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sizeProfileActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  sizeProfileNameInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  sizeContainer: {
    gap: 8,
  },
  sizeLabelsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sizeLabelCell: {
    flex: 1,
  },
  sizeLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  sizeInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sizeInputCell: {
    flex: 1,
  },
  sizeInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  addSizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    marginTop: 12,
  },
  addSizeButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sizeProfileBody: {
    marginTop: 8,
  },
  sizeValueCell: {
    flex: 1,
  },
  sizeValue: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  setDefaultButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  setDefaultText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withOpacity(colors.border || '#000000', 0.08),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  formInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
  },
  defaultProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingVertical: 12,
  },
  defaultProfileLabel: {
    flex: 1,
  },
  defaultProfileLabelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withOpacity(colors.border || '#000000', 0.08),
    backgroundColor: colors.surface || '#FFFFFF',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonPrimaryText: {
    color: colors.accentContrast || '#FFFFFF',
  },
});

export default NailSizesScreen;

