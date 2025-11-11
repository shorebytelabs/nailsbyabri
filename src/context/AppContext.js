import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchConsentLogs } from '../services/api';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
} from '../storage/preferences';

const AppStateContext = createContext(null);

const initialState = {
  currentUser: null,
  pendingConsent: null,
  consentLogs: [],
  preferences: defaultPreferences,
  activeOrder: null,
  lastCompletedOrder: null,
  statusMessage: null,
  loadingPreferences: false,
  loadingConsentLogs: false,
  authRedirect: null,
  authMessage: null,
};

export function AppStateProvider({ children }) {
  const [state, setState] = useState(initialState);

  const refreshConsentLogs = useCallback(async (userId) => {
    setState((prev) => ({ ...prev, loadingConsentLogs: true }));
    try {
      const logs = await fetchConsentLogs();
      const filtered = logs.filter((log) => log.userId === userId);
      setState((prev) => ({
        ...prev,
        consentLogs: filtered,
      }));
      return filtered;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        statusMessage: 'Unable to load consent activity.',
      }));
      return [];
    } finally {
      setState((prev) => ({ ...prev, loadingConsentLogs: false }));
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const maybeLoadPreferences = async () => {
      if (!state.currentUser) {
        setState((prev) => ({
          ...prev,
          preferences: defaultPreferences,
          consentLogs: [],
        }));
        return;
      }
      setState((prev) => ({ ...prev, loadingPreferences: true }));
      try {
        const loaded = await loadPreferences(state.currentUser.id);
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            preferences: loaded,
          }));
        }
      } catch (error) {
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            statusMessage: 'Unable to load saved preferences.',
          }));
        }
      } finally {
        if (isMounted) {
          setState((prev) => ({ ...prev, loadingPreferences: false }));
        }
      }
    };

    maybeLoadPreferences();

    return () => {
      isMounted = false;
    };
  }, [state.currentUser]);

  const clearStatusMessage = useCallback(() => {
    setState((prev) => ({ ...prev, statusMessage: null }));
  }, []);

  const setAuthRedirect = useCallback((nextRedirect, message) => {
    setState((prev) => ({
      ...prev,
      authRedirect: nextRedirect || null,
      authMessage: message || (nextRedirect ? 'Log in to continue.' : null),
    }));
  }, []);

  const clearAuthRedirect = useCallback(() => {
    setState((prev) => ({
      ...prev,
      authRedirect: null,
      authMessage: null,
    }));
  }, []);

  const ensureAuthenticated = useCallback(
    ({ navigation, message, redirect } = {}) => {
      if (state.currentUser) {
        return true;
      }

      setAuthRedirect(redirect || null, message);

      if (navigation) {
        let targetNav = navigation;
        let parent = targetNav?.getParent?.();
        while (parent) {
          targetNav = parent;
          parent = targetNav?.getParent?.();
        }
        targetNav?.navigate?.('Login');
      }

      return false;
    },
    [setAuthRedirect, state.currentUser],
  );

  const enterConsentFlow = useCallback(
    async (user, token, initialLog) => {
      let logToUse = initialLog;
      if (!logToUse) {
        const logs = await refreshConsentLogs(user.id);
        logToUse = logs.find((log) => log.status === 'pending') || null;
      }

      if (!logToUse) {
        setState((prev) => ({
          ...prev,
          statusMessage: 'No consent request found. Please contact support.',
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        pendingConsent: {
          user,
          token,
          consentLog: logToUse,
        },
        currentUser: null,
        consentLogs: [],
        preferences: defaultPreferences,
        activeOrder: null,
      }));
      return true;
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
          currentUser: response.user,
          pendingConsent: null,
          preferences: defaultPreferences,
          activeOrder: null,
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
        currentUser: payload.user,
        pendingConsent: null,
      }));
      refreshConsentLogs(payload.user.id);
    },
    [refreshConsentLogs],
  );

  const handleConsentPendingLogin = useCallback(
    ({ user, message }) => {
      setState((prev) => ({
        ...prev,
        statusMessage: message,
      }));
      enterConsentFlow(user);
    },
    [enterConsentFlow],
  );

  const handleConsentComplete = useCallback(
    async (payload) => {
      setState((prev) => ({
        ...prev,
        currentUser: payload.user,
        pendingConsent: null,
        statusMessage: 'Consent approved successfully.',
      }));
      await refreshConsentLogs(payload.user.id);
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
      statusMessage: null,
    });
  }, []);

  const handleStartOrder = useCallback(
    ({ navigation } = {}) => {
      const hasAccess = ensureAuthenticated({
        navigation,
        message: 'Log in to create a custom set.',
        redirect: { type: 'startOrder' },
      });

      if (!hasAccess) {
        return false;
      }
      if (state.currentUser.pendingConsent) {
        setState((prev) => ({
          ...prev,
          statusMessage: 'Parental consent must be approved before placing an order.',
        }));
        return false;
      }
      return true;
    },
    [ensureAuthenticated, state.currentUser],
  );

  const handleDraftSaved = useCallback((order, options = {}) => {
    const { currentStepKey = null, currentSetId = null } = options || {};
    setState((prev) => ({
      ...prev,
      activeOrder: {
        ...order,
        resumeStepKey: currentStepKey,
        resumeSetId: currentSetId,
      },
    }));
  }, []);

  const handleOrderCancelled = useCallback(() => {
    setState((prev) => ({
      ...prev,
      activeOrder: null,
    }));
  }, []);

  const handleOrderComplete = useCallback((order, variant = 'default') => {
    setState((prev) => ({
      ...prev,
      activeOrder: order,
      lastCompletedOrder: { ...order, variant },
    }));
  }, []);

  const contextValue = useMemo(
    () => ({
      state,
      refreshConsentLogs,
      clearStatusMessage,
      handleSignupSuccess,
      handleLoginSuccess,
      handleConsentPendingLogin,
      handleConsentComplete,
      handleUpdatePreferences,
      handleLogout,
      handleStartOrder,
      handleDraftSaved,
      handleOrderCancelled,
      handleOrderComplete,
      enterConsentFlow,
      ensureAuthenticated,
      clearAuthRedirect,
      setState,
    }),
    [
      state,
      refreshConsentLogs,
      clearStatusMessage,
      handleSignupSuccess,
      handleLoginSuccess,
      handleConsentPendingLogin,
      handleConsentComplete,
      handleUpdatePreferences,
      handleLogout,
      handleStartOrder,
      handleDraftSaved,
      handleOrderCancelled,
      handleOrderComplete,
      enterConsentFlow,
      ensureAuthenticated,
      clearAuthRedirect,
    ],
  );

  return <AppStateContext.Provider value={contextValue}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

