import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import SignupScreen from '../screens/SignupScreen';
import LoginScreen from '../screens/LoginScreen';
import ConsentScreen from '../screens/ConsentScreen';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';
import OrderBuilderScreen from '../screens/OrderBuilderScreen';
import MainTabs from './MainTabs';
import NewOrderStepperScreen from '../screens/NewOrderStepperScreen';
import { useAppState } from '../context/AppContext';
import { useTheme } from '../theme';
import { logEvent } from '../utils/analytics';

const Stack = createNativeStackNavigator();

function SignupScreenContainer({ navigation }) {
  const { handleSignupSuccess, clearStatusMessage, state } = useAppState();

  useEffect(() => () => clearStatusMessage(), [clearStatusMessage]);

  return (
    <SignupScreen
      onSignupSuccess={async (response) => {
        await handleSignupSuccess(response);
        if (response.consentRequired) {
          navigation.replace('Consent');
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        }
      }}
      onSwitchToLogin={() => navigation.replace('Login')}
    />
  );
}

function LoginScreenContainer({ navigation }) {
  const { handleLoginSuccess, handleConsentPendingLogin } = useAppState();

  return (
    <LoginScreen
      onLoginSuccess={(payload) => {
        handleLoginSuccess(payload);
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }}
      onConsentPending={(info) => {
        handleConsentPendingLogin(info);
        navigation.replace('Consent');
      }}
      onSwitchToSignup={() => navigation.replace('Signup')}
    />
  );
}

function ConsentScreenContainer({ navigation }) {
  const { state, handleConsentComplete } = useAppState();

  return (
    <ConsentScreen
      user={state.pendingConsent?.user}
      consentLog={state.pendingConsent?.consentLog}
      consentToken={state.pendingConsent?.token}
      onConsentComplete={async (payload) => {
        await handleConsentComplete(payload);
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }}
      onBackToLogin={() => navigation.replace('Login')}
    />
  );
}

function OrderBuilderLegacyContainer({ navigation }) {
  const { state, handleDraftSaved, handleOrderComplete, handleOrderCancelled } = useAppState();

  return (
    <OrderBuilderScreen
      user={state.currentUser}
      onClose={() => {
        handleOrderCancelled();
        navigation.goBack();
      }}
      onDraftSaved={(order) => {
        handleDraftSaved(order);
      }}
      onPaymentComplete={(order) => {
        handleOrderComplete(order, 'legacy');
        navigation.navigate('OrderConfirmation', { orderId: order.id });
      }}
      initialOrder={state.activeOrder}
      startInCreateMode={!state.activeOrder}
    />
  );
}

function OrderConfirmationContainer({ route, navigation }) {
  const { state, handleOrderCancelled } = useAppState();
  const order =
    route.params?.order ||
    state.activeOrder ||
    (route.params?.orderId === state.activeOrder?.id ? state.activeOrder : null);

  return (
    <OrderConfirmationScreen
      order={order}
      onDone={() => {
        handleOrderCancelled();
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }}
    />
  );
}

function StatusOverlay() {
  const { state, clearStatusMessage } = useAppState();
  const { theme } = useTheme();
  const backgroundColor = `${theme?.colors?.primaryBackground || '#F4EBE3'}f5`;

  if (!state.loadingConsentLogs && !state.loadingPreferences) {
    return null;
  }

  return (
    <View style={[styles.overlay, { backgroundColor }]}>
      <ActivityIndicator size="large" color={theme?.colors?.accent || '#6F171F'} />
      <Text
        style={[
          styles.overlayText,
          { color: theme?.colors?.primaryFont || '#220707' },
        ]}
      >
        {state.loadingConsentLogs ? 'Refreshing consent history…' : 'Loading preferences…'}
      </Text>
      {state.statusMessage ? (
        <Text
          onPress={clearStatusMessage}
          style={[
            styles.overlayDismiss,
            { color: theme?.colors?.accent || '#6F171F' },
          ]}
        >
          Dismiss
        </Text>
      ) : null}
    </View>
  );
}

function BannerToast() {
  const { state, clearStatusMessage } = useAppState();
  const { theme } = useTheme();

  if (!state.statusMessage) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme?.colors?.secondaryBackground || '#E7D8CA',
          borderColor: theme?.colors?.border || '#D9C8A9',
        },
      ]}
    >
      <Text
        style={[
          styles.bannerText,
          { color: theme?.colors?.primaryFont || '#220707' },
        ]}
      >
        {state.statusMessage}
      </Text>
      <Text
        accessibilityRole="button"
        onPress={clearStatusMessage}
        style={[
          styles.bannerAction,
          { color: theme?.colors?.accent || '#531C22' },
        ]}
      >
        Dismiss
      </Text>
    </View>
  );
}

function AppNavigator() {
  const { state } = useAppState();
  const isAuthenticated = Boolean(state.currentUser);
  const hasPendingConsent = Boolean(state.pendingConsent);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'MainTabs' : 'Signup'}
        screenOptions={{ headerShown: false }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Signup" component={SignupScreenContainer} />
            <Stack.Screen name="Login" component={LoginScreenContainer} />
          </>
        ) : null}

        {hasPendingConsent ? (
          <Stack.Screen name="Consent" component={ConsentScreenContainer} />
        ) : null}

        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="NewOrderFlow"
          component={NewOrderStepperScreen}
          options={{
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="LegacyOrderBuilder"
          component={OrderBuilderLegacyContainer}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="OrderConfirmation" component={OrderConfirmationContainer} />
      </Stack.Navigator>
      <BannerToast />
      <StatusOverlay />
    </NavigationContainer>
  );
}

export default AppNavigator;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 100,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10,
  },
  overlayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  overlayDismiss: {
    marginLeft: 12,
    fontWeight: '600',
  },
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bannerText: {
    flex: 1,
    marginRight: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  bannerAction: {
    fontSize: 14,
    fontWeight: '700',
  },
});

