import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchOrders, updateOrder } from '../services/api';
import { upsertProfile } from '../services/supabaseService';
import { runSupabaseHealthCheck } from '../utils/supabaseHealthCheck';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
} from '../storage/preferences';

const AppStateContext = createContext(null);

const ADMIN_EMAILS = new Set([
  'abriannachheng@gmail.com',
  'arlenealdaychheng@gmail.com',
  'arlenechheng@gmail.com',
]);

function applyAdminFlag(user) {
  if (!user) {
    return user;
  }

  const email = (user.email || '').toLowerCase();
  return {
    ...user,
    isAdmin: ADMIN_EMAILS.has(email),
  };
}

const initialState = {
  currentUser: null,
  pendingConsent: null,
  consentLogs: [],
  preferences: defaultPreferences,
  activeOrder: null,
  lastCompletedOrder: null,
  orders: [],
  ordersLoading: false,
  ordersUpdating: false,
  ordersError: null,
  ordersLoaded: false,
  statusMessage: null,
  loadingPreferences: false,
  loadingConsentLogs: false,
  authRedirect: null,
  authMessage: null,
};

export function AppStateProvider({ children }) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (__DEV__) {
      runSupabaseHealthCheck();
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

  // Consent flow has been removed - this function is kept for compatibility but does nothing
  const enterConsentFlow = useCallback(
    async (user, token, initialLog) => {
      // Consent flow removed - users 13+ can sign up directly
      return false;
    },
    [],
  );

  const loadOrdersForUser = useCallback(async (user) => {
    if (!user) {
      setState((prev) => ({
        ...prev,
        orders: [],
        ordersLoaded: false,
        ordersError: null,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      ordersLoading: true,
      ordersError: null,
    }));

    try {
      if (__DEV__) {
        console.log('[AppContext] Loading orders for user:', user.id, user.email, user.isAdmin ? '(admin)' : '(regular)');
      }
      
      // For admin users, fetch ALL orders (no user filter)
      // For regular users, fetch only their own orders
      const response = await fetchOrders(user.isAdmin ? { allOrders: true } : {});
      const orders = Array.isArray(response?.orders) ? response.orders : [];
      
      if (__DEV__) {
        console.log('[AppContext] ✅ Loaded', orders.length, 'orders for', user.isAdmin ? 'admin' : 'user');
      }
      
      setState((prev) => ({
        ...prev,
        orders,
        ordersLoaded: true,
        ordersError: null,
      }));
    } catch (error) {
      if (__DEV__) {
        console.error('[AppContext] ❌ Failed to load orders:', error);
        console.error('[AppContext] Error details:', error.message, error.code);
      }
      setState((prev) => ({
        ...prev,
        ordersError: error?.message || 'Unable to load orders.',
        ordersLoaded: false,
      }));
    } finally {
      setState((prev) => ({
        ...prev,
        ordersLoading: false,
      }));
    }
  }, []);

  const handleSignupSuccess = useCallback(
    async (response) => {
      if (response.consentRequired) {
        await enterConsentFlow(response.user, response.consentToken, response.consentLog);
      } else {
        const adminUser = applyAdminFlag(response.user);
        setState((prev) => ({
          ...prev,
          currentUser: adminUser,
          pendingConsent: null,
          preferences: defaultPreferences,
          activeOrder: null,
          orders: [],
          ordersLoaded: false,
        }));
        
        // Sync profile to Supabase
        try {
          const result = await upsertProfile({
            id: adminUser.id,
            email: adminUser.email,
            full_name: adminUser.name,
          });
          if (__DEV__) {
            if (result?._simulator_skip) {
              console.log('[supabase] ⏭️  Profile sync skipped (iOS simulator QUIC limitation - profile saved locally)');
            } else {
              console.log('[supabase] ✅ Profile synced to Supabase after signup');
            }
          }
        } catch (error) {
          console.warn('[supabase] ⚠️  Failed to sync profile to Supabase (non-critical):', error.message);
        }
        
        // Load orders for all users (admin and regular)
        loadOrdersForUser(adminUser);
      }
    },
    [enterConsentFlow, loadOrdersForUser],
  );

  const handleLoginSuccess = useCallback(
    async (payload) => {
      const adminUser = applyAdminFlag(payload.user);
      setState((prev) => ({
        ...prev,
        currentUser: adminUser,
        pendingConsent: null,
        orders: [],
        ordersLoaded: false,
      }));
      
      // Sync profile to Supabase
      try {
        const result = await upsertProfile({
          id: adminUser.id,
          email: adminUser.email,
          full_name: adminUser.name,
        });
        if (__DEV__) {
          if (result?._simulator_skip) {
            console.log('[supabase] ⏭️  Profile sync skipped (iOS simulator QUIC limitation - profile saved locally)');
          } else {
            console.log('[supabase] ✅ Profile synced to Supabase after login');
          }
        }
      } catch (error) {
        console.warn('[supabase] ⚠️  Failed to sync profile to Supabase (non-critical):', error?.message || error || 'Unknown error');
      }
      
      // Load orders for all users (admin and regular)
      loadOrdersForUser(adminUser);
    },
    [loadOrdersForUser],
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
      const adminUser = applyAdminFlag(payload.user);
      setState((prev) => ({
        ...prev,
        currentUser: adminUser,
        pendingConsent: null,
        statusMessage: 'Consent approved successfully.',
        orders: [],
        ordersLoaded: false,
      }));
      
      // Sync profile to Supabase (consent is now approved)
      try {
        const result = await upsertProfile({
          id: adminUser.id,
          email: adminUser.email,
          full_name: adminUser.name,
        });
        if (__DEV__) {
          if (result?._simulator_skip) {
            console.log('[supabase] ⏭️  Profile sync skipped (iOS simulator QUIC limitation - profile saved locally)');
          } else {
            console.log('[supabase] ✅ Profile synced to Supabase after consent approval');
          }
        }
      } catch (error) {
        console.warn('[supabase] ⚠️  Failed to sync profile to Supabase (non-critical):', error?.message || error || 'Unknown error');
      }
      
      // Load orders for all users (admin and regular)
      await loadOrdersForUser(adminUser);
    },
    [loadOrdersForUser],
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
    if (state.currentUser?.isAdmin) {
      loadOrdersForUser(state.currentUser);
    }
  }, [loadOrdersForUser, state.currentUser]);

  const updateOrderAdmin = useCallback(async (orderId, payload = {}) => {
    setState((prev) => ({
      ...prev,
      ordersUpdating: true,
      statusMessage: null,
    }));

    try {
      const updated = await updateOrder(orderId, payload);
      setState((prev) => {
        const nextOrders = Array.isArray(prev.orders)
          ? prev.orders.map((order) => (order.id === updated.id ? { ...order, ...updated } : order))
          : prev.orders;

        const nextActiveOrder = prev.activeOrder?.id === updated.id
          ? { ...prev.activeOrder, ...updated }
          : prev.activeOrder;

        const nextLastCompletedOrder = prev.lastCompletedOrder?.id === updated.id
          ? { ...prev.lastCompletedOrder, ...updated }
          : prev.lastCompletedOrder;

        return {
          ...prev,
          orders: nextOrders,
          activeOrder: nextActiveOrder,
          lastCompletedOrder: nextLastCompletedOrder,
          statusMessage: 'Order updated successfully.',
        };
      });

      return updated;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        statusMessage: error?.message || 'Unable to update order.',
      }));
      throw error;
    } finally {
      setState((prev) => ({
        ...prev,
        ordersUpdating: false,
      }));
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      state,
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
      loadOrdersForUser,
      updateOrderAdmin,
      enterConsentFlow,
      ensureAuthenticated,
      clearAuthRedirect,
      setState,
    }),
    [
      state,
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
      loadOrdersForUser,
      updateOrderAdmin,
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

