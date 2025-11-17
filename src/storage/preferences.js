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

    // Save default profile
    if (normalized.defaultProfile) {
      await upsertNailSizeProfile(userId, {
        // Use the existing default profile's ID if it exists, otherwise create new
        id: existingDefault?.id || (normalized.defaultProfile.id !== 'default' ? normalized.defaultProfile.id : undefined),
        label: normalized.defaultProfile.label || 'My default sizes',
        is_default: true,
        sizes: normalized.defaultProfile.sizes || createEmptySizeValues(),
      });
    }

    // Save additional profiles
    if (Array.isArray(normalized.profiles)) {
      for (const profile of normalized.profiles) {
        // Skip temporary IDs - they'll be created as new profiles
        if (profile.id && !profile.id.startsWith('profile_') && !profile.id.startsWith('temp_')) {
          await upsertNailSizeProfile(userId, {
            id: profile.id,
            label: profile.label || 'Untitled Profile',
            is_default: false,
            sizes: profile.sizes || createEmptySizeValues(),
          });
        } else {
          // Create new profile for temporary IDs
          await upsertNailSizeProfile(userId, {
            id: undefined,
            label: profile.label || 'Untitled Profile',
            is_default: false,
            sizes: profile.sizes || createEmptySizeValues(),
          });
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

