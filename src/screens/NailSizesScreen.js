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

  const renderSizeProfileCard = ({ profile, isDefault, onChangeLabel, onChangeSize, onRemove }) => (
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
          <Text style={styles.sizeProfileTitle}>
            {isDefault ? 'Default profile' : 'Additional profile'}
          </Text>
        </View>
        {!isDefault && (
          <TouchableOpacity
            onPress={onRemove}
            accessibilityRole="button"
            style={styles.sizeRemoveButton}
          >
            <Icon name="trash" color={withOpacity(colors.primaryFont || '#220707', 0.6)} size={16} />
            <Text
              style={[
                styles.sizeRemoveText,
                { color: withOpacity(colors.primaryFont || '#220707', 0.6) },
              ]}
            >
              Remove
            </Text>
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
        placeholder={isDefault ? 'My default sizes' : 'Profile name'}
        placeholderTextColor={withOpacity(colors.secondaryFont || '#5C5F5D', 0.6)}
      />

      <View style={styles.sizeGrid}>
        {FINGER_DISPLAY.map(({ key, label }) => (
          <View key={`${profile.id}_${key}`} style={styles.sizeCell}>
            <Text style={[styles.sizeLabel, { color: colors.secondaryFont || '#5C5F5D' }]}>
              {label}
            </Text>
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
              onChangeText={(value) => onChangeSize(key, value)}
              placeholder="e.g. 3"
              placeholderTextColor={withOpacity(colors.secondaryFont || '#5C5F5D', 0.5)}
              keyboardType="number-pad"
            />
          </View>
        ))}
      </View>
    </View>
  );

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
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Nail Sizes</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: secondaryFont }]}>
          Manage your nail sizes and create additional profiles for different sets.
        </Text>

        <View style={styles.sizesSection}>
          <View style={styles.sizeSectionHeader}>
            <Text style={[styles.sectionTitle, { color: primaryFont }]}>Default profile</Text>
          </View>
          {renderSizeProfileCard({
            profile: nailSizesDraft.defaultProfile,
            isDefault: true,
            onChangeLabel: handleDefaultProfileLabelChange,
            onChangeSize: handleDefaultSizeChange,
          })}

          <View style={styles.sizeSectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: primaryFont }]}>Additional profiles</Text>
            <Text style={[styles.sizeSectionHint, { color: secondaryFont }]}>
              Save additional nail sizes.
            </Text>
          </View>
          {nailSizesDraft.profiles.length
            ? nailSizesDraft.profiles.map((profile) =>
                renderSizeProfileCard({
                  profile,
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
              { borderColor: withOpacity(colors.accent || '#6F171F', 0.3) },
            ]}
            onPress={handleAddSizeProfile}
            accessibilityRole="button"
          >
            <Icon name="plus" color={colors.accent} size={16} />
            <Text
              style={[
                styles.addSizeButtonText,
                { color: colors.accent },
              ]}
            >
              Add size profile
            </Text>
          </TouchableOpacity>

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
  sizesSection: {
    gap: 20,
  },
  sizeSectionHeader: {
    marginBottom: 8,
  },
  sizeSectionHeaderRow: {
    marginTop: 24,
    marginBottom: 12,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sizeSectionHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  sizeProfileCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 16,
  },
  sizeProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sizeProfileHeaderText: {
    flex: 1,
  },
  sizeProfileTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryFont || '#220707',
  },
  sizeRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  sizeRemoveText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sizeProfileNameInput: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sizeCell: {
    flex: 1,
    minWidth: '30%',
    gap: 6,
  },
  sizeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sizeInput: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addSizeButtonText: {
    fontSize: 14,
    fontWeight: '600',
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

