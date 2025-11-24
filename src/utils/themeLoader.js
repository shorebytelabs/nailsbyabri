/**
 * Theme Loader Utility
 * Loads the saved theme ID from native storage before React Native renders
 * This prevents the flash of default theme on app startup
 */
import { NativeModules } from 'react-native';

const DEFAULT_THEME_ID = 'classicChristmas';

/**
 * Get saved theme ID from native storage
 * This is called before ThemeProvider renders to avoid theme flash
 * @returns {Promise<string>} Theme ID (e.g., 'winterMorning', 'classicChristmas')
 */
export async function getSavedThemeId() {
  try {
    const { SplashThemeModule } = NativeModules;
    if (SplashThemeModule && SplashThemeModule.getThemeId) {
      const themeId = await SplashThemeModule.getThemeId();
      if (__DEV__) {
        console.log('[themeLoader] ✅ Loaded saved theme ID from native storage:', themeId);
      }
      return themeId || DEFAULT_THEME_ID;
    }
    
    // Fallback if native module not available
    if (__DEV__) {
      console.warn('[themeLoader] ⚠️ SplashThemeModule not available, using default theme');
    }
    return DEFAULT_THEME_ID;
  } catch (error) {
    console.error('[themeLoader] ❌ Error loading saved theme ID:', error);
    return DEFAULT_THEME_ID;
  }
}

/**
 * Save theme ID to native storage
 * Called when theme changes to persist for next app launch
 * @param {string} themeId - Theme ID to save
 */
export async function saveThemeId(themeId) {
  try {
    if (!themeId || typeof themeId !== 'string') {
      console.warn('[themeLoader] Invalid theme ID provided:', themeId);
      return;
    }

    const { SplashThemeModule } = NativeModules;
    if (SplashThemeModule && SplashThemeModule.saveThemeId) {
      await SplashThemeModule.saveThemeId(themeId);
      if (__DEV__) {
        console.log('[themeLoader] ✅ Saved theme ID to native storage:', themeId);
      }
    } else {
      console.warn('[themeLoader] ⚠️ SplashThemeModule not available, theme ID not saved');
    }
  } catch (error) {
    console.error('[themeLoader] ❌ Error saving theme ID:', error);
  }
}

