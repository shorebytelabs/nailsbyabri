import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import classicChristmas from './classicChristmas.json';
import modernMaroon from './modernMaroon.json';
import { getActiveTheme, subscribeToActiveTheme } from '../services/appSettingsService';

const themeRegistry = [classicChristmas, modernMaroon];
const themeIndex = themeRegistry.reduce((acc, theme) => {
  acc[theme.id] = theme;
  return acc;
}, {});

const defaultTheme = themeIndex.classicChristmas || themeRegistry[0];
const BASE_COLOR_TOKENS = {
  primaryBackground: '#F4EBE3',
  secondaryBackground: '#BF9B7A',
  surface: '#FFFFFF',
  surfaceMuted: '#F9F3ED',
  primaryFont: '#354037',
  secondaryFont: '#767154',
  onSurface: '#354037',
  accent: '#6F171F',
  accentContrast: '#FFFFFF',
  hover: '#BF9B7A',
  border: '#D9C8A9',
  divider: '#E6DCD0',
  success: '#4B7A57',
  error: '#B33A3A',
  warning: '#C27A3B',
  shadow: '#000000',
  swatchBase: '#FCE9E3',
  swatchTone1: '#F8D9DD',
  swatchTone2: '#E5C7DA',
  swatchTone3: '#D7B4C2',
};

const ThemeContext = createContext({
  theme: defaultTheme,
  themeId: defaultTheme.id,
  setThemeById: () => {},
  availableThemes: themeRegistry,
});

export function ThemeProvider({ initialThemeId = defaultTheme.id, children }) {
  const [themeId, setThemeId] = useState(
    themeIndex[initialThemeId] ? initialThemeId : defaultTheme.id,
  );
  const [isLoadingGlobalTheme, setIsLoadingGlobalTheme] = useState(true);

  // Load global theme on mount
  useEffect(() => {
    let mounted = true;
    let unsubscribe = null;

    const loadGlobalTheme = async () => {
      try {
        const globalThemeId = await getActiveTheme();
        if (__DEV__) {
          console.log('[ThemeProvider] Loaded global theme:', globalThemeId);
        }
        if (mounted && themeIndex[globalThemeId]) {
          setThemeId(globalThemeId);
        }
      } catch (error) {
        console.error('[ThemeProvider] Error loading global theme:', error);
        // Fall back to initialThemeId if global theme load fails
      } finally {
        if (mounted) {
          setIsLoadingGlobalTheme(false);
        }
      }
    };

    loadGlobalTheme();

    // Subscribe to real-time theme changes
    try {
      unsubscribe = subscribeToActiveTheme((newThemeId) => {
        if (__DEV__) {
          console.log('[ThemeProvider] Global theme changed:', newThemeId);
        }
        if (mounted && themeIndex[newThemeId]) {
          setThemeId(newThemeId);
        }
      });
    } catch (error) {
      console.error('[ThemeProvider] Error subscribing to theme changes:', error);
    }

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // Only run on mount

  const value = useMemo(() => {
    const theme = themeIndex[themeId] || defaultTheme;
    const mergedColors = {
      ...BASE_COLOR_TOKENS,
      ...(theme.colors || {}),
    };

    return {
      theme: { ...theme, colors: mergedColors },
      themeId,
      setThemeById: setThemeId,
      availableThemes: themeRegistry.map((registeredTheme) => ({
        ...registeredTheme,
        colors: {
          ...BASE_COLOR_TOKENS,
          ...(registeredTheme.colors || {}),
        },
      })),
    };
  }, [themeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;

