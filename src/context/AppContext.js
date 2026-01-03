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
  // Check both email list and database role field
  const isAdminByEmail = ADMIN_EMAILS.has(email);
  const isAdminByRole = user.role === 'admin';
  return {
    ...user,
    isAdmin: isAdminByEmail || isAdminByRole,
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
  impersonating: false,
  originalAdminUser: null,
};

export function AppStateProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Restore session on app startup (persistent login)
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        if (__DEV__) {
          console.log('[AppContext] 🔄 Checking for existing session...');
        }

        // Check for existing Supabase session
        const { supabase } = await import('../lib/supabaseClient');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          if (__DEV__) {
            console.log('[AppContext] ⚠️  Session check error (expected if no session):', sessionError.message);
          }
          // No valid session - user needs to log in
          if (isMounted) {
            setIsRestoringSession(false);
          }
          return;
        }

        if (session?.user) {
          if (__DEV__) {
            console.log('[AppContext] ✅ Found existing session, restoring user...');
          }

          // Get user profile
          const { getProfile } = await import('../services/supabaseService');
          let profile = null;
          try {
            profile = await getProfile(session.user.id);
          } catch (profileError) {
            if (__DEV__) {
              console.warn('[AppContext] ⚠️  Failed to fetch profile (non-critical):', profileError?.message);
            }
          }

          const userMetadata = session.user.user_metadata || {};
          const user = {
            id: session.user.id,
            email: session.user.email,
            name: userMetadata.full_name || profile?.full_name || session.user.email,
            age_group: userMetadata.age_group || null,
            age: userMetadata.age_group ? (userMetadata.age_group === '55+' ? 55 : parseInt(userMetadata.age_group.split('-')[0])) : null,
            role: profile?.role || 'user',
            createdAt: session.user.created_at,
            pendingConsent: false,
          };

          const adminUser = applyAdminFlag(user);

          if (isMounted) {
            setState((prev) => ({
              ...prev,
              currentUser: adminUser,
            }));

            if (__DEV__) {
              console.log('[AppContext] ✅ Session restored successfully');
            }
          }
        } else {
          if (__DEV__) {
            console.log('[AppContext] ℹ️  No existing session found');
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[AppContext] ❌ Error restoring session:', error);
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Set up auth state change listener for token refresh
  useEffect(() => {
    let authListener = null;

    const setupAuthListener = async () => {
      try {
        const { supabase } = await import('../lib/supabaseClient');
        
        // Listen for auth state changes (login, logout, token refresh)
        authListener = supabase.auth.onAuthStateChange(async (event, session) => {
          if (__DEV__) {
            console.log('[AppContext] 🔐 Auth state changed:', event, session?.user?.id || 'no user');
          }

          if (event === 'SIGNED_OUT' || !session) {
            // User signed out or session expired
            if (__DEV__) {
              console.log('[AppContext] 👋 User signed out or session expired');
            }
            setState((prev) => ({
              ...prev,
              currentUser: null,
              orders: [],
              ordersLoaded: false,
            }));
            return;
          }

          if (event === 'TOKEN_REFRESHED' && session?.user) {
            // Token was refreshed - session is still valid
            if (__DEV__) {
              console.log('[AppContext] 🔄 Token refreshed successfully');
            }
            // No need to update state - session is still valid
            return;
          }

          if (event === 'SIGNED_IN' && session?.user) {
            // User signed in (but we already handle this in handleLoginSuccess)
            // Only update if we don't already have a current user
            if (!state.currentUser) {
              if (__DEV__) {
                console.log('[AppContext] ✅ User signed in via auth state change');
              }
              // Get user profile and set current user
              try {
                const { getProfile } = await import('../services/supabaseService');
                const profile = await getProfile(session.user.id);
                const userMetadata = session.user.user_metadata || {};
                const user = {
                  id: session.user.id,
                  email: session.user.email,
                  name: userMetadata.full_name || profile?.full_name || session.user.email,
                  age_group: userMetadata.age_group || null,
                  role: profile?.role || 'user',
                  createdAt: session.user.created_at,
                  pendingConsent: false,
                };
                const adminUser = applyAdminFlag(user);
                setState((prev) => ({
                  ...prev,
                  currentUser: adminUser,
                }));
              } catch (error) {
                if (__DEV__) {
                  console.warn('[AppContext] ⚠️  Failed to fetch profile on sign in (non-critical):', error?.message);
                }
              }
            }
          }
        });

        if (__DEV__) {
          console.log('[AppContext] ✅ Auth state listener set up');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[AppContext] ❌ Failed to set up auth listener:', error);
        }
      }
    };

    setupAuthListener();

    return () => {
      if (authListener) {
        authListener.data.subscription.unsubscribe();
        if (__DEV__) {
          console.log('[AppContext] 🔌 Auth state listener removed');
        }
      }
    };
  }, [state.currentUser]);

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
        // Load preferences for current user (admin or impersonated user)
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
  }, [state.currentUser?.id]); // Reload when user ID changes (including impersonation)

  // Load orders when user changes (including impersonation)
  useEffect(() => {
    // Load orders for current user (admin or impersonated user)
    if (state.currentUser) {
      loadOrdersForUser(state.currentUser);
    }
  }, [loadOrdersForUser, state.currentUser?.id]); // Reload when user ID changes (including impersonation)

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
        targetNav?.navigate?.('PasswordlessEntry');
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
      // Get current impersonating state (need to read from state, not closure)
      const isImpersonating = state.impersonating;
      
      if (__DEV__) {
        console.log('[AppContext] Loading orders for user:', user.id, user.email, user.isAdmin ? '(admin)' : '(regular)');
        if (isImpersonating) {
          console.log('[AppContext] ⚠️  Impersonating - will fetch orders for impersonated user ID:', user.id);
        }
      }
      
      // For admin users (when NOT impersonating), fetch ALL orders (no user filter)
      // For regular users (including impersonated users), fetch only their own orders
      // When impersonating, explicitly pass userId to ensure we fetch the impersonated user's orders
      // (not the admin's orders from the session)
      const fetchParams = user.isAdmin && !isImpersonating
        ? { allOrders: true }
        : { userId: user.id }; // Explicitly pass userId for non-admin users and impersonated users
      
      const response = await fetchOrders(fetchParams);
      const orders = Array.isArray(response?.orders) ? response.orders : [];
      
      if (__DEV__) {
        console.log('[AppContext] ✅ Loaded', orders.length, 'orders for', user.isAdmin ? 'admin' : 'user');
        if (isImpersonating) {
          console.log('[AppContext] ✅ Impersonated user orders loaded:', orders.length);
        }
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
  }, [state.impersonating]);

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
        
        // Sync profile to Supabase (only if we have a session)
        // The profile should already be created by the trigger, but we can update it with name
        // Note: During signup, the session might not be immediately available, so we'll skip this
        // The profile will be fully populated on first login
        try {
          // Check if we have a session before trying to upsert
          const { supabase } = await import('../lib/supabaseClient');
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
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
          } else {
            if (__DEV__) {
              console.log('[supabase] ℹ️  No session available after signup - profile sync skipped');
              console.log('[supabase] Profile will be fully populated on first login');
            }
          }
        } catch (error) {
          // Non-critical - profile will be handled on first login
          if (__DEV__) {
            console.warn('[supabase] ⚠️  Failed to sync profile to Supabase (non-critical):', error.message);
            console.warn('[supabase] Profile will be fully populated on first login');
          }
        }
        
        // Load orders for all users (admin and regular)
        loadOrdersForUser(adminUser);
      }
    },
    [enterConsentFlow, loadOrdersForUser],
  );

  const handleLoginSuccess = useCallback(
    async (payload) => {
      // Fetch the latest profile from database to ensure we have the correct role
      let profileWithRole = payload.user;
      try {
        const { getProfile } = await import('../services/supabaseService');
        const profile = await getProfile(payload.user.id);
        if (profile) {
          // Merge role from database profile
          profileWithRole = {
            ...payload.user,
            role: profile.role || payload.user.role || 'user',
          };
        }
      } catch (error) {
        console.warn('[AppContext] ⚠️  Failed to fetch profile for role (non-critical):', error?.message);
        // Continue with payload.user if profile fetch fails
      }
      
      const adminUser = applyAdminFlag(profileWithRole);
      setState((prev) => ({
        ...prev,
        currentUser: adminUser,
        pendingConsent: null,
        orders: [],
        ordersLoaded: false,
      }));
      
      // Sync profile to Supabase (preserve role if it exists)
      try {
        const result = await upsertProfile({
          id: adminUser.id,
          email: adminUser.email,
          full_name: adminUser.name,
          // Don't overwrite role - let database trigger handle it
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

  const handleLogout = useCallback(async () => {
    // IMPORTANT: Clear Supabase session before clearing local state
    // This prevents session conflicts when switching users
    try {
      const { signOut } = await import('../services/authService');
      await signOut();
      if (__DEV__) {
        console.log('[AppContext] ✅ Supabase session cleared on logout');
      }
    } catch (error) {
      console.error('[AppContext] ⚠️  Error signing out from Supabase:', error);
      // Continue with logout even if signOut fails
    }
    
    // Clear local state after Supabase session is cleared
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
      const response = await updateOrder(orderId, payload);
      const updated = response?.order || response; // Handle both { order: ... } and direct order
      
      if (__DEV__) {
        console.log('[AppContext] Order updated, admin fields:', {
          adminNotes: updated.adminNotes,
          adminImages: updated.adminImages?.length || 0,
          trackingNumber: updated.trackingNumber,
        });
      }
      
      setState((prev) => {
        // Fully replace the order (don't merge) to ensure all fields are updated
        const nextOrders = Array.isArray(prev.orders)
          ? prev.orders.map((order) => (order.id === updated.id ? updated : order))
          : prev.orders;

        const nextActiveOrder = prev.activeOrder?.id === updated.id
          ? updated
          : prev.activeOrder;

        const nextLastCompletedOrder = prev.lastCompletedOrder?.id === updated.id
          ? updated
          : prev.lastCompletedOrder;

        if (__DEV__) {
          const updatedOrderInState = nextOrders.find((o) => o.id === updated.id);
          console.log('[AppContext] Order state updated, checking stored order:', {
            orderId: updated.id,
            hasAdminNotes: !!updatedOrderInState?.adminNotes,
            adminNotes: updatedOrderInState?.adminNotes,
            hasAdminImages: Array.isArray(updatedOrderInState?.adminImages) && updatedOrderInState.adminImages.length > 0,
            adminImagesCount: updatedOrderInState?.adminImages?.length || 0,
            trackingNumber: updatedOrderInState?.trackingNumber,
          });
        }

        return {
          ...prev,
          orders: nextOrders,
          activeOrder: nextActiveOrder,
          lastCompletedOrder: nextLastCompletedOrder,
          statusMessage: 'Order updated successfully.',
        };
      });

      return updated;
    } catch (err) {
      const errorMessage = err?.message || err?.error?.message || 'Unable to update order.';
      setState((prev) => ({
        ...prev,
        statusMessage: errorMessage,
      }));
      if (__DEV__) {
        console.error('[AppContext] ❌ Failed to update order:', err);
      }
      throw err;
    } finally {
      setState((prev) => ({
        ...prev,
        ordersUpdating: false,
      }));
    }
  }, []);

  const handleExitImpersonation = useCallback(async () => {
    if (!state.impersonating || !state.originalAdminUser) {
      return;
    }

    try {
      // Log impersonation end
      const { logImpersonation } = await import('../services/userService');
      await logImpersonation(
        state.originalAdminUser.id,
        state.currentUser?.id,
        'end'
      );

      // Restore original admin user
      setState((prev) => ({
        ...prev,
        impersonating: false,
        currentUser: applyAdminFlag(prev.originalAdminUser),
        originalAdminUser: null,
      }));
    } catch (error) {
      console.error('[AppContext] Error exiting impersonation:', error);
      // Still restore user even if logging fails
      setState((prev) => ({
        ...prev,
        impersonating: false,
        currentUser: applyAdminFlag(prev.originalAdminUser),
        originalAdminUser: null,
      }));
    }
  }, [state.impersonating, state.originalAdminUser, state.currentUser?.id]);

  const contextValue = useMemo(
    () => ({
      state: {
        ...state,
        isRestoringSession, // Add restoration state to context
      },
      setState,
      clearStatusMessage,
      setAuthRedirect,
      clearAuthRedirect,
      ensureAuthenticated,
      enterConsentFlow,
      loadOrdersForUser,
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
      updateOrderAdmin,
      handleExitImpersonation,
    }),
    [
      state,
      isRestoringSession,
      setState,
      clearStatusMessage,
      setAuthRedirect,
      clearAuthRedirect,
      ensureAuthenticated,
      enterConsentFlow,
      loadOrdersForUser,
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
      updateOrderAdmin,
      handleExitImpersonation,
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

