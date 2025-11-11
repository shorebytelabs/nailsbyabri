import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = '@nailsbyabri:prefs:';

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

export async function loadPreferences(userId) {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) {
      return defaultPreferences;
    }
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object' && parsed.nailSizes) {
      return {
        nailSizes: normalizeNailSizes(parsed.nailSizes),
      };
    }

    // Backwards compatibility with legacy preference shape.
    return defaultPreferences;
  } catch (error) {
    console.warn('Failed to load preferences', error);
    return defaultPreferences;
  }
}

export async function savePreferences(userId, preferences) {
  try {
    const payload = {
      nailSizes: normalizeNailSizes(preferences?.nailSizes),
    };
    await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist preferences', error);
  }
}

export { normalizeNailSizes, createEmptySizeValues, FINGER_KEYS };

