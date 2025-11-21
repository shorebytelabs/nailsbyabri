import { getNailSizeProfiles, upsertNailSizeProfile, deleteNailSizeProfile } from '../services/supabaseService';

const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

const createEmptySizeValues = () =>
  FINGER_KEYS.reduce(
    (acc, finger) => ({
      ...acc,
      [finger]: '',
    }),
    {},
  );

const normalizeProfile = (profile, fallbackLabel) => {
  if (!profile || typeof profile !== 'object') {
    return {
      id: `profile_${Date.now()}`,
      label: fallbackLabel,
      sizes: createEmptySizeValues(),
    };
  }

  const label =
    typeof profile.label === 'string' && profile.label.trim().length
      ? profile.label.trim()
      : fallbackLabel;

  const sizes = { ...createEmptySizeValues(), ...(profile.sizes || {}) };

  return {
    id: profile.id || `profile_${Date.now()}`,
    label,
    sizes,
  };
};

const normalizeNailSizes = (value) => {
  const incoming = value && typeof value === 'object' ? value : {};
  const defaultProfile = normalizeProfile(incoming.defaultProfile, 'My default sizes');
  defaultProfile.id = 'default';

  const profiles = Array.isArray(incoming.profiles)
    ? incoming.profiles.map((profile, index) =>
        normalizeProfile(
          {
            ...profile,
            id: profile?.id || `profile_${index}`,
          },
          `Size profile ${index + 1}`,
        ),
      )
    : [];

  return {
    defaultProfile,
    profiles,
  };
};

export const defaultPreferences = {
  nailSizes: normalizeNailSizes(),
};

/**
 * Load preferences from Supabase
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Preferences object with nailSizes
 */
export async function loadPreferences(userId) {
  try {
    if (!userId) {
      return defaultPreferences;
    }

    // Fetch nail size profiles from Supabase
    const profiles = await getNailSizeProfiles(userId);

    // Transform Supabase format to app format
    const defaultProfile = profiles.find((p) => p.is_default) || profiles[0] || null;
    const additionalProfiles = profiles.filter((p) => !p.is_default);

    const nailSizes = {
      defaultProfile: defaultProfile
        ? {
            id: 'default',
            label: defaultProfile.label || 'My default sizes',
            sizes: defaultProfile.sizes || createEmptySizeValues(),
          }
        : {
            id: 'default',
            label: 'My default sizes',
            sizes: createEmptySizeValues(),
          },
      profiles: additionalProfiles.map((profile) => ({
        id: profile.id,
        label: profile.label || 'Untitled Profile',
        sizes: profile.sizes || createEmptySizeValues(),
      })),
    };

    return {
      nailSizes: normalizeNailSizes(nailSizes),
    };
  } catch (error) {
    console.warn('[preferences] Failed to load preferences from Supabase:', error);
    // Fallback to default preferences on error
    return defaultPreferences;
  }
}

/**
 * Save preferences to Supabase
 * @param {string} userId - User ID
 * @param {Object} preferences - Preferences object with nailSizes
 * @returns {Promise<void>}
 */
export async function savePreferences(userId, preferences) {
  try {
    if (!userId) {
      console.warn('[preferences] Cannot save preferences: no userId provided');
      return;
    }

    const normalized = normalizeNailSizes(preferences?.nailSizes);

    // Get existing profiles to find the default profile's real ID
    const existingProfiles = await getNailSizeProfiles(userId);
    const existingDefault = existingProfiles.find((p) => p.is_default);

    // Track saved profile IDs to prevent duplicates and identify orphans
    const savedProfileIds = new Set();

    // First, save all additional profiles (including the old default if it's in the profiles list)
    if (Array.isArray(normalized.profiles)) {
      for (const profile of normalized.profiles) {
        try {
          // Skip temporary IDs - they'll be created as new profiles
          if (profile.id && !profile.id.startsWith('profile_') && !profile.id.startsWith('temp_')) {
            // Update existing profile (or create if it doesn't exist)
            const result = await upsertNailSizeProfile(userId, {
              id: profile.id,
              label: profile.label || 'Untitled Profile',
              is_default: false, // All profiles in this list are non-default
              sizes: profile.sizes || createEmptySizeValues(),
            });
            if (result?.id) {
              savedProfileIds.add(result.id);
            }
          } else {
            // Create new profile for temporary IDs
            const result = await upsertNailSizeProfile(userId, {
              id: undefined,
              label: profile.label || 'Untitled Profile',
              is_default: false,
              sizes: profile.sizes || createEmptySizeValues(),
            });
            if (result?.id) {
              savedProfileIds.add(result.id);
            }
          }
        } catch (profileError) {
          // If a single profile fails to save, log it but continue with others
          console.warn('[preferences] Failed to save profile:', profile.id, profileError.message);
          // Don't add to savedProfileIds so it can be cleaned up later if needed
        }
      }
    }

    // Now save the default profile
    // Try to find which profile in the database matches the new default by comparing label and sizes
    // If we can't find a match, use the existing default's ID (if it exists)
    let defaultProfileId = existingDefault?.id;
    
    // Try to find the profile that matches the new default by label and sizes
    if (normalized.defaultProfile) {
      const matchingProfile = existingProfiles.find(p => {
        const labelMatch = p.label === (normalized.defaultProfile.label || 'My default sizes');
        const sizesMatch = JSON.stringify(p.sizes) === JSON.stringify(normalized.defaultProfile.sizes || createEmptySizeValues());
        return labelMatch && sizesMatch;
      });
      
      if (matchingProfile) {
        defaultProfileId = matchingProfile.id;
      }
    }

    // Save default profile
    if (normalized.defaultProfile) {
      const result = await upsertNailSizeProfile(userId, {
        id: defaultProfileId,
        label: normalized.defaultProfile.label || 'My default sizes',
        is_default: true,
        sizes: normalized.defaultProfile.sizes || createEmptySizeValues(),
      });
      if (result?.id) {
        savedProfileIds.add(result.id);
      }
    }

    // Also track the old default profile ID if it's different from the new default
    // This ensures it doesn't get deleted as orphaned
    if (existingDefault?.id && existingDefault.id !== defaultProfileId) {
      savedProfileIds.add(existingDefault.id);
    }

    // Delete profiles that are no longer in the draft (orphaned profiles)
    const profilesToDelete = existingProfiles.filter(
      p => !p.is_default && !savedProfileIds.has(p.id)
    );
    
    if (profilesToDelete.length > 0) {
      const { deleteNailSizeProfile } = await import('../services/supabaseService');
      for (const profileToDelete of profilesToDelete) {
        try {
          await deleteNailSizeProfile(userId, profileToDelete.id);
          if (__DEV__) {
            console.log('[preferences] Deleted orphaned profile:', profileToDelete.id);
          }
        } catch (error) {
          console.warn('[preferences] Failed to delete orphaned profile:', error);
        }
      }
    }

    if (__DEV__) {
      console.log('[preferences] ✅ Preferences saved to Supabase');
    }
  } catch (error) {
    console.warn('[preferences] Failed to save preferences to Supabase:', error);
    throw error;
  }
}

export { normalizeNailSizes, createEmptySizeValues, FINGER_KEYS };

