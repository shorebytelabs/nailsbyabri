import React, { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabaseClient';
import SignupScreen from '../screens/SignupScreen';
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import ConsentScreen from '../screens/ConsentScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import OrderBuilderScreen from '../screens/OrderBuilderScreen';
import AdminPanelScreen from '../screens/AdminPanelScreen';
import ManageUsersScreen from '../screens/ManageUsersScreen';
import UserDetailScreen from '../screens/UserDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import MainTabs from './MainTabs';
import NewOrderStepperScreen from '../screens/NewOrderStepperScreen';
import { useAppState } from '../context/AppContext';
import { useTheme } from '../theme';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';

const Stack = createNativeStackNavigator();

function SignupScreenContainer({ navigation }) {
  const { handleSignupSuccess, clearStatusMessage, state } = useAppState();

  useEffect(() => () => clearStatusMessage(), [clearStatusMessage]);

  return (
    <SignupScreen
      navigation={navigation}
      onSignupSuccess={async (response) => {
        // If email confirmation is required, do NOT log the user in
        // SignupScreen will already redirect to login screen
        // Just ensure we're on the login screen (don't call handleSignupSuccess)
        if (response.emailConfirmationRequired) {
          // User should already be redirected to login by SignupScreen
          // Just ensure we're on login screen (don't set user in state)
          navigation.replace('Login');
          return;
        }
        
        // Legacy flow (for backwards compatibility, though shouldn't be used with new flow)
        await handleSignupSuccess(response);
        if (response.consentRequired) {
          navigation.replace('Consent');
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        }
      }}
      onSwitchToLogin={() => navigation.replace('Login')}
      onCancel={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
    />
  );
}

function LoginScreenContainer({ navigation, route }) {
  const {
    state,
    handleLoginSuccess,
    handleConsentPendingLogin,
    clearAuthRedirect,
    setState,
    clearStatusMessage,
  } = useAppState();

  const authMessage = state.authMessage || route?.params?.loginMessage;
  const redirectTarget = state.authRedirect;

  // Clear statusMessage when Login screen is active to prevent duplicate error messages
  // The Login screen already shows inline error messages
  useEffect(() => {
    if (state.statusMessage) {
      clearStatusMessage();
    }
  }, [state.statusMessage, clearStatusMessage]);

  return (
    <LoginScreen
      navigation={navigation}
      authMessage={authMessage}
      onLoginSuccess={(payload) => {
        handleLoginSuccess(payload);
        if (redirectTarget?.type === 'startOrder') {
          clearAuthRedirect();
          if (payload.user?.pendingConsent) {
            setState((prev) => ({
              ...prev,
              statusMessage: 'Parental consent must be approved before placing an order.',
            }));
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            return;
          }

          logEvent('tap_nav_create');
          navigation.reset({
            index: 1,
            routes: [{ name: 'MainTabs' }, { name: 'NewOrderFlow' }],
          });
          return;
        }

        if (redirectTarget?.type === 'tab') {
          const tabName = redirectTarget.tab || 'Home';
          const tabRoutes = ['Home', 'Gallery', 'Orders', 'Profile'].map((name) => ({
            name,
          }));
          const tabIndex = Math.max(
            0,
            tabRoutes.findIndex((route) => route.name === tabName),
          );
          clearAuthRedirect();
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'MainTabs',
                state: {
                  index: tabIndex,
                  routes: tabRoutes,
                },
              },
            ],
          });
          return;
        }

        clearAuthRedirect();
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }}
      onConsentPending={(info) => {
        handleConsentPendingLogin(info);
        navigation.replace('Consent');
      }}
      onSwitchToSignup={() => navigation.replace('Signup')}
      onForgotPassword={() => navigation.navigate('ForgotPassword')}
      onCancel={() => {
        clearAuthRedirect();
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }}
    />
  );
}

