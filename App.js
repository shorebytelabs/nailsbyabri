import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ConsentScreen from './src/screens/ConsentScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SignupScreen from './src/screens/SignupScreen';
import { fetchConsentLogs } from './src/services/api';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
} from './src/storage/preferences';

const SCREENS = {
  SIGNUP: 'signup',
  LOGIN: 'login',
  CONSENT: 'consent',
  PROFILE: 'profile',
};

const initialState = {
  screen: SCREENS.SIGNUP,
  currentUser: null,
  pendingConsent: null,
  consentLogs: [],
  preferences: defaultPreferences,
};

function App() {
  const [state, setState] = useState(initialState);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    if (!state.currentUser) {
      setState((prev) => ({
        ...prev,
        preferences: defaultPreferences,
        consentLogs: [],
      }));
      return;
    }

    let isMounted = true;
    setLoadingPreferences(true);
    loadPreferences(state.currentUser.id)
      .then((loaded) => {
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            preferences: loaded,
          }));
        }
      })
      .catch(() => {
        setStatusMessage('Unable to load saved preferences.');
      })
      .finally(() => {
        if (isMounted) {
          setLoadingPreferences(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [state.currentUser]);

  const refreshConsentLogs = useCallback(async (userId) => {
    setLoadingLogs(true);
    try {
      const logs = await fetchConsentLogs();
      const filtered = logs.filter((log) => log.userId === userId);
      setState((prev) => ({
        ...prev,
        consentLogs: filtered,
      }));
      return filtered;
    } catch (error) {
      setStatusMessage('Unable to load consent activity.');
      return [];
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const enterConsentFlow = useCallback(
    async (user, token, initialLog) => {
      let logToUse = initialLog;
      if (!logToUse) {
        const logs = await refreshConsentLogs(user.id);
        logToUse = logs.find((log) => log.status === 'pending') || null;
      }

      if (!logToUse) {
        setStatusMessage('No consent request found. Please contact support.');
        return;
      }

      setState((prev) => ({
        ...prev,
        screen: SCREENS.CONSENT,
        pendingConsent: {
          user,
          token,
          consentLog: logToUse,
        },
        currentUser: null,
        consentLogs: [],
        preferences: defaultPreferences,
      }));
    },
    [refreshConsentLogs],
  );

  const handleSignupSuccess = useCallback(
    async (response) => {
      if (response.consentRequired) {
        await enterConsentFlow(response.user, response.consentToken, response.consentLog);
      } else {
        setState((prev) => ({
          ...prev,
          screen: SCREENS.PROFILE,
          currentUser: response.user,
          pendingConsent: null,
          preferences: defaultPreferences,
        }));
        refreshConsentLogs(response.user.id);
      }
    },
    [enterConsentFlow, refreshConsentLogs],
  );

  const handleLoginSuccess = useCallback(
    (payload) => {
      setState((prev) => ({
        ...prev,
        screen: SCREENS.PROFILE,
        currentUser: payload.user,
        pendingConsent: null,
      }));
      refreshConsentLogs(payload.user.id);
    },
    [refreshConsentLogs],
  );

  const handleConsentPendingLogin = useCallback(
    ({ user, message }) => {
      setStatusMessage(message);
      enterConsentFlow(user);
    },
    [enterConsentFlow],
  );

  const handleConsentComplete = useCallback(
    async (payload) => {
      setState((prev) => ({
        ...prev,
        screen: SCREENS.PROFILE,
        currentUser: payload.user,
        pendingConsent: null,
      }));
      await refreshConsentLogs(payload.user.id);
      setStatusMessage('Consent approved successfully.');
    },
    [refreshConsentLogs],
  );

  const handleUpdatePreferences = useCallback(
    async (next) => {
      setState((prev) => ({
        ...prev,
        preferences: next,
      }));
      if (state.currentUser) {
        await savePreferences(state.currentUser.id, next);
      }
    },
    [state.currentUser],
  );

  const handleLogout = useCallback(() => {
    setState({
      ...initialState,
      screen: SCREENS.LOGIN,
    });
  }, []);

  const overlayMessage = useMemo(() => {
    if (loadingLogs) {
      return 'Refreshing consent history...';
    }
    if (loadingPreferences) {
      return 'Loading preferences...';
    }
    return null;
  }, [loadingLogs, loadingPreferences]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.container}>
          {statusMessage ? (
            <Banner message={statusMessage} onDismiss={() => setStatusMessage(null)} />
          ) : null}

          {state.screen === SCREENS.SIGNUP ? (
            <SignupScreen
              onSignupSuccess={handleSignupSuccess}
              onSwitchToLogin={() => setState((prev) => ({ ...prev, screen: SCREENS.LOGIN }))}
            />
          ) : null}

          {state.screen === SCREENS.LOGIN ? (
            <LoginScreen
              onLoginSuccess={handleLoginSuccess}
              onConsentPending={handleConsentPendingLogin}
              onSwitchToSignup={() => setState((prev) => ({ ...prev, screen: SCREENS.SIGNUP }))}
            />
          ) : null}

          {state.screen === SCREENS.CONSENT && state.pendingConsent ? (
            <ConsentScreen
              user={state.pendingConsent.user}
              consentLog={state.pendingConsent.consentLog}
              consentToken={state.pendingConsent.token}
              onConsentComplete={handleConsentComplete}
              onBackToLogin={() =>
                setState((prev) => ({
                  ...prev,
                  screen: SCREENS.LOGIN,
                  pendingConsent: null,
                }))
              }
            />
          ) : null}

          {state.screen === SCREENS.PROFILE && state.currentUser ? (
            <ProfileScreen
              user={state.currentUser}
              consentLogs={state.consentLogs}
              preferences={state.preferences}
              onUpdatePreferences={handleUpdatePreferences}
              onLogout={handleLogout}
              onRefreshConsentLogs={() => {
                if (state.currentUser) {
                  refreshConsentLogs(state.currentUser.id);
                }
              }}
            />
          ) : null}

          {overlayMessage ? (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color="#272b75" />
              <Text style={styles.overlayText}>{overlayMessage}</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Banner({ message, onDismiss }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{message}</Text>
      <Text style={styles.bannerDismiss} onPress={onDismiss}>
        Dismiss
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7fb',
  },
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(247,247,251,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    marginLeft: 12,
    color: '#272b75',
    fontWeight: '600',
  },
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e6eaff',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d6ff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerText: {
    color: '#272b75',
    fontWeight: '600',
    flex: 1,
  },
  bannerDismiss: {
    color: '#272b75',
    fontWeight: '600',
    marginLeft: 16,
  },
});

export default App;
