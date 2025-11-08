import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = '@nailsbyabri:prefs:';

export const defaultPreferences = {
  favoriteColor: '',
  nailShape: '',
  notes: '',
};

export async function loadPreferences(userId) {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) {
      return defaultPreferences;
    }
    const parsed = JSON.parse(raw);
    return {
      favoriteColor: parsed.favoriteColor || '',
      nailShape: parsed.nailShape || '',
      notes: parsed.notes || '',
    };
  } catch (error) {
    console.warn('Failed to load preferences', error);
    return defaultPreferences;
  }
}

export async function savePreferences(userId, preferences) {
  try {
    await AsyncStorage.setItem(
      `${STORAGE_KEY_PREFIX}${userId}`,
      JSON.stringify(preferences),
    );
  } catch (error) {
    console.warn('Failed to persist preferences', error);
  }
}

