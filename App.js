import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import ThemeProvider from './src/theme';
import APP_CONFIG from './src/config/appConfig';
import { AppStateProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';

if (!APP_CONFIG.stripePublishableKey || APP_CONFIG.stripePublishableKey.includes('replace')) {
  // eslint-disable-next-line no-console
  console.warn(
    'Stripe publishable key not configured. Update src/config/appConfig.js before processing real payments.',
  );
}

const App = () => (
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

export default App;
