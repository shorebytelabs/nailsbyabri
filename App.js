import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import ThemeProvider from './src/theme';
import APP_CONFIG from './src/config/appConfig';
import { AppStateProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { runSupabaseHealthCheck } from './src/utils/supabaseHealthCheck';

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
  useEffect(() => {
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

  return (
    <StripeProvider publishableKey={APP_CONFIG.stripePublishableKey}>
      <ThemeProvider initialThemeId={APP_CONFIG.defaultThemeId}>
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
