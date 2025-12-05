/**
 * User Detail Screen
 * Admin-only screen for viewing and managing individual user accounts
 * Features: Edit profile, reset password, manage nail sizes, change role, view activity, impersonate
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View} from 'react-native';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import PrimaryButton from '../components/PrimaryButton';
import {
  fetchUserById,
  updateUser,
  resetUserPassword,
  updateUserRole,
  getUserNailSizeProfiles,
  updateUserNailSizeProfiles,
  getUserActivityLog,
  logImpersonation,
} from '../services/userService';
import { createEmptySizeValues, defaultPreferences } from '../storage/preferences';

const FINGER_DISPLAY = [
  { key: 'thumb', label: 'Thumb' },
  { key: 'index', label: 'Index' },
  { key: 'middle', label: 'Middle' },
  { key: 'ring', label: 'Ring' },
  { key: 'pinky', label: 'Pinky' },
];

function UserDetailScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { state, setState, loadOrdersForUser } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;
  const userId = route?.params?.userId;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  // Edit profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: '', email: '', active: true });

  // Nail sizes state - using same structure as ProfileScreen
  const [nailSizeProfiles, setNailSizeProfiles] = useState([]);
  const [editingSizes, setEditingSizes] = useState(false);
  const [sizesDraft, setSizesDraft] = useState({
    defaultProfile: {
      id: 'default',
      label: 'My default sizes',
      sizes: createEmptySizeValues(),
    },
    profiles: [],
  });
  const [defaultProfileId, setDefaultProfileId] = useState('default');

  // Activity state
  const [activityLog, setActivityLog] = useState([]);
  const [activityExpanded, setActivityExpanded] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    // If impersonating, redirect to home screen instead of showing alert
    if (state.impersonating) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
      return;
    }
    
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    if (userId) {
      loadUser();
    }
  }, [isAdmin, navigation, userId, state.impersonating]);

  useEffect(() => {
    if (!confirmation) {
      return undefined;
    }
    const timeout = setTimeout(() => setConfirmation(null), 3200);
    return () => clearTimeout(timeout);
  }, [confirmation]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const userData = await fetchUserById(userId);
      setUser(userData);
      setProfileDraft({
        name: userData.name || '',
        email: userData.email || '',
        active: userData.active !== false,
      });

      // Load nail size profiles - using same data source as ProfileScreen
      const profiles = await getUserNailSizeProfiles(userId);
      setNailSizeProfiles(profiles);
      
      // Transform to match ProfileScreen structure: separate default and additional profiles
      const defaultProfile = profiles.find((p) => p.isDefault);
      const additionalProfiles = profiles.filter((p) => !p.isDefault);
      
      // Build nailSizesDraft structure matching ProfileScreen format
      const nailSizesDraft = {
        defaultProfile: defaultProfile
          ? {
              id: defaultProfile.id,
              label: defaultProfile.label || defaultProfile.name || 'My default sizes',
              sizes: defaultProfile.sizes || createEmptySizeValues(),
            }
          : {
              id: 'default',
              label: 'My default sizes',
              sizes: createEmptySizeValues(),
            },
        profiles: additionalProfiles.map((profile) => ({
          id: profile.id,
          label: profile.label || profile.name || 'Untitled Profile',
          sizes: profile.sizes || createEmptySizeValues(),
        })),
      };
      
      setSizesDraft(nailSizesDraft);
      setDefaultProfileId(defaultProfile?.id || 'default');
      
      // If no profiles exist, automatically enter edit mode
      if (profiles.length === 0) {
        setEditingSizes(true);
      }

      // Load activity log
      const activity = await getUserActivityLog(userId, 10);
      setActivityLog(activity);
    } catch (error) {
      console.error('[UserDetail] Error loading user:', error);
      Alert.alert('Error', 'Failed to load user details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await updateUser(userId, profileDraft);
      await loadUser();
      setEditingProfile(false);
      setConfirmation('Profile updated');
    } catch (error) {
      console.error('[UserDetail] Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = () => {
    Alert.alert(
      'Reset Password',
      'This will send a password reset email to the user. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reset Email',
          onPress: async () => {
            try {
              setSaving(true);
              await resetUserPassword(userId, state.currentUser?.id);
              setConfirmation('Password reset email sent');
            } catch (error) {
              console.error('[UserDetail] Error resetting password:', error);
              Alert.alert('Error', error.message || 'Failed to send password reset email.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = () => {
    const currentRole = user?.role || 'user';
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    const message =
      newRole === 'admin'
        ? `WARNING: This will grant admin privileges to ${user?.name || user?.email}. This user will have full access to the admin panel. Continue?`
        : `Change ${user?.name || user?.email}'s role from Admin to User?`;

    Alert.alert('Change Role', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: newRole === 'admin' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            setSaving(true);
            await updateUserRole(userId, newRole, state.currentUser?.id);
            await loadUser();
            setConfirmation(`Role changed to ${newRole === 'admin' ? 'Admin' : 'User'}`);
          } catch (error) {
            console.error('[UserDetail] Error changing role:', error);
            Alert.alert('Error', error.message || 'Failed to change role. Please try again.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // Handler functions matching ProfileScreen pattern
  const handleDefaultProfileLabelChange = (value) => {
    setSizesDraft((prev) => ({
      ...prev,
      defaultProfile: {
        ...prev.defaultProfile,
        label: value,
      },
    }));
  };

  const handleDefaultSizeChange = (finger, value) => {
    setSizesDraft((prev) => ({
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
    setSizesDraft((prev) => ({
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
    setSizesDraft((prev) => ({
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
    const newProfile = {
      id: `profile_${Date.now()}`,
      label: `Additional profile ${sizesDraft.profiles.length + 1}`,
      sizes: createEmptySizeValues(),
    };
    setSizesDraft((prev) => ({
      ...prev,
      profiles: [...prev.profiles, newProfile],
    }));
  };

  const handleRemoveSizeProfile = async (profileId) => {
    // Don't delete if it's a temporary ID - just remove from UI
    if (profileId.startsWith('profile_') || profileId.startsWith('temp_')) {
      setSizesDraft((prev) => ({
        ...prev,
        profiles: prev.profiles.filter((profile) => profile.id !== profileId),
      }));
      return;
    }

    // Delete from Supabase if it's a real profile
    try {
      const { deleteNailSizeProfile } = await import('../services/supabaseService');
      await deleteNailSizeProfile(userId, profileId);
      setSizesDraft((prev) => ({
        ...prev,
        profiles: prev.profiles.filter((profile) => profile.id !== profileId),
      }));
    } catch (error) {
      console.error('[UserDetail] Failed to delete nail size profile:', error);
      // Still remove from UI even if Supabase delete fails
      setSizesDraft((prev) => ({
        ...prev,
        profiles: prev.profiles.filter((profile) => profile.id !== profileId),
      }));
    }
  };

  const handleSaveNailSizes = async () => {
    try {
      setSaving(true);
      
      // Convert ProfileScreen format to flat array for updateUserNailSizeProfiles
      const profiles = [];
      
      // Add default profile if it has data
      if (sizesDraft.defaultProfile) {
        const hasSizes = Object.values(sizesDraft.defaultProfile.sizes || {}).some(
          (value) => value && String(value).trim() !== ''
        );
        if (hasSizes || sizesDraft.profiles.length === 0) {
          // Always include default if it's the only profile or has sizes
          profiles.push({
            id: sizesDraft.defaultProfile.id === 'default' ? defaultProfileId : sizesDraft.defaultProfile.id,
            label: sizesDraft.defaultProfile.label,
            name: sizesDraft.defaultProfile.label, // Also include name for compatibility
            isDefault: true,
            sizes: sizesDraft.defaultProfile.sizes || createEmptySizeValues(),
          });
        }
      }
      
      // Add additional profiles
      sizesDraft.profiles.forEach((profile) => {
        const hasSizes = Object.values(profile.sizes || {}).some(
          (value) => value && String(value).trim() !== ''
        );
        if (hasSizes) {
          profiles.push({
            id: profile.id,
            label: profile.label,
            name: profile.label, // Also include name for compatibility
            isDefault: false,
            sizes: profile.sizes || createEmptySizeValues(),
          });
        }
      });
      
      const defaultId = profiles.find((p) => p.isDefault)?.id || profiles[0]?.id || defaultProfileId;
      await updateUserNailSizeProfiles(userId, profiles, defaultId);
      
      // Reload user data to refresh the profile list
      await loadUser();
      setEditingSizes(false);
      setConfirmation('Nail sizes updated');
    } catch (error) {
      console.error('[UserDetail] Error updating nail sizes:', error);
      Alert.alert('Error', error.message || 'Failed to update nail sizes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleImpersonate = () => {
    Alert.alert(
      'Impersonate User',
      `You are about to view the app as ${user?.name || user?.email}. This action will be logged for security purposes. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'Are you sure you want to impersonate this user?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Impersonate',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // Log impersonation start
                      await logImpersonation(state.currentUser?.id, userId, 'start');

                      // Fetch full user data including preferences
                      const { fetchUserById } = await import('../services/userService');
                      const fullUserData = await fetchUserById(userId);

                      // Store original admin user
                      const originalAdmin = state.currentUser;
                      
                      // Prepare impersonated user object with all required fields
                      const impersonatedUser = {
                        id: fullUserData.id,
                        email: fullUserData.email,
                        name: fullUserData.full_name || fullUserData.email,
                        role: fullUserData.role || 'user',
                        age_group: fullUserData.age_group || null,
                        age: fullUserData.age || null,
                        createdAt: fullUserData.created_at || new Date().toISOString(),
                        consentedAt: fullUserData.created_at || new Date().toISOString(),
                        consentApprover: fullUserData.full_name || fullUserData.email,
                        consentChannel: 'self',
                        pendingConsent: false,
                        isAdmin: false, // Remove admin privileges while impersonating
                      };
                      
                      // Update state with impersonated user
                      setState((prev) => ({
                        ...prev,
                        impersonating: true,
                        originalAdminUser: originalAdmin,
                        currentUser: impersonatedUser,
                        orders: [], // Clear admin's orders
                        ordersLoaded: false, // Trigger reload for impersonated user
                        preferences: defaultPreferences, // Reset preferences, will be loaded
                      }));

                      // Explicitly load orders and preferences for impersonated user
                      // Call these immediately with the new user object to ensure data loads
                      const { loadPreferences } = await import('../storage/preferences');
                      
                      // Load orders for impersonated user (call with the user object directly)
                      try {
                        await loadOrdersForUser(impersonatedUser);
                      } catch (orderError) {
                        console.error('[UserDetail] Error loading orders after impersonation:', orderError);
                      }
                      
                      // Load preferences for impersonated user
                      try {
                        const loadedPreferences = await loadPreferences(impersonatedUser.id);
                        setState((prev) => ({
                          ...prev,
                          preferences: loadedPreferences,
                        }));
                      } catch (prefError) {
                        console.error('[UserDetail] Error loading preferences after impersonation:', prefError);
                      }

                      // Navigate to main tabs
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'MainTabs' }],
                      });

                      setConfirmation('Impersonation started');
                    } catch (error) {
                      console.error('[UserDetail] Error starting impersonation:', error);
                      Alert.alert('Error', 'Failed to start impersonation. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.accent || '#6F171F'} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
        <View style={styles.loaderContainer}>
          <AppText style={[styles.errorText, { color: colors.error || '#B33A3A' }]}>User not found</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronRight" color={primaryFont} size={20} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: primaryFont }]} numberOfLines={1}>
          {user.name || user.email}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Edit Profile Section */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: withOpacity(borderColor, 0.3) }]}>
          <View style={styles.sectionHeader}>
            <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Profile Information</AppText>
            {!editingProfile ? (
              <TouchableOpacity onPress={() => setEditingProfile(true)}>
                <AppText style={[styles.editButton, { color: accent }]}>Edit</AppText>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingProfile(false);
                    setProfileDraft({
                      name: user.name || '',
                      email: user.email || '',
                      active: user.active !== false,
                    });
                  }}
                >
                  <AppText style={[styles.cancelButton, { color: secondaryFont }]}>Cancel</AppText>
                </TouchableOpacity>
                <PrimaryButton
                  label={saving ? 'Saving...' : 'Save'}
                  onPress={handleSaveProfile}
                  disabled={saving}
                  style={styles.saveButton}
                />
              </View>
            )}
          </View>

          {editingProfile ? (
            <View style={styles.form}>
              <View style={styles.formField}>
                <AppText style={[styles.formLabel, { color: primaryFont }]}>Name</AppText>
                <TextInput
                  style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont }]}
                  value={profileDraft.name}
                  onChangeText={(text) => setProfileDraft((prev) => ({ ...prev, name: text }))}
                  placeholder="User name"
                  placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                />
              </View>

              <View style={styles.formField}>
                <AppText style={[styles.formLabel, { color: primaryFont }]}>Email</AppText>
                <TextInput
                  style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont }]}
                  value={profileDraft.email}
                  onChangeText={(text) => setProfileDraft((prev) => ({ ...prev, email: text }))}
                  placeholder="user@example.com"
                  placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.formField}>
                <View style={styles.switchRow}>
                  <AppText style={[styles.formLabel, { color: primaryFont }]}>Active Account</AppText>
                  <Switch
                    value={profileDraft.active}
                    onValueChange={(value) => setProfileDraft((prev) => ({ ...prev, active: value }))}
                    trackColor={{ false: withOpacity(borderColor, 0.3), true: withOpacity(accent, 0.3) }}
                    thumbColor={profileDraft.active ? accent : surface}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <AppText style={[styles.infoLabel, { color: secondaryFont }]}>Name:</AppText>
                <AppText style={[styles.infoValue, { color: primaryFont }]}>{user.name || 'Not set'}</AppText>
              </View>
              <View style={styles.infoRow}>
                <AppText style={[styles.infoLabel, { color: secondaryFont }]}>Email:</AppText>
                <AppText style={[styles.infoValue, { color: primaryFont }]}>{user.email}</AppText>
              </View>
              <View style={styles.infoRow}>
                <AppText style={[styles.infoLabel, { color: secondaryFont }]}>Status:</AppText>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: user.active
                        ? withOpacity(colors.success || '#4CAF50', 0.1)
                        : withOpacity(colors.error || '#B33A3A', 0.1),
                    },
                  ]}
                >
                  <AppText
                    style={[
                      styles.statusText,
                      {
                        color: user.active ? colors.success || '#4CAF50' : colors.error || '#B33A3A',
                      },
                    ]}
                  >
                    {user.active ? 'Active' : 'Inactive'}
                  </AppText>
                </View>
              </View>
              <View style={styles.infoRow}>
                <AppText style={[styles.infoLabel, { color: secondaryFont }]}>Role:</AppText>
                <AppText style={[styles.infoValue, { color: primaryFont }]}>
                  {user.role === 'admin' ? 'Admin' : 'User'}
                </AppText>
              </View>
            </View>
          )}
        </View>

        {/* Reset Password Section */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: withOpacity(borderColor, 0.3) }]}>
          <View style={styles.sectionHeader}>
            <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Password</AppText>
          </View>
          <PrimaryButton
            label="Reset Password"
            onPress={handleResetPassword}
            disabled={saving}
            style={styles.actionButton}
          />
          <AppText style={[styles.helpText, { color: secondaryFont }]}>
            Sends a password reset email to the user
          </AppText>
        </View>

        {/* Change Role Section */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: withOpacity(borderColor, 0.3) }]}>
          <View style={styles.sectionHeader}>
            <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Role Management</AppText>
          </View>
          <View style={styles.infoRow}>
            <AppText style={[styles.infoLabel, { color: secondaryFont }]}>Current Role:</AppText>
            <AppText style={[styles.infoValue, { color: primaryFont }]}>
              {user.role === 'admin' ? 'Admin' : 'User'}
            </AppText>
          </View>
          <PrimaryButton
            label={user.role === 'admin' ? 'Remove Admin Access' : 'Grant Admin Access'}
            onPress={handleChangeRole}
            disabled={saving}
            style={[styles.actionButton, user.role === 'admin' && styles.dangerButton]}
          />
          <AppText style={[styles.helpText, { color: secondaryFont }]}>
            {user.role === 'admin'
              ? 'Removes admin privileges from this user'
              : 'WARNING: Grants full admin access to this user'}
          </AppText>
        </View>

        {/* Nail Size Profiles Section */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: withOpacity(borderColor, 0.3) }]}>
          <View style={styles.sectionHeader}>
            <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Nail Size Profiles</AppText>
            {/* If user has no profiles, always show Save button. Otherwise, show Edit button when not editing */}
            {nailSizeProfiles.length === 0 || editingSizes ? (
              <View style={styles.editActions}>
                {/* Show Cancel button only if user has existing profiles */}
                {nailSizeProfiles.length > 0 && (
                  <TouchableOpacity
                    onPress={async () => {
                      // Reload profiles from database to reset any changes
                      const profiles = await getUserNailSizeProfiles(userId);
                      const defaultProfile = profiles.find((p) => p.isDefault);
                      const additionalProfiles = profiles.filter((p) => !p.isDefault);
                      
                      setSizesDraft({
                        defaultProfile: defaultProfile
                          ? {
                              id: defaultProfile.id,
                              label: defaultProfile.label || defaultProfile.name || 'My default sizes',
                              sizes: defaultProfile.sizes || createEmptySizeValues(),
                            }
                          : {
                              id: 'default',
                              label: 'My default sizes',
                              sizes: createEmptySizeValues(),
                            },
                        profiles: additionalProfiles.map((profile) => ({
                          id: profile.id,
                          label: profile.label || profile.name || 'Untitled Profile',
                          sizes: profile.sizes || createEmptySizeValues(),
                        })),
                      });
                      
                      setDefaultProfileId(defaultProfile?.id || 'default');
                      setEditingSizes(false);
                    }}
                  >
                    <AppText style={[styles.cancelButton, { color: secondaryFont }]}>Cancel</AppText>
                  </TouchableOpacity>
                )}
                <PrimaryButton
                  label={saving ? 'Saving...' : 'Save'}
                  onPress={handleSaveNailSizes}
                  disabled={saving}
                  style={styles.saveButton}
                />
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingSizes(true)}>
                <AppText style={[styles.editButton, { color: accent }]}>Edit</AppText>
              </TouchableOpacity>
            )}
          </View>

          {/* Always show editor UI when editing or no profiles exist; otherwise show read-only view */}
          {nailSizeProfiles.length === 0 || editingSizes ? (
            <View style={styles.nailSizesSection}>
              <View style={styles.sizeSectionHeader}>
                <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Default nail sizes</AppText>
              </View>
              {renderSizeProfileCard({
                profile: sizesDraft.defaultProfile,
                colors,
                styles,
                isDefault: true,
                onChangeLabel: handleDefaultProfileLabelChange,
                onChangeSize: handleDefaultSizeChange,
              })}

              <View style={styles.sizeSectionHeaderRow}>
                <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Additional profiles</AppText>
                <AppText style={[styles.sizeSectionHint, { color: secondaryFont }]}>
                  Save additional nail sizes.
                </AppText>
              </View>
              {sizesDraft.profiles.length
                ? sizesDraft.profiles.map((profile) =>
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
                  { borderColor: withOpacity(accent, 0.3) },
                ]}
                onPress={handleAddSizeProfile}
                accessibilityRole="button"
              >
                <Icon name="plus" color={accent} size={16} />
                <AppText
                  style={[
                    styles.addSizeButtonText,
                    { color: accent },
                  ]}
                >
                  Add size profile
                </AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nailSizesSection}>
              <View style={styles.sizeSectionHeader}>
                <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Default nail sizes</AppText>
              </View>
              {nailSizeProfiles.find((p) => p.isDefault) ? (
                renderSizeProfileCard({
                  profile: {
                    id: nailSizeProfiles.find((p) => p.isDefault).id,
                    label: nailSizeProfiles.find((p) => p.isDefault).label || nailSizeProfiles.find((p) => p.isDefault).name || 'My default sizes',
                    sizes: nailSizeProfiles.find((p) => p.isDefault).sizes || createEmptySizeValues(),
                  },
                  colors,
                  styles,
                  isDefault: true,
                  onChangeLabel: () => {}, // Read-only
                  onChangeSize: () => {}, // Read-only
                })
              ) : (
                <AppText style={[styles.emptyText, { color: secondaryFont }]}>No default profile</AppText>
              )}

              {nailSizeProfiles.filter((p) => !p.isDefault).length > 0 && (
                <>
                  <View style={styles.sizeSectionHeaderRow}>
                    <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Additional profiles</AppText>
                  </View>
                  {nailSizeProfiles
                    .filter((p) => !p.isDefault)
                    .map((profile) =>
                      renderSizeProfileCard({
                        profile: {
                          id: profile.id,
                          label: profile.label || profile.name || 'Untitled Profile',
                          sizes: profile.sizes || createEmptySizeValues(),
                        },
                        colors,
                        styles,
                        isDefault: false,
                        onChangeLabel: () => {}, // Read-only
                        onChangeSize: () => {}, // Read-only
                      }),
                    )}
                </>
              )}
            </View>
          )}
        </View>

        {/* Activity Log Section */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: withOpacity(borderColor, 0.3) }]}>
          <TouchableOpacity
            onPress={() => setActivityExpanded((prev) => !prev)}
            style={styles.sectionHeader}
          >
            <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Activity Log</AppText>
            <Icon
              name="chevronRight"
              color={secondaryFont}
              size={20}
              style={activityExpanded && { transform: [{ rotate: '90deg' }] }}
            />
          </TouchableOpacity>

          {activityExpanded && (
            <View style={styles.activityList}>
              {activityLog.length === 0 ? (
                <AppText style={[styles.emptyText, { color: secondaryFont }]}>No activity recorded</AppText>
              ) : (
                activityLog.map((activity, index) => (
                  <View key={index} style={styles.activityItem}>
                    <AppText style={[styles.activityDescription, { color: primaryFont }]}>
                      {activity.description}
                    </AppText>
                    <AppText style={[styles.activityTimestamp, { color: secondaryFont }]}>
                      {formatDate(activity.timestamp)}
                    </AppText>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* User Stats Section */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: withOpacity(borderColor, 0.3) }]}>
          <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Account Statistics</AppText>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <AppText style={[styles.statLabel, { color: secondaryFont }]}>Account Created</AppText>
              <AppText style={[styles.statValue, { color: primaryFont }]}>{formatDate(user.created_at)}</AppText>
            </View>
            <View style={styles.statItem}>
              <AppText style={[styles.statLabel, { color: secondaryFont }]}>Last Login</AppText>
              <AppText style={[styles.statValue, { color: primaryFont }]}>{formatDate(user.last_login)}</AppText>
            </View>
            <View style={styles.statItem}>
              <AppText style={[styles.statLabel, { color: secondaryFont }]}>Total Orders</AppText>
              <AppText style={[styles.statValue, { color: primaryFont }]}>{user.orderCount || 0}</AppText>
            </View>
            <View style={styles.statItem}>
              <AppText style={[styles.statLabel, { color: secondaryFont }]}>Failed Logins</AppText>
              <AppText style={[styles.statValue, { color: primaryFont }]}>{user.failed_login_count || 0}</AppText>
            </View>
          </View>
        </View>

        {/* Impersonate Section */}
        <View style={[styles.section, { backgroundColor: surface, borderColor: withOpacity(colors.error || '#B33A3A', 0.3) }]}>
          <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Impersonate User</AppText>
          <AppText style={[styles.helpText, { color: secondaryFont, marginBottom: 12 }]}>
            View the app as this user. This action will be logged for security purposes.
          </AppText>
          <PrimaryButton
            label="Impersonate User"
            onPress={handleImpersonate}
            disabled={saving}
            style={[styles.actionButton, styles.dangerButton]}
          />
        </View>
      </ScrollView>

      {confirmation ? (
        <View style={[styles.toast, { backgroundColor: withOpacity(accent, 0.92) }]}>
          <AppText style={[styles.toastText, { color: colors.accentContrast || '#FFFFFF' }]}>{confirmation}</AppText>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// Render function matching ProfileScreen's renderSizeProfileCard
function renderSizeProfileCard({
  profile,
  colors,
  styles,
  isDefault,
  onChangeLabel,
  onChangeSize,
  onRemove,
}) {
  const isReadOnly = typeof onChangeLabel !== 'function' || typeof onChangeSize !== 'function';
  
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
          <AppText style={styles.sizeProfileTitle}>
            {isDefault ? 'Default profile' : 'Additional profile'}
          </AppText>
        </View>
        {!isDefault && !isReadOnly && onRemove && (
          <TouchableOpacity
            onPress={onRemove}
            accessibilityRole="button"
            style={styles.sizeRemoveButton}
          >
            <Icon name="trash" color={withOpacity(colors.primaryFont || '#220707', 0.6)} size={16} />
            <AppText
              style={[
                styles.sizeRemoveText,
                { color: withOpacity(colors.primaryFont || '#220707', 0.6) },
              ]}
            >
              Remove
            </AppText>
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
        editable={!isReadOnly}
        placeholder={isDefault ? 'My default sizes' : 'Profile name'}
        placeholderTextColor={withOpacity(colors.secondaryFont || '#5C5F5D', 0.6)}
      />

      <View style={styles.sizeGrid}>
        {FINGER_DISPLAY.map(({ key, label }) => (
          <View key={`${profile.id}_${key}`} style={styles.sizeCell}>
            <AppText style={[styles.sizeLabel, { color: colors.secondaryFont || '#5C5F5D' }]}>
              {label}
            </AppText>
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
              onChangeText={isReadOnly ? undefined : (value) => onChangeSize(key, value)}
              editable={!isReadOnly}
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
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 36,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      gap: 16,
    },
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
    },
    section: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    editButton: {
      fontSize: 14,
      fontWeight: '600',
    },
    editActions: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    cancelButton: {
      fontSize: 14,
      fontWeight: '600',
    },
    saveButton: {
      minWidth: 80,
    },
    form: {
      gap: 16,
    },
    formField: {
      gap: 8,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    formInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    infoGrid: {
      gap: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    infoLabel: {
      fontSize: 14,
      minWidth: 80,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    actionButton: {
      marginTop: 8,
    },
    dangerButton: {
      backgroundColor: withOpacity(colors.error || '#B33A3A', 0.1),
    },
    helpText: {
      fontSize: 12,
      marginTop: 4,
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
    sizesEditor: {
      gap: 16,
    },
    profilesList: {
      gap: 12,
    },
    profileCard: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      gap: 12,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    profileNameInput: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      borderBottomWidth: 1,
      borderBottomColor: withOpacity(borderColor, 0.3),
      paddingBottom: 4,
    },
    profileName: {
      fontSize: 16,
      fontWeight: '600',
    },
    profileActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    deleteButton: {
      padding: 6,
      marginLeft: 4,
    },
    defaultButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
    },
    defaultButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    defaultBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    defaultBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    sizesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    sizeInputContainer: {
      width: '18%',
      minWidth: 60,
      gap: 4,
    },
    sizeLabel: {
      fontSize: 12,
      textAlign: 'center',
    },
    sizeInput: {
      borderWidth: 1,
      borderRadius: 6,
      padding: 8,
      fontSize: 14,
      textAlign: 'center',
    },
    sizesDisplay: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    sizeDisplayItem: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    sizeDisplayLabel: {
      fontSize: 12,
    },
    sizeDisplayValue: {
      fontSize: 12,
      fontWeight: '500',
    },
    addProfileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      gap: 8,
    },
    addProfileButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    activityList: {
      gap: 12,
      marginTop: 8,
    },
    activityItem: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: withOpacity(colors.primaryBackground || '#F4EBE3', 0.5),
      gap: 4,
    },
    activityDescription: {
      fontSize: 14,
    },
    activityTimestamp: {
      fontSize: 12,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginTop: 8,
    },
    statItem: {
      minWidth: '45%',
      gap: 4,
    },
    statLabel: {
      fontSize: 12,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      padding: 20,
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
  });
}

export default UserDetailScreen;

