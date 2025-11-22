import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import classicChristmas from './classicChristmas.json';
import modernMaroon from './modernMaroon.json';
import snow from './snow.json';
import winterMorning from './winterMorning.json';
import autumnLeaves from './autumnLeaves.json';
import cozyCandlelight from './cozyCandlelight.json';
import frostedLilac from './frostedLilac.json';
import frostedBerry from './frostedBerry.json';
import deepTeal from './deepTeal.json';
import slateBlue from './slateBlue.json';
import warmCharcoal from './warmCharcoal.json';
import { 
  getActiveTheme, 
  subscribeToActiveTheme,
  getActiveAnimation,
  subscribeToActiveAnimation 
} from '../services/appSettingsService';
import BackgroundAnimation from '../components/BackgroundAnimation';

const themeRegistry = [classicChristmas, modernMaroon, snow, winterMorning, autumnLeaves, cozyCandlelight, frostedLilac, frostedBerry, deepTeal, slateBlue, warmCharcoal];
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
  const [activeAnimationId, setActiveAnimationId] = useState(null);
  const [isLoadingGlobalTheme, setIsLoadingGlobalTheme] = useState(true);
  const [isLoadingAnimation, setIsLoadingAnimation] = useState(true);

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

    // Load active animation on mount
    const loadActiveAnimation = async () => {
      try {
        const animationId = await getActiveAnimation();
        if (__DEV__) {
          console.log('[ThemeProvider] Loaded active animation from database:', animationId);
        }
        if (mounted) {
          // Normalize null/undefined to 'none'
          const normalizedId = animationId || 'none';
          if (__DEV__) {
            console.log('[ThemeProvider] Setting activeAnimationId to:', normalizedId);
          }
          setActiveAnimationId(normalizedId);
          setIsLoadingAnimation(false);
        }
      } catch (error) {
        console.error('[ThemeProvider] Error loading active animation:', error);
        if (mounted) {
          if (__DEV__) {
            console.log('[ThemeProvider] Error occurred, defaulting to "none"');
          }
          setActiveAnimationId('none');
          setIsLoadingAnimation(false);
        }
      }
    };

    loadActiveAnimation();

    // Subscribe to real-time theme changes
    let unsubscribeTheme = null;
    try {
      unsubscribeTheme = subscribeToActiveTheme((newThemeId) => {
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

    // Subscribe to real-time animation changes
    let unsubscribeAnimation = null;
    try {
      unsubscribeAnimation = subscribeToActiveAnimation((newAnimationId) => {
        if (__DEV__) {
          console.log('[ThemeProvider] 🎨 Global animation changed via real-time:', newAnimationId);
        }
        if (mounted) {
          // Normalize: null, undefined, or 'none' all become 'none'
          let normalizedId = newAnimationId;
          if (!normalizedId || normalizedId === 'none') {
            normalizedId = 'none';
          }
          if (__DEV__) {
            console.log('[ThemeProvider] 🎨 Setting activeAnimationId to:', normalizedId, '(from:', newAnimationId, ')');
          }
          setActiveAnimationId(normalizedId);
        }
      });
    } catch (error) {
      console.error('[ThemeProvider] Error subscribing to animation changes:', error);
    }

    return () => {
      mounted = false;
      if (unsubscribeTheme) {
        unsubscribeTheme();
      }
      if (unsubscribeAnimation) {
        unsubscribeAnimation();
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

  // Render active animation (independent of theme)
  // Animation is configured separately from theme in admin panel
  // Normalize to ensure 'none' is treated correctly
  const normalizedAnimationId = activeAnimationId === 'none' || !activeAnimationId ? 'none' : activeAnimationId;
  const shouldShowAnimation = normalizedAnimationId && normalizedAnimationId !== 'none';

  if (__DEV__) {
    console.log('[ThemeProvider] 🎨 Active animation ID:', normalizedAnimationId, 'Should show:', shouldShowAnimation);
  }

  return (
    <ThemeContext.Provider value={value}>
      <View style={styles.container}>
        {children}
        <BackgroundAnimation activeAnimationId={normalizedAnimationId} />
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeProvider;

