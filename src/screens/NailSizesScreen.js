import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import PrimaryButton from '../components/PrimaryButton';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import {
  normalizeNailSizes as normalizeStoredNailSizes,
  createEmptySizeValues,
} from '../storage/preferences';
import { deleteNailSizeProfile } from '../services/supabaseService';

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

  const handleDefaultProfileLabelChange = (value) => {
    setNailSizesDraft((prev) => ({
      ...prev,
      defaultProfile: {
        ...prev.defaultProfile,
        label: value,
      },
    }));
  };

  const handleDefaultSizeChange = (finger, value) => {
    setNailSizesDraft((prev) => ({
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
    setNailSizesDraft((prev) => ({
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
    setNailSizesDraft((prev) => ({
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
      label: `Additional profile ${nailSizesDraft.profiles.length + 1}`,
      sizes: createEmptySizeValues(),
    };
    setNailSizesDraft((prev) => ({
      ...prev,
      profiles: [...prev.profiles, newProfile],
    }));
    logEvent('profile_add_size_profile');
  };

  const handleRemoveSizeProfile = async (profileId) => {
    // Don't delete if it's the default profile or a temporary ID
    if (profileId === 'default' || profileId.startsWith('profile_') || profileId.startsWith('temp_')) {
      setNailSizesDraft((prev) => ({
        ...prev,
        profiles: prev.profiles.filter((profile) => profile.id !== profileId),
      }));
      logEvent('profile_remove_size_profile', { profile_id: profileId });
      return;
    }

    // Delete from Supabase if it's a real profile
    try {
      await deleteNailSizeProfile(user.id, profileId);
      setNailSizesDraft((prev) => ({
        ...prev,
        profiles: prev.profiles.filter((profile) => profile.id !== profileId),
      }));
      logEvent('profile_remove_size_profile', { profile_id: profileId });
    } catch (error) {
      console.error('Failed to delete nail size profile:', error);
      // Still remove from UI even if delete fails
      setNailSizesDraft((prev) => ({
        ...prev,
        profiles: prev.profiles.filter((profile) => profile.id !== profileId),
      }));
    }
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
      setConfirmation('Nail sizes saved');
      logEvent('profile_save_nail_sizes');
      
      // Navigate back after a brief delay
      setTimeout(() => {
        if (navigation.goBack) {
          navigation.goBack();
        }
      }, 1500);
    } finally {
      setSavingSizes(false);
    }
  };

  const renderSizeProfileCard = ({ profile, isDefault, onChangeLabel, onChangeSize, onRemove }) => {
    const accent = colors.accent || '#6F171F';
    const borderColor = colors.border || withOpacity('#000000', 0.08);
    const surface = colors.surface || '#FFFFFF';
    const primaryFont = colors.primaryFont || '#220707';
    const secondaryFont = colors.secondaryFont || '#5C5F5D';
    const errorColor = colors.error || '#B33A3A';

    return (
      <View
        key={profile.id}
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
            {!isDefault && (
              <TouchableOpacity
                onPress={onRemove}
                style={styles.actionButton}
                accessibilityLabel="Delete profile"
              >
                <Icon name="trash" color={errorColor} size={18} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TextInput
          style={[
            styles.sizeProfileNameInput,
            {
              borderColor: withOpacity(borderColor, 0.5),
              color: primaryFont,
              backgroundColor: surface,
            },
          ]}
          value={profile.label}
          onChangeText={onChangeLabel}
          placeholder={isDefault ? 'My default sizes' : 'Profile name'}
          placeholderTextColor={withOpacity(secondaryFont, 0.5)}
        />

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
              <View key={`${profile.id}_${key}_input`} style={styles.sizeInputCell}>
                <TextInput
                  style={[
                    styles.sizeInput,
                    {
                      borderColor: withOpacity(borderColor, 0.5),
                      color: primaryFont,
                      backgroundColor: surface,
                    },
                  ]}
                  value={profile.sizes?.[key] || ''}
                  onChangeText={(value) => onChangeSize(key, value)}
                  placeholder="e.g. 3"
                  placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                  keyboardType="number-pad"
                />
              </View>
            ))}
          </View>
        </View>
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
              onPress={handleAddSizeProfile}
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
          <View style={styles.profileList}>
            {renderSizeProfileCard({
              profile: nailSizesDraft.defaultProfile,
              isDefault: true,
              onChangeLabel: handleDefaultProfileLabelChange,
              onChangeSize: handleDefaultSizeChange,
            })}
            {nailSizesDraft.profiles.map((profile) =>
              renderSizeProfileCard({
                profile,
                isDefault: false,
                onChangeLabel: (value) => handleProfileNameChange(profile.id, value),
                onChangeSize: (finger, value) =>
                  handleProfileSizeChange(profile.id, finger, value),
                onRemove: () => handleRemoveSizeProfile(profile.id),
              }),
            )}
          </View>

          {confirmation ? (
            <Text style={[styles.successText, { color: successColor }]}>{confirmation}</Text>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton
              label={savingSizes ? 'Saving…' : 'Save Nail Sizes'}
              onPress={handleSaveNailSizes}
              loading={savingSizes}
              accessibilityLabel="Save nail size profiles"
            />
          </View>
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
});

export default NailSizesScreen;