function ForgotPasswordScreenContainer({ navigation }) {
  return (
    <ForgotPasswordScreen
      onBackToLogin={() => navigation.goBack()}
      onCancel={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
    />
  );
}

function ResetPasswordScreenContainer({ navigation, route }) {
  // Get the token from route params if passed
  const tokenFromRoute = route?.params?.token;
  
  return (
    <ResetPasswordScreen
      initialToken={tokenFromRoute}
      onSuccess={() => {
        // Navigate to login screen after successful password reset
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }}
      onCancel={() => {
        // Navigate to Login screen (not MainTabs) since user needs to log in
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }}
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
      onNavigateBack={() => navigation.goBack()}
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
      onViewOrder={(selectedOrder) => {
        const targetOrder = selectedOrder || order;
        if (!targetOrder) {
          return;
        }
        handleOrderCancelled();
        navigation.navigate('OrderDetails', { order: targetOrder });
      }}
    />
  );
}

function StatusOverlay() {
  const { state, clearStatusMessage } = useAppState();
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const overlayBackground = withOpacity(colors.primaryBackground || '#F4EBE3', 0.96);
  const accentColor = colors.accent || '#6F171F';
  const primaryFontColor = colors.primaryFont || '#220707';

  if (!state.loadingConsentLogs && !state.loadingPreferences) {
    return null;
  }

  return (
    <View style={[styles.overlay, { backgroundColor: overlayBackground, shadowColor: colors.shadow || '#000000' }]}>
      <ActivityIndicator size="large" color={accentColor} />
      <Text
        style={[
          styles.overlayText,
          { color: primaryFontColor },
        ]}
      >
        {state.loadingConsentLogs ? 'Refreshing consent history…' : 'Loading preferences…'}
      </Text>
      {state.statusMessage ? (
        <Text
          onPress={clearStatusMessage}
          style={[
            styles.overlayDismiss,
            { color: accentColor },
          ]}
        >
          Dismiss
        </Text>
      ) : null}
    </View>
  );
}

function BannerToast({ navigationRef }) {
  const { state, clearStatusMessage } = useAppState();
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const surfaceColor = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const primaryFontColor = colors.primaryFont || '#220707';
  const accentColor = colors.accent || '#6F171F';

  if (!state.statusMessage) {
    return null;
  }

  // Don't show banner toast on Login screen - the screen already shows inline error messages
  // This prevents duplicate error messages when login fails
  // Also hide if the message is login-related (contains "login" or "auth")
  const currentRoute = navigationRef?.current?.getCurrentRoute();
  const isLoginScreen = currentRoute?.name === 'Login' || 
                        currentRoute?.name === 'LoginScreen';
  const isLoginRelatedError = state.statusMessage?.toLowerCase().includes('login') ||
                              state.statusMessage?.toLowerCase().includes('[auth]');
  
  if (isLoginScreen || (isLoginScreen && isLoginRelatedError)) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: surfaceColor,
          borderColor,
        },
      ]}
    >
      <Text
        style={[
          styles.bannerText,
          { color: primaryFontColor },
        ]}
      >
        {state.statusMessage}
      </Text>
      <Text
        accessibilityRole="button"
        onPress={clearStatusMessage}
        style={[
          styles.bannerAction,
          { color: accentColor },
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
  const [navigationReady, setNavigationReady] = useState(false);
  const navigationRef = React.useRef(null);

  // Configure deep linking for password reset
  // Handle both deep links (nailsbyabri://) and Supabase verify URLs (https://)
  const linking = {
    prefixes: ['nailsbyabri://'],
    config: {
      screens: {
        ResetPassword: 'reset-password',
        Login: 'login',
        Signup: 'signup',
        ForgotPassword: 'forgot-password',
        EmailVerified: 'email-verified',
        MainTabs: {
          screens: {
            Home: 'home',
            Gallery: 'gallery',
            Orders: 'orders',
            Profile: 'profile',
          },
        },
      },
    },
  };

  // Store the token from verify URL so ResetPasswordScreen can use it
  const [pendingResetToken, setPendingResetToken] = useState(null);

  // Handle deep links when app is opened via URL
  useEffect(() => {
    const handleDeepLink = async (url) => {
      if (__DEV__) {
        console.log('[AppNavigator] Deep link received:', url);
      }

      // Check if it's a password reset link or email verification link
      // Supabase sends links in formats:
      // 1. Direct deep link: nailsbyabri://reset-password#access_token=...&type=recovery
      // 2. Supabase verify URL: https://project.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=...
      // 3. Email verification: https://project.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=...
      // We need to handle the verify URL even if redirect_to is wrong (like localhost:3000 or invalid domain)
      if (url && (url.includes('reset-password') || url.includes('email-verified') || url.includes('/auth/v1/verify'))) {
        // If it's a Supabase verify URL, we need to extract the redirect_to parameter
        // and handle the token exchange
        if (url.includes('/auth/v1/verify')) {
          try {
            const urlObj = new URL(url);
            const token = urlObj.searchParams.get('token');
            const type = urlObj.searchParams.get('type');
            const redirectTo = urlObj.searchParams.get('redirect_to');

            // Handle email verification (signup)
            if (type === 'signup' && token) {
              if (__DEV__) {
                console.log('[AppNavigator] Handling email verification (signup)');
                console.log('[AppNavigator] Token:', token.substring(0, 20) + '...');
                console.log('[AppNavigator] Redirect to:', redirectTo);
              }
              
              // For email verification, Supabase processes the token server-side when the link is clicked
              // We need to verify the token using verifyOtp, but note that signup tokens work differently
              // Try verifyOtp first, and if it fails, the email might still be verified server-side
              try {
                const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
                  token_hash: token,
                  type: 'signup',
                });

                if (sessionError) {
                  if (__DEV__) {
                    console.warn('[AppNavigator] verifyOtp failed, but email may still be verified server-side:', sessionError.message);
                  }
                  // Supabase may have already verified the email server-side when the link was clicked
                  // Navigate to login so user can try logging in
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                  return;
                }

                if (sessionData?.session) {
                  if (__DEV__) {
                    console.log('[AppNavigator] ✅ Email verified successfully with session');
                  }
                  // Email is verified, but we don't want to auto-login
                  // Clear the session and navigate to login screen so user can log in manually
                  await supabase.auth.signOut();
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                  return;
                } else {
                  // Token was valid but no session - email is verified, user should log in manually
                  if (__DEV__) {
                    console.log('[AppNavigator] ✅ Email verified (no session) - user should log in manually');
                  }
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                  return;
                }
              } catch (err) {
                if (__DEV__) {
                  console.error('[AppNavigator] Error in email verification flow:', err);
                }
                // Even if verification fails, navigate to login - email might be verified server-side
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                return;
              }
            }

            // Handle password reset (recovery)
            if (type === 'recovery' && token) {
              if (__DEV__) {
                console.log('[AppNavigator] Handling Supabase verify URL with token');
                console.log('[AppNavigator] Token:', token.substring(0, 20) + '...');
                console.log('[AppNavigator] Redirect to:', redirectTo);
              }

              // Store the token so ResetPasswordScreen can use it if verifyOtp fails
              setPendingResetToken(token);

              // Exchange the token for a session using Supabase's verifyOtp method
              // The token from the URL is a password reset token that needs to be verified
              try {
                if (__DEV__) {
                  console.log('[AppNavigator] Verifying password reset token...');
                }

                // Use verifyOtp to exchange the token for a session
                // Note: verifyOtp expects token_hash, but the URL has 'token' parameter
                // We may need to use a different approach - let's try verifyOtp first
                const { data, error } = await supabase.auth.verifyOtp({
                  token_hash: token,
                  type: 'recovery',
                });

                if (error) {
                  if (__DEV__) {
                    console.error('[AppNavigator] Error verifying token:', error);
                    console.error('[AppNavigator] Error details:', error.message);
                  }
                  // Even if verifyOtp fails, navigate to ResetPassword screen with token
                  // It will try to verify the token again
                  if (__DEV__) {
                    console.log('[AppNavigator] verifyOtp failed, navigating to ResetPassword with token');
                  }
                  const navigateToReset = () => {
                    if (navigationRef.current) {
                      navigationRef.current.navigate('ResetPassword', { token });
                    }
                  };
                  if (navigationReady) {
                    setTimeout(navigateToReset, 300);
                  } else {
                    // Wait for navigation to be ready
                    const checkNav = setInterval(() => {
                      if (navigationReady && navigationRef.current) {
                        clearInterval(checkNav);
                        navigateToReset();
                      }
                    }, 100);
                    setTimeout(() => clearInterval(checkNav), 5000);
                  }
                } else if (data.session) {
                  if (__DEV__) {
                    console.log('[AppNavigator] ✅ Session set from verify URL');
                  }
                  // Session is now set - navigate to ResetPassword screen
                  const navigateToReset = () => {
                    if (navigationRef.current) {
                      navigationRef.current.navigate('ResetPassword');
                    }
                  };
                  if (navigationReady) {
                    setTimeout(navigateToReset, 300);
                  } else {
                    // Wait for navigation to be ready
                    const checkNav = setInterval(() => {
                      if (navigationReady && navigationRef.current) {
                        clearInterval(checkNav);
                        navigateToReset();
                      }
                    }, 100);
                    setTimeout(() => clearInterval(checkNav), 5000);
                  }
                }
              } catch (err) {
                if (__DEV__) {
                  console.error('[AppNavigator] Error in verify flow:', err);
                }
              }
            }
          } catch (err) {
            if (__DEV__) {
              console.error('[AppNavigator] Error parsing verify URL:', err);
            }
          }
        } else {
          // Direct deep link format: nailsbyabri://reset-password#access_token=...&type=recovery
          // OR just nailsbyabri://reset-password (when Supabase redirects after processing)
          if (__DEV__) {
            console.log('[AppNavigator] Direct deep link to reset-password');
          }
          
          const hash = url.split('#')[1];
          if (hash) {
            try {
              // Parse hash parameters
              const params = new URLSearchParams(hash);
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');
              const type = params.get('type');

              if (type === 'recovery' && accessToken && refreshToken) {
                if (__DEV__) {
                  console.log('[AppNavigator] Setting session from password reset link');
                }
                // Set the session using the tokens from the URL
                const { data, error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });

                if (error) {
                  if (__DEV__) {
                    console.error('[AppNavigator] Error setting session from deep link:', error);
                  }
                } else if (data.session) {
                  if (__DEV__) {
                    console.log('[AppNavigator] ✅ Session set from password reset link');
                  }
                }
              }
            } catch (err) {
              if (__DEV__) {
                console.error('[AppNavigator] Error parsing deep link:', err);
              }
            }
          }
          
          // Navigate to ResetPassword screen regardless of whether we have tokens in hash
          // The screen will check for session or try to verify token from URL
          if (navigationReady && navigationRef.current) {
            if (__DEV__) {
              console.log('[AppNavigator] Navigating to ResetPassword screen');
            }
            // Use a small delay to ensure navigation is ready
            setTimeout(() => {
              navigationRef.current?.navigate('ResetPassword', {
                token: pendingResetToken, // Pass token if we have it from verify URL
              });
            }, 300);
          } else {
            // Navigation not ready yet, wait for it
            if (__DEV__) {
              console.log('[AppNavigator] Navigation not ready, will navigate when ready');
            }
            const checkNav = setInterval(() => {
              if (navigationReady && navigationRef.current) {
                clearInterval(checkNav);
                navigationRef.current?.navigate('ResetPassword', {
                  token: pendingResetToken,
                });
              }
            }, 100);
            // Clear interval after 5 seconds to avoid infinite loop
            setTimeout(() => clearInterval(checkNav), 5000);
          }
        }
      }
    };

    // Handle initial URL (when app is opened via deep link)
    // This is critical - it handles the URL when app is opened from a closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        if (__DEV__) {
          console.log('[AppNavigator] ✅ Initial URL detected:', url);
        }
        handleDeepLink(url);
      } else {
        if (__DEV__) {
          console.log('[AppNavigator] No initial URL found');
        }
      }
    }).catch((err) => {
      if (__DEV__) {
        console.error('[AppNavigator] Error getting initial URL:', err);
      }
    });

    // Handle URL when app is already running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Also listen for app state changes to catch URLs when app comes to foreground
    // This helps catch cases where the URL is processed after app initialization
    const checkUrlOnForeground = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url && (url.includes('reset-password') || url.includes('/auth/v1/verify'))) {
          if (__DEV__) {
            console.log('[AppNavigator] Found URL on foreground check:', url.substring(0, 100));
          }
          handleDeepLink(url);
        }
      } catch (err) {
        // Ignore errors
      }
    };

    // Check URL when app comes to foreground (handles case where link is clicked while app is backgrounded)
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Small delay to ensure URL is available
        setTimeout(checkUrlOnForeground, 500);
      }
    });

    return () => {
      subscription.remove();
      appStateSubscription?.remove();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        setNavigationReady(true);
        if (__DEV__) {
          console.log('[AppNavigator] Navigation ready');
        }
      }}
    >
      <Stack.Navigator initialRouteName="MainTabs" screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Signup" component={SignupScreenContainer} />
            <Stack.Screen name="Login" component={LoginScreenContainer} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreenContainer} />
          </>
        ) : null}

        {hasPendingConsent ? (
          <Stack.Screen name="Consent" component={ConsentScreenContainer} />
        ) : null}

        <Stack.Screen name="MainTabs" component={MainTabs} />
        {/* ResetPassword should be accessible even when authenticated (for password changes) */}
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreenContainer} />
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
        <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
        <Stack.Screen
          name="AdminPanel"
          component={AdminPanelScreen}
          options={{
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="ManageUsers"
          component={ManageUsersScreen}
          options={{
            presentation: 'card',
            headerShown: false, // We have our own header in ManageUsersScreen
            animation: 'slide_from_right', // Ensure it slides in as a new screen
            gestureEnabled: true, // Enable swipe back gesture
          }}
        />
        <Stack.Screen
          name="UserDetail"
          component={UserDetailScreen}
          options={{
            presentation: 'card',
            headerShown: false, // We have our own header in UserDetailScreen
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="Terms"
          component={TermsScreen}
          options={{
            presentation: 'card',
            headerShown: false, // We have our own header in TermsScreen
          }}
        />
        <Stack.Screen
          name="Privacy"
          component={PrivacyScreen}
          options={{
            presentation: 'card',
            headerShown: false, // We have our own header in PrivacyScreen
          }}
        />
      </Stack.Navigator>
      <BannerToast navigationRef={navigationRef} />
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

