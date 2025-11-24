import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import ThemeProvider from './src/theme';
import APP_CONFIG from './src/config/appConfig';
import { AppStateProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { runSupabaseHealthCheck } from './src/utils/supabaseHealthCheck';
import { getSavedThemeId } from './src/utils/themeLoader';
import classicChristmas from './src/theme/classicChristmas.json';
import modernMaroon from './src/theme/modernMaroon.json';
import snow from './src/theme/snow.json';
import winterMorning from './src/theme/winterMorning.json';
import autumnLeaves from './src/theme/autumnLeaves.json';
import cozyCandlelight from './src/theme/cozyCandlelight.json';
import frostedLilac from './src/theme/frostedLilac.json';
import frostedBerry from './src/theme/frostedBerry.json';
import deepTeal from './src/theme/deepTeal.json';
import slateBlue from './src/theme/slateBlue.json';
import warmCharcoal from './src/theme/warmCharcoal.json';

// Logs will appear in:
// 1. Metro Bundler terminal (where you run npm run start:dev)
// 2. Xcode Console (View → Debug Area → Activate Console)
// 3. React Native Debugger (if connected)

// HIGHLY VISIBLE TEST LOG - You should see this immediately
console.log('═══════════════════════════════════════════════════════════');
console.log('🚀 APP.JS LOADED - LOGS ARE WORKING! 🚀');
console.log('═══════════════════════════════════════════════════════════');
console.log('[App] Starting application...');

if (!APP_CONFIG.stripePublishableKey || APP_CONFIG.stripePublishableKey.includes('replace')) {
  // eslint-disable-next-line no-console
  console.warn(
    'Stripe publishable key not configured. Update src/config/appConfig.js before processing real payments.',
  );
}

const App = () => {
  const [initialThemeId, setInitialThemeId] = useState(APP_CONFIG.defaultThemeId);
  const [isThemeReady, setIsThemeReady] = useState(false);

  // Load saved theme ID from native storage BEFORE rendering ThemeProvider
  // This prevents the flash of default theme
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const savedThemeId = await getSavedThemeId();
        if (__DEV__) {
          console.log('[App] 🎨 Loaded saved theme ID for initial render:', savedThemeId);
        }
        setInitialThemeId(savedThemeId);
      } catch (error) {
        console.error('[App] ❌ Error loading saved theme ID:', error);
        // Use default if loading fails
        setInitialThemeId(APP_CONFIG.defaultThemeId);
      } finally {
        // Mark theme as ready so we can render
        setIsThemeReady(true);
      }
    };

    loadSavedTheme();

    // Test Supabase connection on app start
    if (__DEV__) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('[App] Running Supabase health check...');
      console.log('═══════════════════════════════════════════════════════════');
      runSupabaseHealthCheck().then((result) => {
        console.log('═══════════════════════════════════════════════════════════');
        if (result.ok) {
          console.log('[App] ✅ Supabase connection successful!');
        } else if (result.skipped) {
          console.log('[App] ⏭️  Supabase health check skipped (env vars not configured)');
        } else {
          console.warn('[App] ❌ Supabase connection failed:', result.error?.message);
        }
        console.log('═══════════════════════════════════════════════════════════');
      });
    }
  }, []);

  // Show loading screen until theme is ready
  // This prevents any flash of default theme
  // Use the saved theme's background color for the loading screen
  if (!isThemeReady) {
    // Get the theme color for the loading screen background
    // This ensures smooth transition from splash to app
    const themeMap = {
      classicChristmas,
      modernMaroon,
      snow,
      winterMorning,
      autumnLeaves,
      cozyCandlelight,
      frostedLilac,
      frostedBerry,
      deepTeal,
      slateBlue,
      warmCharcoal,
    };
    const theme = themeMap[initialThemeId] || classicChristmas;
    const mergedColors = {
      primaryBackground: '#F4EBE3', // BASE_COLOR_TOKENS default
      ...(theme?.colors || {}),
    };
    const loadingBgColor = mergedColors.primaryBackground;
    
    // Get appropriate text color for activity indicator
    const isDarkTheme = ['snow', 'deepTeal', 'slateBlue', 'warmCharcoal'].includes(initialThemeId);
    const indicatorColor = isDarkTheme ? '#FFFFFF' : '#6F171F';
    
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: loadingBgColor }}>
        <ActivityIndicator size="large" color={indicatorColor} />
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={APP_CONFIG.stripePublishableKey}>
      <ThemeProvider initialThemeId={initialThemeId}>
        <AppStateProvider>
          <SafeAreaProvider>
            <StatusBar barStyle="dark-content" />
            <AppNavigator />
          </SafeAreaProvider>
        </AppStateProvider>
      </ThemeProvider>
    </StripeProvider>
  );
};

export default App;
