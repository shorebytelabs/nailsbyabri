/**
 * Splash Screen Theme Utility
 * Saves the current theme's primaryBackground color to native storage
 * so it can be used for the splash screen before React Native loads
 */
import { NativeModules, Platform } from 'react-native';

const SPLASH_THEME_COLOR_KEY = '@nailsbyabri:splash_theme_color';
const DEFAULT_THEME_COLOR = '#F4EBE3'; // classicChristmas primaryBackground

/**
 * Save theme color to native storage for splash screen
 * Uses native module to write directly to UserDefaults (iOS) / SharedPreferences (Android)
 * @param {string} colorHex - Hex color code (e.g., '#F4EBE3')
 */
export async function saveSplashThemeColor(colorHex) {
  try {
    if (!colorHex || typeof colorHex !== 'string') {
      console.warn('[splashScreenTheme] Invalid color provided:', colorHex);
      return;
    }

    // Use native module to save directly to native storage
    // This ensures it's available on next app launch before React Native loads
    const { SplashThemeModule } = NativeModules;
    if (__DEV__) {
      console.log('[splashScreenTheme] Attempting to save color:', colorHex);
      console.log('[splashScreenTheme] SplashThemeModule available:', !!SplashThemeModule);
      console.log('[splashScreenTheme] NativeModules keys:', Object.keys(NativeModules));
    }
    
    if (SplashThemeModule && SplashThemeModule.saveThemeColor) {
      try {
        await SplashThemeModule.saveThemeColor(colorHex);
        if (__DEV__) {
          console.log('[splashScreenTheme] ✅ Saved splash theme color to native storage:', colorHex);
        }
      } catch (error) {
        console.error('[splashScreenTheme] ❌ Error calling native module:', error);
      }
    } else {
      console.warn('[splashScreenTheme] ⚠️ SplashThemeModule not available, trying fallback...');
      // Fallback: Try using AsyncStorage as backup (won't work for splash screen but at least saves it)
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem(SPLASH_THEME_COLOR_KEY, colorHex);
        console.warn('[splashScreenTheme] ⚠️ Saved to AsyncStorage as fallback (may not work for splash screen)');
      } catch (fallbackError) {
        console.error('[splashScreenTheme] ❌ Fallback also failed:', fallbackError);
      }
    }
  } catch (error) {
    console.error('[splashScreenTheme] ❌ Error saving splash theme color:', error);
  }
}

/**
 * Get saved splash theme color (for testing/debugging)
 * @returns {Promise<string>} Hex color code
 */
export async function getSplashThemeColor() {
  try {
    const { SplashThemeModule } = NativeModules;
    if (SplashThemeModule && SplashThemeModule.getThemeColor) {
      const color = await SplashThemeModule.getThemeColor();
      return color || DEFAULT_THEME_COLOR;
    }
    return DEFAULT_THEME_COLOR;
  } catch (error) {
    console.error('[splashScreenTheme] ❌ Error getting splash theme color:', error);
    return DEFAULT_THEME_COLOR;
  }
}

/**
 * Convert hex color to RGB components
 * @param {string} hex - Hex color code (e.g., '#F4EBE3')
 * @returns {{r: number, g: number, b: number}} RGB components (0-255)
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 244, g: 235, b: 227 }; // Default to classicChristmas
}

export { DEFAULT_THEME_COLOR, SPLASH_THEME_COLOR_KEY };

