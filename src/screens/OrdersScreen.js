import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
  Image,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadImageToStorage } from '../services/imageStorageService';
import Icon from '../icons/Icon';
import { deleteOrder } from '../services/api';
import { getNextWeekStart, getNextWeekStartDateTime, formatNextAvailabilityDateTime, checkCapacityAvailability } from '../services/workloadService';
import { getShapeById } from '../utils/pricing';

/**
 * Order Status Constants
 * 
 * Status values used throughout the application:
 * - Draft: Order is being created/edited by user
 * - Submitted: Order has been submitted by user (awaiting admin action)
 * - Approved & In Progress: Admin has approved and order is in production
 * - Ready for Pickup: Order is ready for customer pickup
 * - Ready for Shipping: Order is ready to be shipped
 * - Ready for Delivery: Order is ready for delivery
 * - Completed: Order has been fulfilled
 * - Cancelled: Order has been cancelled
 */
const ORDER_STATUS = {
  DRAFT: 'Draft',
  AWAITING_SUBMISSION: 'Awaiting Submission',
  SUBMITTED: 'Submitted',
  APPROVED_IN_PROGRESS: 'Approved & In Progress',
  READY_FOR_PICKUP: 'Ready for Pickup',
  READY_FOR_SHIPPING: 'Ready for Shipping',
  READY_FOR_DELIVERY: 'Ready for Delivery',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/**
 * Status to Filter Mapping
 * Maps each status to its corresponding filter category
 */
const STATUS_TO_FILTER = {
  [ORDER_STATUS.DRAFT]: 'cart',
  [ORDER_STATUS.AWAITING_SUBMISSION]: 'cart', // Awaiting Submission appears in Cart filter
  [ORDER_STATUS.SUBMITTED]: 'in_progress',
  [ORDER_STATUS.APPROVED_IN_PROGRESS]: 'in_progress',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'ready',
  [ORDER_STATUS.READY_FOR_SHIPPING]: 'ready',
  [ORDER_STATUS.READY_FOR_DELIVERY]: 'ready',
  [ORDER_STATUS.COMPLETED]: 'completed',
  [ORDER_STATUS.CANCELLED]: 'completed',
};

/**
 * Helper function to normalize status for comparison
 * Handles case-insensitive matching and common variations
 */
function normalizeStatusForMapping(status) {
  if (!status) return '';
  const normalized = String(status).trim();
  
  // Try exact match first
  if (STATUS_TO_FILTER[normalized]) {
    return normalized;
  }
  
  // Try case-insensitive match
  const statusLower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(STATUS_TO_FILTER)) {
    if (key.toLowerCase() === statusLower) {
      return key;
    }
  }
  
  // Handle common variations and old formats
  if (statusLower === 'draft') {
    return ORDER_STATUS.DRAFT;
  }
  if (statusLower === 'submitted') {
    return ORDER_STATUS.SUBMITTED;
  }
  if (statusLower === 'approved & in progress' || statusLower === 'approved_in_progress' || statusLower === 'in_progress' || statusLower === 'in progress') {
    return ORDER_STATUS.APPROVED_IN_PROGRESS;
  }
  if (statusLower === 'ready for pickup' || statusLower === 'ready_for_pickup') {
    return ORDER_STATUS.READY_FOR_PICKUP;
  }
  if (statusLower === 'ready for shipping' || statusLower === 'ready_for_shipping') {
    return ORDER_STATUS.READY_FOR_SHIPPING;
  }
  if (statusLower === 'ready for delivery' || statusLower === 'ready_for_delivery') {
    return ORDER_STATUS.READY_FOR_DELIVERY;
  }
  if (statusLower === 'completed' || statusLower === 'delivered') {
    return ORDER_STATUS.COMPLETED;
  }
  if (statusLower === 'cancelled' || statusLower === 'canceled') {
    return ORDER_STATUS.CANCELLED;
  }
  
  return normalized;
}

function OrdersScreen({ route }) {
  const initialTabFromRoute = route?.params?.initialTab;
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, setState, loadOrdersForUser, updateOrderAdmin } = useAppState();
  const currentUserId = state.currentUser?.id;
  const colors = theme?.colors || {};
  const {
    primaryBackground,
    secondaryBackground,
    surface,
    primaryFont,
    secondaryFont,
    accent,
    accentContrast,
    border,
    warning,
    success,
    error,
    shadow,
  } = colors;
  const warningColor = warning || '#FF9800';
  const errorColor = error || '#B33A3A';
  const successColor = success || '#4CAF50';
  const accentColor = accent || '#6F171F';
  const secondaryBackgroundColor = secondaryBackground || '#BF9B7A';
  const primaryBackgroundColor = primaryBackground || '#F4EBE3';
  const surfaceColor = surface || '#FFFFFF';
  const primaryFontColor = primaryFont || '#220707';
  const onSurfaceColor = colors.onSurface || primaryFontColor; // Use onSurface for text on surface backgrounds
  const secondaryFontColor = secondaryFont || '#5C5F5D';
  const borderColor = border || '#D9C8A9';
  const shadowColor = shadow || '#000000';
  const accentContrastColor = accentContrast || '#FFFFFF';

  const isAdmin = Boolean(state.currentUser?.isAdmin);
  const [hasRequestedOrders, setHasRequestedOrders] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [capacityInfo, setCapacityInfo] = useState(null);

  useEffect(() => {
    if (__DEV__) {
      console.log('[OrdersScreen] Orders check:', {
        hasRequestedOrders,
        ordersLoaded: state.ordersLoaded,
        ordersLoading: state.ordersLoading,
        ordersCount: state.orders?.length || 0,
        currentUser: state.currentUser?.email,
        isAdmin,
      });
    }

    if (!hasRequestedOrders || (!state.ordersLoaded && !state.ordersLoading)) {
      if (!state.currentUser) {
        if (__DEV__) {
          console.log('[OrdersScreen] ⚠️  No current user, cannot load orders');
        }
        return;
      }
      if (__DEV__) {
        console.log('[OrdersScreen] 📥 Requesting orders for user:', state.currentUser.email, isAdmin ? '(admin)' : '(regular)');
      }
      setHasRequestedOrders(true);
      loadOrdersForUser(state.currentUser);
    }
  }, [isAdmin, loadOrdersForUser, state.ordersLoaded, state.ordersLoading, hasRequestedOrders, currentUserId, state.currentUser, state.orders]);

  // Handle toast message from route params
  useEffect(() => {
    if (route?.params?.toastMessage) {
      setToastMessage(route.params.toastMessage);
      // Clear route param after showing toast
      if (navigation.setParams) {
        navigation.setParams({ toastMessage: null });
      }
    }
  }, [route?.params?.toastMessage, navigation]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Convert statusMessage from AppContext to toast (for order update messages)
  useEffect(() => {
    if (state.statusMessage && (
      state.statusMessage.includes('Order updated') ||
      state.statusMessage.includes('order updated') ||
      state.statusMessage.includes('Unable to update') ||
      state.statusMessage.includes('Unable to add images')
    )) {
      // Convert to toast and clear statusMessage
      setToastMessage(state.statusMessage);
      setState((prev) => ({
        ...prev,
        statusMessage: null,
      }));
    }
  }, [state.statusMessage, setState]);

  // Load capacity info for "Awaiting Submission" order messaging
  useEffect(() => {
    // Only load if we have "Awaiting Submission" orders
    const hasAwaitingSubmission = baseOrders.some((order) => {
      const statusLower = (order.status || '').toLowerCase();
      return statusLower === 'awaiting submission' || statusLower === 'awaiting_submission';
    });

    if (hasAwaitingSubmission) {
      const loadCapacity = async () => {
        try {
          const info = await checkCapacityAvailability();
          console.log('[OrdersScreen] Loaded capacity info:', info); // Debug log
          setCapacityInfo(info);
        } catch (error) {
          console.error('[OrdersScreen] Error loading capacity info:', error);
          // On error, default to "full" state to show wait message
          setCapacityInfo({ isFull: true, remaining: 0 });
        }
      };
      loadCapacity();
      
      // Refresh capacity info every 30 seconds to get latest status
      const refreshInterval = setInterval(() => {
        loadCapacity();
      }, 30000);
      
      return () => clearInterval(refreshInterval);
    } else {
      // Clear capacity info if no awaiting submission orders
      setCapacityInfo(null);
    }
  }, [baseOrders]); // Refresh when orders change

  const baseOrders = useMemo(() => {
    const map = new Map();

    // For all users (admin and regular), include orders from state.orders
    (state.orders || []).forEach((order) => {
      if (order && order.id && !map.has(order.id)) {
        map.set(order.id, order);
      }
    });

    // Also include locally cached orders (activeOrder, lastCompletedOrder) for all users
    const localOrders = [state.activeOrder, state.lastCompletedOrder];
    localOrders.forEach((order) => {
      if (order && order.id && !map.has(order.id)) {
        map.set(order.id, order);
      }
    });

    const items = Array.from(map.values());
    return items.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [state.activeOrder, state.lastCompletedOrder, state.orders]);

  /**
   * Categorize orders into filter groups based on status
   * 
   * Filter structure:
   * - Cart: Contains "Draft" status
   * - In Progress: Contains "Submitted", "Approved & In Progress" statuses
   * - Ready: Contains "Ready for Pickup", "Ready for Shipping", "Ready for Delivery" statuses
   * - Completed: Contains "Completed" and "Cancelled" statuses
   * - All: Contains all statuses
   */
  const categorizedOrders = useMemo(() => {
    const cart = [];
    const inProgress = [];
    const ready = [];
    const completed = [];

    baseOrders.forEach((order) => {
      const status = order.status || '';
      
      // Normalize status to match our mapping
      const normalizedStatus = normalizeStatusForMapping(status);
      
      // Map status to filter category
      const filterCategory = STATUS_TO_FILTER[normalizedStatus] || 'in_progress';
      
      switch (filterCategory) {
        case 'cart':
          cart.push(order);
          break;
        case 'in_progress':
          inProgress.push(order);
          break;
        case 'ready':
          ready.push(order);
          break;
        case 'completed':
          completed.push(order);
          break;
        default:
          // Default to in_progress for unknown statuses
          inProgress.push(order);
          break;
      }
    });

    return {
      cart,
      in_progress: inProgress,
      ready,
      completed,
      all: baseOrders,
    };
  }, [baseOrders]);

  const [activeTab, setActiveTab] = useState(
    ['cart', 'in_progress', 'ready', 'completed', 'all'].includes(initialTabFromRoute)
      ? initialTabFromRoute
      : 'cart',
  );

  const tabs = useMemo(
    () => [
      { key: 'cart', label: 'Cart', count: categorizedOrders.cart.length },
      { key: 'in_progress', label: 'In Progress', count: categorizedOrders.in_progress.length },
      { key: 'ready', label: 'Ready', count: categorizedOrders.ready.length },
      { key: 'completed', label: 'Completed', count: categorizedOrders.completed.length },
      { key: 'all', label: 'All', count: categorizedOrders.all.length },
    ],
    [categorizedOrders],
  );

  /**
   * Status filters for admin dropdown
   * Only admin can update statuses beyond "Draft" and "Submitted"
   * Users can only set "Draft" (when saving) and "Submitted" (when submitting)
   */
  const STATUS_FILTERS = useMemo(
    () => [
      { key: 'all', label: 'All statuses' },
      { key: ORDER_STATUS.DRAFT.toLowerCase(), label: ORDER_STATUS.DRAFT },
      { key: ORDER_STATUS.AWAITING_SUBMISSION.toLowerCase().replace(/\s+/g, '_'), label: ORDER_STATUS.AWAITING_SUBMISSION },
      { key: ORDER_STATUS.SUBMITTED.toLowerCase(), label: ORDER_STATUS.SUBMITTED },
      { key: ORDER_STATUS.APPROVED_IN_PROGRESS.toLowerCase().replace(/\s+/g, '_'), label: ORDER_STATUS.APPROVED_IN_PROGRESS },
      { key: ORDER_STATUS.READY_FOR_PICKUP.toLowerCase().replace(/\s+/g, '_'), label: ORDER_STATUS.READY_FOR_PICKUP },
      { key: ORDER_STATUS.READY_FOR_SHIPPING.toLowerCase().replace(/\s+/g, '_'), label: ORDER_STATUS.READY_FOR_SHIPPING },
      { key: ORDER_STATUS.READY_FOR_DELIVERY.toLowerCase().replace(/\s+/g, '_'), label: ORDER_STATUS.READY_FOR_DELIVERY },
      { key: ORDER_STATUS.COMPLETED.toLowerCase(), label: ORDER_STATUS.COMPLETED },
      { key: ORDER_STATUS.CANCELLED.toLowerCase(), label: ORDER_STATUS.CANCELLED },
    ],
    [],
  );

  // Multiple selection filters - arrays to support multiple selections
  const [selectedUserFilter, setSelectedUserFilter] = useState(['all']);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(['all']);
  // Show admin controls enabled by default for admins
  const [showAdminControls, setShowAdminControls] = useState(isAdmin);
  const [expandedAdminOrders, setExpandedAdminOrders] = useState({});
  const [adminDrafts, setAdminDrafts] = useState({});
  const [previewAdminImage, setPreviewAdminImage] = useState(null);
  
  // Dropdown modal states
  const [statusDropdownVisible, setStatusDropdownVisible] = useState(false);
  const [userDropdownVisible, setUserDropdownVisible] = useState(false);

  const userOptions = useMemo(() => {
    if (!isAdmin) {
      return [];
    }

    const map = new Map();
    baseOrders.forEach((order) => {
      const email = (order.user?.email || order.userEmail || '').toLowerCase();
      if (!email || map.has(email)) {
        return;
      }
      const name = order.user?.name || order.userName || order.customerName || email;
      map.set(email, { email, name });
    });

    return [{ email: 'all', name: 'All users' }, ...Array.from(map.values())];
  }, [baseOrders, isAdmin]);

  const filteredOrders = useMemo(() => {
    // Get orders for the active tab (cart, in_progress, ready, completed, or all)
    let results = categorizedOrders[activeTab] || categorizedOrders.cart;

    if (isAdmin) {
      // Apply status filter(s) - support multiple selections
      const hasStatusFilter = selectedStatusFilter.length > 0 && !selectedStatusFilter.includes('all');
      if (hasStatusFilter) {
        results = results.filter((order) => {
          const orderStatus = (order.status || '').toLowerCase();
          
          // Check if order status matches any of the selected filters
          return selectedStatusFilter.some((filterKey) => {
            const normalizedOrderStatus = orderStatus.replace(/\s+/g, '_').replace(/&/g, '');
            const normalizedFilterKey = filterKey.toLowerCase().replace(/\s+/g, '_').replace(/&/g, '');
            return normalizedOrderStatus === normalizedFilterKey;
          });
        });
      }

      // Apply user filter(s) - support multiple selections
      const hasUserFilter = selectedUserFilter.length > 0 && !selectedUserFilter.includes('all');
      if (hasUserFilter) {
        results = results.filter((order) => {
          const email = (order.user?.email || order.userEmail || '').toLowerCase();
          return selectedUserFilter.some((filterEmail) => filterEmail.toLowerCase() === email);
        });
      }
    }

    return results;
  }, [activeTab, categorizedOrders, isAdmin, selectedStatusFilter, selectedUserFilter]);

  const navigateToRoot = useCallback(
    (routeName, params) => {
      let parentNav = navigation;
      while (parentNav?.getParent?.()) {
        parentNav = parentNav.getParent();
      }
      parentNav?.navigate(routeName, params);
    },
    [navigation],
  );

  const handleViewDetails = useCallback(
    async (order) => {
      if (!order) {
        return;
      }

      logEvent('tap_order_view', { orderId: order.id, status: order.status });
      // Navigate to order builder for draft orders and "Awaiting Submission" orders, order details for others
      // Check status case-insensitively
      const orderStatusLower = (order.status || '').toLowerCase();
      if (orderStatusLower === 'draft' || orderStatusLower === 'awaiting submission') {
        // For draft and awaiting submission orders, fetch the full order details (including images) before editing
        // The list query excludes design_uploads and sizing_uploads for performance
        try {
          setState((prev) => ({ ...prev, ordersLoading: true }));
          const { fetchOrder } = await import('../services/orderService');
          const { order: fullOrder } = await fetchOrder(order.id);
          setState((prev) => ({
            ...prev,
            activeOrder: fullOrder,
            ordersLoading: false,
          }));
          // Navigate to NewOrderFlow and go directly to Review & Submit step for "Awaiting Submission" orders
          if (orderStatusLower === 'awaiting submission') {
            navigateToRoot('NewOrderFlow', { resume: true, initialStep: 'review' });
          } else {
            navigateToRoot('NewOrderFlow', { resume: true });
          }
        } catch (error) {
          console.error('[OrdersScreen] Failed to fetch full order details:', error);
          setState((prev) => ({ ...prev, ordersLoading: false }));
          // Fallback: use the order from list (without images)
          setState((prev) => ({
            ...prev,
            activeOrder: order,
          }));
          // Navigate to NewOrderFlow and go directly to Review & Submit step for "Awaiting Submission" orders
          if (orderStatusLower === 'awaiting submission') {
            navigateToRoot('NewOrderFlow', { resume: true, initialStep: 'review' });
          } else {
            navigateToRoot('NewOrderFlow', { resume: true });
          }
        }
        return;
      }

      navigateToRoot('OrderDetails', { order, fromOrders: true });
    },
    [navigateToRoot, setState],
  );

  const getOrderNumber = useCallback((order) => {
    if (!order?.id) {
      return '—';
    }
    // Display first 8 characters of order ID in uppercase
    return order.id.slice(0, 8).toUpperCase();
  }, []);

  const getOrderSummary = useCallback((order) => {
    const nailSets = order.nailSets || [];
    if (nailSets.length === 0) {
      return '0 sets';
    }

    // Count total sets
    const totalSets = nailSets.length;

    // Count sets by shape
    const shapeCounts = {};
    nailSets.forEach((set) => {
      if (set?.shapeId) {
        const shape = getShapeById(set.shapeId);
        if (shape) {
          const shapeName = shape.name; // "Almond" or "Square"
          shapeCounts[shapeName] = (shapeCounts[shapeName] || 0) + 1;
        }
      }
    });

    // Build summary string
    const parts = [`${totalSets} set${totalSets !== 1 ? 's' : ''}`];
    
    // Add shape counts if they exist
    if (shapeCounts['Almond']) {
      parts.push(`Almond: ${shapeCounts['Almond']}`);
    }
    if (shapeCounts['Square']) {
      parts.push(`Square: ${shapeCounts['Square']}`);
    }

    return parts.join(' • ');
  }, []);

  const getOrderUserLabel = useCallback((order) => {
    if (!isAdmin) {
      return null;
    }
    
    if (__DEV__) {
      console.log('[OrdersScreen] getOrderUserLabel for order:', order.id, {
        hasUser: !!order.user,
        userName: order.user?.name,
        userEmail: order.user?.email,
        userNameAlt: order.userName,
        userEmailAlt: order.userEmail,
        customerName: order.customerName,
        userId: order.userId,
      });
    }
    
    const name = order.user?.name || order.userName || order.customerName;
    const email = order.user?.email || order.userEmail;
    if (name && email) {
      return `${name} • ${email}`;
    }
    return name || email || 'Unknown customer';
  }, [isAdmin]);

  const handleDeleteOrder = useCallback(
    async (order) => {
      // Only show delete button for draft orders (case-insensitive check)
      const orderStatusLower = (order.status || '').toLowerCase();
      if (orderStatusLower !== 'draft') {
        Alert.alert('Cannot delete', 'Only draft orders can be deleted.');
        return;
      }

      Alert.alert(
        'Delete draft order',
        'Are you sure you want to delete this draft? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                setState((prev) => ({
                  ...prev,
                  ordersUpdating: true,
                }));

                await deleteOrder(order.id);
                
                logEvent('delete_order', { orderId: order.id, status: order.status });

                // Remove order from state
                setState((prev) => {
                  const updatedOrders = (prev.orders || []).filter((o) => o.id !== order.id);
                  
                  // Also clear from activeOrder if it's the deleted one
                  const updatedActiveOrder = prev.activeOrder?.id === order.id ? null : prev.activeOrder;
                  
                  // Also clear from lastCompletedOrder if it's the deleted one
                  const updatedLastCompletedOrder = prev.lastCompletedOrder?.id === order.id ? null : prev.lastCompletedOrder;

                  return {
                    ...prev,
                    orders: updatedOrders,
                    activeOrder: updatedActiveOrder,
                    lastCompletedOrder: updatedLastCompletedOrder,
                    ordersUpdating: false,
                  };
                });

                // Show toast notification instead of statusMessage
                setToastMessage('Draft order deleted successfully.');
              } catch (err) {
                const errorMessage = err?.message || err?.error?.message || 'Unable to delete order. Please try again.';
                console.error('[orders] ❌ Failed to delete order:', err);
                setState((prev) => ({
                  ...prev,
                  ordersUpdating: false,
                }));
                // Show error toast instead of statusMessage
                setToastMessage(errorMessage);
              }
            },
          },
        ],
      );
    },
    [setState],
  );

  const getAdminDraft = useCallback(
    (order) => {
      const existing = adminDrafts[order.id];
      if (existing) {
        if (__DEV__) {
          console.log('[OrdersScreen] Using cached draft for order:', order.id);
        }
        return existing;
      }

      if (__DEV__) {
        console.log('[OrdersScreen] Creating new draft from order:', order.id, {
          adminNotes: order.adminNotes,
          adminImages: order.adminImages?.length || 0,
          trackingNumber: order.trackingNumber,
        });
      }

      const storedImages = Array.isArray(order.adminImages)
        ? order.adminImages
            .filter(Boolean)
            .map((uri, index) => ({ id: `${order.id}_admin_${index}`, uri }))
        : [];

      const defaultDraft = {
        notes: order.adminNotes || '',
        images: storedImages,
        discount: order.discount !== undefined && order.discount !== null ? String(order.discount) : '',
        trackingNumber: order.trackingNumber || '',
        status: order.status || 'pending',
      };

      return defaultDraft;
    },
    [adminDrafts],
  );

  const handleAdminDraftChange = useCallback((orderId, field, value) => {
    setAdminDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [field]: value,
      },
    }));
  }, []);

  const handleAdminImageUpload = useCallback(
    async (order) => {
      try {
        const response = await launchImageLibrary({
          mediaType: 'photo',
          selectionLimit: 0,
          includeBase64: false, // Use URI for upload
        });

        if (response.didCancel || !Array.isArray(response.assets)) {
          return;
        }

        const assets = response.assets.filter((asset) => asset?.uri);
        if (!assets.length) {
          return;
        }

        const baseDraft = getAdminDraft(order);

        // Upload each image to Supabase Storage immediately
        const uploadPromises = assets.map(async (asset, index) => {
          // Create temporary entry with preview - use timestamp + random + index for uniqueness
          const tempId = `${order.id}_admin_${Date.now()}_${Math.random().toString(36).substring(7)}_${index}`;
          const tempEntry = {
            id: tempId,
            uri: asset.uri,
            uploading: true,
            error: null,
          };

          // Add to draft immediately for preview - use functional update to get current state
          setAdminDrafts((prev) => {
            const currentDraft = prev[order.id] || baseDraft;
            const currentImages = Array.isArray(currentDraft.images) ? currentDraft.images : [];
            return {
              ...prev,
              [order.id]: {
                ...currentDraft,
                images: [...currentImages, tempEntry],
              },
            };
          });

          try {
            // Get userId from order or current user for storage path
            const userId = order.user_id || order.userId || state.currentUser?.id || state.currentUser?.userId;
            if (!userId) {
              throw new Error('User ID not found for order');
            }

            // Upload to Storage - use {userId}/{orderId}/... path structure
            const uploadResult = await uploadImageToStorage(
              {
                uri: asset.uri,
                type: asset.type || 'image/jpeg',
                fileName: asset.fileName || `admin-image-${index + 1}.jpg`,
              },
              userId,
              order.id,
              null, // No setId for admin images
              'admin', // Image type
            );

            // Update with Storage URL - use functional update to get current state
            setAdminDrafts((prev) => {
              const currentDraft = prev[order.id] || baseDraft;
              const currentImages = Array.isArray(currentDraft.images) ? currentDraft.images : [];
              return {
                ...prev,
                [order.id]: {
                  ...currentDraft,
                  images: currentImages.map((img) =>
                    img.id === tempId
                      ? {
                          ...img,
                          id: tempId,
                          url: uploadResult.url,
                          uri: uploadResult.url, // Use Storage URL for display
                          uploading: false,
                          fileName: uploadResult.fileName,
                        }
                      : img,
                  ),
                },
              };
            });

            return {
              id: tempId,
              url: uploadResult.url,
              uri: uploadResult.url,
              fileName: uploadResult.fileName,
            };
          } catch (err) {
            console.error('[OrdersScreen] Error uploading admin image:', err);
            
            const errorMessage = err?.message || err?.error?.message || 'Upload failed';
            
            // Mark upload as failed - use functional update to get current state
            setAdminDrafts((prev) => {
              const currentDraft = prev[order.id] || baseDraft;
              const currentImages = Array.isArray(currentDraft.images) ? currentDraft.images : [];
              return {
                ...prev,
                [order.id]: {
                  ...currentDraft,
                  images: currentImages.map((img) =>
                    img.id === tempId
                      ? {
                          ...img,
                          uploading: false,
                          error: errorMessage,
                        }
                      : img,
                  ),
                },
              };
            });

            Alert.alert('Upload Error', `Failed to upload image: ${errorMessage}`);
            return null;
          }
        });

        await Promise.all(uploadPromises);
      } catch (error) {
        console.error('[OrdersScreen] Error in handleAdminImageUpload:', error);
        const errorMessage = error?.message || 'Unable to add images. Please try again.';
        setState((prev) => ({
          ...prev,
          statusMessage: null, // Clear statusMessage to prevent banner popup
        }));
        // Show error toast instead of statusMessage banner
        setToastMessage(errorMessage);
      }
    },
    [getAdminDraft, adminDrafts, setState],
  );

  const handleAdminImageRemove = useCallback((orderId, imageId) => {
    setAdminDrafts((prev) => {
      const draft = prev[orderId];
      if (!draft || !Array.isArray(draft.images)) {
        return prev;
      }
      return {
        ...prev,
        [orderId]: {
          ...draft,
          images: draft.images.filter((image) => image?.id !== imageId),
        },
      };
    });
  }, []);

  const handleAdminStatusSelect = useCallback(
    async (order, nextStatus) => {
      if (!nextStatus) {
        return;
      }

      const previousStatus = getAdminDraft(order).status;
      if ((previousStatus || '').toLowerCase() === nextStatus.toLowerCase()) {
        return;
      }
      
      // Optimistically update the draft
      handleAdminDraftChange(order.id, 'status', nextStatus);

      try {
        const updated = await updateOrderAdmin(order.id, { status: nextStatus });
        
        // Update draft with the confirmed status from server
        if (updated?.status) {
          handleAdminDraftChange(order.id, 'status', updated.status);
        }

        // Clear statusMessage and show toast instead
        setState((prev) => ({
          ...prev,
          statusMessage: null, // Clear statusMessage to prevent banner popup
        }));
        setToastMessage('Order updated successfully.');
      } catch (error) {
        const errorMessage = error?.message || 'Unable to update status.';
        setState((prev) => ({
          ...prev,
          statusMessage: null, // Clear statusMessage to prevent banner popup
        }));
        // Show error toast instead of statusMessage banner
        setToastMessage(errorMessage);
        // Revert to previous status on error
        handleAdminDraftChange(order.id, 'status', previousStatus);
      }
    },
    [getAdminDraft, handleAdminDraftChange, updateOrderAdmin, setState],
  );

  const toggleAdminSection = useCallback((orderId) => {
    setExpandedAdminOrders((prev) => {
      const isCurrentlyExpanded = prev[orderId];
      const willBeExpanded = !isCurrentlyExpanded;
      
      // If closing the admin section, clear the draft so it re-reads from updated order on next open
      // This ensures that when reopening, we see the latest saved data from the order in state
      if (isCurrentlyExpanded && !willBeExpanded) {
        setAdminDrafts((draftPrev) => {
          const { [orderId]: removed, ...rest } = draftPrev;
          if (__DEV__) {
            console.log('[OrdersScreen] Clearing draft for order:', orderId, 'so it re-reads from updated order');
          }
          return rest;
        });
      }
      
      return {
        ...prev,
        [orderId]: willBeExpanded,
      };
    });
  }, []);

  const handleAdminSave = useCallback(
    async (order) => {
      const draft = getAdminDraft(order);
      try {
        setState((prev) => ({
          ...prev,
          ordersUpdating: true,
        }));

        const payload = {
          status: draft.status,
          adminNotes: draft.notes,
          // Save Storage URLs (preferred) or URIs (for backward compatibility)
          adminImages: Array.isArray(draft.images)
            ? draft.images
                .filter((image) => !image.uploading && !image.error) // Only save successfully uploaded images
                .map((image) => image?.url || image?.uri) // Use Storage URL if available, fallback to URI
                .filter(Boolean)
            : [],
          trackingNumber: draft.trackingNumber || undefined,
        };

        if (draft.discount?.length) {
          payload.discount = Number(draft.discount);
        }

        const updated = await updateOrderAdmin(order.id, payload);
        
        if (__DEV__) {
          console.log('[OrdersScreen] Order updated, checking admin fields:', {
            adminNotes: updated?.adminNotes,
            adminImages: updated?.adminImages?.length || 0,
            trackingNumber: updated?.trackingNumber,
            status: updated?.status,
            hasAdminNotes: !!updated?.adminNotes,
            hasAdminImages: Array.isArray(updated?.adminImages) && updated.adminImages.length > 0,
          });
        }
        
        // Update the draft with the saved data from the server
        // This ensures the draft matches what's saved, so if admin section stays open, it shows saved data
        setAdminDrafts((prev) => ({
          ...prev,
          [order.id]: {
            notes: updated?.adminNotes || '',
            images:
              Array.isArray(updated?.adminImages)
                ? updated.adminImages
                    .filter(Boolean)
                    .map((urlOrUri, index) => ({
                      id: `${order.id}_admin_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`,
                      url: urlOrUri, // Store as URL (could be Storage URL or legacy URI)
                      uri: urlOrUri, // Also set uri for display compatibility
                    }))
                : [],
            discount:
              updated?.discount !== undefined && updated?.discount !== null
                ? String(updated.discount)
                : '',
            trackingNumber: updated?.trackingNumber || '',
            status: updated?.status || draft.status,
          },
        }));

        // The order in state.orders should already be updated by updateOrderAdmin
        // Force a re-render by toggling the updating flag
        // This ensures the UI reflects the updated order data
        setState((prev) => {
          // Verify the order was updated in state
          const updatedOrderInList = prev.orders?.find((o) => o.id === order.id);
          if (__DEV__ && updatedOrderInList) {
            console.log('[OrdersScreen] Verifying order in state after save:', {
              orderId: order.id,
              status: updatedOrderInList.status,
              hasAdminNotes: !!updatedOrderInList.adminNotes,
              adminNotes: updatedOrderInList.adminNotes,
              trackingNumber: updatedOrderInList.trackingNumber,
            });
          }
          return {
            ...prev,
            ordersUpdating: false,
            statusMessage: null, // Clear statusMessage to prevent banner popup
          };
        });

        // Show toast notification instead of statusMessage banner
        setToastMessage('Order updated successfully.');
      } catch (error) {
        const errorMessage = error?.message || error?.error?.message || 'Unable to update order. Please try again.';
        console.error('[OrdersScreen] Failed to save admin changes:', error);
        setState((prev) => ({
          ...prev,
          ordersUpdating: false,
          statusMessage: null, // Clear statusMessage to prevent banner popup
        }));
        // Show error toast instead of statusMessage banner
        setToastMessage(errorMessage);
      }
    },
    [getAdminDraft, updateOrderAdmin, setState],
  );

  const renderOrderCard = (order) => {
    const primarySet = order.nailSets?.[0];
    const needsFollowUp = order.nailSets?.some((set) => set.requiresFollowUp);
    
    // Get the current status - use draft status if admin section is expanded, otherwise use order status
    const adminDraft = getAdminDraft(order);
    const isAdminSectionExpanded = expandedAdminOrders[order.id];
    const currentStatus = isAdminSectionExpanded && adminDraft.status 
      ? adminDraft.status 
      : (order.status || '');
    const status = currentStatus || '';
    const statusLower = status.toLowerCase();
    
    const adminImages = Array.isArray(adminDraft.images) ? adminDraft.images : [];
    
    // Map status to display label and styling
    // Default to "Submitted" for unknown statuses
    let statusLabel = ORDER_STATUS.SUBMITTED;
    let statusBackground = withOpacity(accentColor, 0.12);
    let statusTextColor = accentColor;

    // Normalize status for comparison (case-insensitive, handle both old and new formats)
    const normalizedStatus = statusLower.replace(/\s+/g, '_').replace(/&/g, '');
    
    // All status checks are now case-insensitive using normalizedStatus
    if (normalizedStatus === 'draft') {
      statusLabel = ORDER_STATUS.DRAFT;
      statusBackground = withOpacity(secondaryBackgroundColor, 0.2);
    } else if (normalizedStatus === 'awaiting_submission' || normalizedStatus === 'awaitingsubmission') {
      statusLabel = ORDER_STATUS.AWAITING_SUBMISSION;
      statusBackground = withOpacity(warningColor, 0.12);
      statusTextColor = warningColor;
    } else if (normalizedStatus === 'submitted') {
      statusLabel = ORDER_STATUS.SUBMITTED;
      statusBackground = withOpacity(accentColor, 0.12);
    } else if (normalizedStatus === 'approved_in_progress' || normalizedStatus === 'approvedinprogress') {
      statusLabel = ORDER_STATUS.APPROVED_IN_PROGRESS;
      statusBackground = withOpacity(accentColor, 0.12);
    } else if (normalizedStatus === 'ready_for_pickup' || normalizedStatus === 'readyforpickup') {
      statusLabel = ORDER_STATUS.READY_FOR_PICKUP;
      statusBackground = withOpacity(accentColor, 0.15);
    } else if (normalizedStatus === 'ready_for_shipping' || normalizedStatus === 'readyforshipping') {
      statusLabel = ORDER_STATUS.READY_FOR_SHIPPING;
      statusBackground = withOpacity(accentColor, 0.15);
    } else if (normalizedStatus === 'ready_for_delivery' || normalizedStatus === 'readyfordelivery') {
      statusLabel = ORDER_STATUS.READY_FOR_DELIVERY;
      statusBackground = withOpacity(accentColor, 0.15);
    } else if (normalizedStatus === 'completed' || normalizedStatus === 'delivered') {
      statusLabel = ORDER_STATUS.COMPLETED;
      statusBackground = withOpacity(accentColor, 0.18);
    } else if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
      statusLabel = ORDER_STATUS.CANCELLED;
      statusBackground = withOpacity('#B33A3A', 0.12);
      statusTextColor = '#B33A3A';
    }

    return (
      <View
        key={order.id}
        style={[
          styles.card,
          {
            borderColor,
            backgroundColor: surfaceColor,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text
              style={[
                styles.cardTitle,
                { color: primaryFontColor },
              ]}
            >
              Order #{getOrderNumber(order)}
            </Text>
            <Text
              style={[
                styles.cardOrderNumber,
                { color: secondaryFontColor },
              ]}
            >
              {getOrderSummary(order)}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            {/* Show delete button only for draft orders (case-insensitive check) */}
            {(statusLower === 'draft') ? (
              <TouchableOpacity
                onPress={() => handleDeleteOrder(order)}
                style={[
                  styles.deleteButton,
                  {
                    backgroundColor: withOpacity(errorColor, 0.1),
                    borderColor: withOpacity(errorColor, 0.3),
                  },
                ]}
                accessibilityLabel="Delete draft order"
                accessibilityRole="button"
              >
                <Icon name="trash" color={errorColor} size={18} />
              </TouchableOpacity>
            ) : null}
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: statusBackground,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: statusTextColor },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>
        {/* Show capacity messaging for Awaiting Submission orders */}
        {normalizedStatus === 'awaiting_submission' || normalizedStatus === 'awaitingsubmission' ? (
          <View
            style={[
              styles.capacityInfoBanner,
              {
                // Default to warning (orange) if capacityInfo is null or if capacity is full/almost full
                // Only use success (green) if capacity is available and not full
                backgroundColor: !capacityInfo || capacityInfo?.isFull || capacityInfo?.isAlmostFull
                  ? withOpacity(warningColor, 0.08)
                  : withOpacity(successColor, 0.08),
                borderColor: !capacityInfo || capacityInfo?.isFull || capacityInfo?.isAlmostFull
                  ? withOpacity(warningColor, 0.3)
                  : withOpacity(successColor, 0.3),
              },
            ]}
          >
            <Text
              style={[
                styles.capacityInfoText,
                {
                  // Default to warning (orange) if capacityInfo is null or if capacity is full/almost full
                  // Only use success (green) if capacity is available and not full
                  color: !capacityInfo || capacityInfo?.isFull || capacityInfo?.isAlmostFull
                    ? warningColor
                    : successColor,
                },
              ]}
            >
              {(() => {
                // If capacity info not loaded yet, show default wait message
                if (!capacityInfo) {
                  const nextWeekStart = getNextWeekStartDateTime();
                  const formattedDateTime = formatNextAvailabilityDateTime(nextWeekStart);
                  return `Week full! You can submit it again when the next availability opens on ${formattedDateTime}.`;
                }

                // Debug: Log capacity info to help diagnose
                console.log('[OrdersScreen] Capacity info for message:', {
                  isFull: capacityInfo.isFull,
                  isAlmostFull: capacityInfo.isAlmostFull,
                  remaining: capacityInfo.remaining,
                  available: capacityInfo.available,
                });

                // If capacity is full, show wait message
                if (capacityInfo.isFull === true || capacityInfo.remaining <= 0) {
                  const nextWeekStart = getNextWeekStartDateTime();
                  const formattedDateTime = formatNextAvailabilityDateTime(nextWeekStart);
                  return `Week full! You can submit it again when the next availability opens on ${formattedDateTime}.`;
                }

                // If capacity is almost full (few spots remaining)
                if (capacityInfo.isAlmostFull === true && capacityInfo.remaining > 0 && capacityInfo.remaining <= 3) {
                  return `Only ${capacityInfo.remaining} spot${capacityInfo.remaining !== 1 ? 's' : ''} remaining! Resubmit now.`;
                }

                // If capacity is available (remaining > 0 and not almost full)
                if (capacityInfo.available === true && capacityInfo.remaining > 0) {
                  return 'You can resubmit now!';
                }

                // Fallback: show available message if remaining > 0
                if (capacityInfo.remaining > 0) {
                  return 'You can resubmit now!';
                }

                // Default fallback
                const nextWeekStart = getNextWeekStartDateTime();
                const formattedDateTime = formatNextAvailabilityDateTime(nextWeekStart);
                return `Week full! You can submit it again when the next availability opens on ${formattedDateTime}.`;
              })()}
            </Text>
          </View>
        ) : null}
        <Text
          style={[
            styles.cardMeta,
            { color: secondaryFontColor },
          ]}
        >
          {order.updatedAt
            ? `Updated ${new Date(order.updatedAt).toLocaleString()}`
            : 'Recently updated'}
        </Text>
        {isAdmin ? (
          <Text
            style={[
              styles.cardMetaSecondary,
              { color: secondaryFontColor },
            ]}
          >
            {getOrderUserLabel(order)}
          </Text>
        ) : null}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[
              styles.linkButton,
              { borderColor: accentColor },
            ]}
            onPress={() => handleViewDetails(order)}
          >
            <Text
              style={[
                styles.linkButtonText,
                { color: accentColor },
              ]}
            >
              View details
            </Text>
          </TouchableOpacity>
          {needsFollowUp ? (
            <Text
              style={[
                styles.linkInlineText,
                { color: secondaryFontColor },
              ]}
            >
              Needs design follow-up
            </Text>
          ) : null}
        </View>
        {isAdmin && showAdminControls ? (
          <View style={styles.adminSection}>
            <TouchableOpacity
              onPress={() => toggleAdminSection(order.id)}
              style={[
                styles.adminSectionToggle,
                {
                  borderColor: withOpacity(borderColor, 0.6),
                  backgroundColor: withOpacity(surfaceColor, 0.8),
                },
              ]}
            >
              <Text style={[styles.adminSectionToggleText, { color: accentColor }]}>
                {expandedAdminOrders[order.id] ? 'Hide admin controls' : 'Show admin controls'}
              </Text>
            </TouchableOpacity>
            {expandedAdminOrders[order.id] ? (
              <View style={styles.adminForm}>
                <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Notes</Text>
                <TextInput
                  value={adminDraft.notes}
                  onChangeText={(value) => handleAdminDraftChange(order.id, 'notes', value)}
                  placeholder="Add internal comments"
                  placeholderTextColor={withOpacity(secondaryFontColor, 0.5)}
                  style={[
                    styles.adminInput,
                    {
                      borderColor: withOpacity(borderColor, 0.6),
                      color: primaryFontColor,
                    },
                  ]}
                  multiline
                />

                <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Upload images</Text>
                <View style={styles.adminUploadsRow}>
                  {adminImages.length ? (
                    adminImages.map((image) => {
                      const imageUri = image.url || image.uri;
                      return (
                        <View
                          key={image.id}
                          style={[
                            styles.adminImageWrapper,
                            {
                              borderColor: withOpacity(borderColor, 0.6),
                              backgroundColor: withOpacity(surfaceColor, 0.6),
                            },
                          ]}
                        >
                          {imageUri ? (
                            <>
                              <TouchableOpacity
                                onPress={() => setPreviewAdminImage(imageUri)}
                                activeOpacity={0.9}
                                style={styles.adminImageTouchable}
                              >
                                <Image source={{ uri: imageUri }} style={styles.adminImage} />
                              </TouchableOpacity>
                              {image.uploading && (
                                <View style={styles.uploadOverlay}>
                                  <ActivityIndicator color={accentColor} size="small" />
                                  <Text style={[styles.uploadOverlayText, { color: surfaceColor }]}>Uploading...</Text>
                                </View>
                              )}
                              {image.error && !image.uploading && (
                                <View style={[styles.uploadOverlay, { backgroundColor: 'rgba(255, 0, 0, 0.8)' }]}>
                                  <Icon name="close" color={surfaceColor} size={16} />
                                  <Text style={[styles.uploadOverlayText, { color: surfaceColor }]}>Failed</Text>
                                </View>
                              )}
                            </>
                          ) : (
                            <View style={styles.adminImagePlaceholder}>
                              {image.uploading ? (
                                <ActivityIndicator color={accentColor} size="small" />
                              ) : (
                                <Icon name="image" color={withOpacity(primaryFontColor, 0.4)} size={18} />
                              )}
                            </View>
                          )}
                          {!image.uploading && (
                            <TouchableOpacity
                              onPress={() => handleAdminImageRemove(order.id, image.id)}
                              style={[
                                styles.adminImageRemove,
                                {
                                  backgroundColor: withOpacity(primaryBackgroundColor, 0.9),
                                },
                              ]}
                            >
                              <Text style={[styles.adminImageRemoveText, { color: accentColor }]}>×</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <View
                      style={[
                        styles.adminEmptyUpload,
                        {
                          borderColor: withOpacity(borderColor, 0.6),
                          backgroundColor: withOpacity(surfaceColor, 0.6),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.adminEmptyUploadText,
                          { color: secondaryFontColor },
                        ]}
                      >
                        No images uploaded yet
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => handleAdminImageUpload(order)}
                    style={[
                      styles.adminImageAddButton,
                      {
                        borderColor: withOpacity(accentColor, 0.5),
                        backgroundColor: withOpacity(accentColor, 0.1),
                      },
                    ]}
                  >
                    <Text style={[styles.adminImageAddText, { color: accentColor }]}>+ Add images</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.adminField}>
                  <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Discount</Text>
                  <TextInput
                    value={adminDraft.discount}
                    onChangeText={(value) => handleAdminDraftChange(order.id, 'discount', value)}
                    placeholder="0.00"
                    placeholderTextColor={withOpacity(secondaryFontColor, 0.5)}
                    keyboardType="decimal-pad"
                    style={[
                      styles.adminInput,
                      {
                        borderColor: withOpacity(borderColor, 0.6),
                        color: primaryFontColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.adminField}>
                  <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Tracking number</Text>
                  <TextInput
                    value={adminDraft.trackingNumber}
                    onChangeText={(value) => handleAdminDraftChange(order.id, 'trackingNumber', value)}
                    placeholder="Enter tracking number"
                    placeholderTextColor={withOpacity(secondaryFontColor, 0.5)}
                    style={[
                      styles.adminInput,
                      {
                        borderColor: withOpacity(borderColor, 0.6),
                        color: primaryFontColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.adminStatusRow}>
                  <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Status</Text>
                  <View style={styles.adminStatusChips}>
                    {STATUS_FILTERS.filter((filter) => filter.key !== 'all').map((filter) => {
                      // Normalize status comparison for matching
                      const draftStatus = (adminDraft.status || '').toLowerCase().replace(/\s+/g, '_').replace(/&/g, '');
                      const filterKey = filter.key.toLowerCase().replace(/\s+/g, '_').replace(/&/g, '');
                      const isSelected = draftStatus === filterKey;
                      
                      return (
                        <TouchableOpacity
                          key={filter.key}
                          onPress={() => {
                            // Convert filter key back to proper status format
                            // Map filter keys to actual status values
                            let statusValue = filter.label;
                            if (filter.key === 'approved_&_in_progress') {
                              statusValue = ORDER_STATUS.APPROVED_IN_PROGRESS;
                            } else if (filter.key === 'ready_for_pickup') {
                              statusValue = ORDER_STATUS.READY_FOR_PICKUP;
                            } else if (filter.key === 'ready_for_shipping') {
                              statusValue = ORDER_STATUS.READY_FOR_SHIPPING;
                            } else if (filter.key === 'ready_for_delivery') {
                              statusValue = ORDER_STATUS.READY_FOR_DELIVERY;
                            } else if (filter.key === 'draft') {
                              statusValue = ORDER_STATUS.DRAFT;
                            } else if (filter.key === 'submitted') {
                              statusValue = ORDER_STATUS.SUBMITTED;
                            } else if (filter.key === 'completed') {
                              statusValue = ORDER_STATUS.COMPLETED;
                            } else if (filter.key === 'cancelled') {
                              statusValue = ORDER_STATUS.CANCELLED;
                            }
                            handleAdminStatusSelect(order, statusValue);
                          }}
                          style={[
                            styles.adminStatusChip,
                            {
                              borderColor: isSelected
                                ? accentColor
                                : withOpacity(borderColor, 0.6),
                              backgroundColor: isSelected
                                ? withOpacity(accentColor, 0.12)
                                : surfaceColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.adminStatusChipLabel,
                              { color: isSelected ? accentColor : secondaryFontColor },
                            ]}
                          >
                            {filter.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.adminActionsRow}>
                  <TouchableOpacity
                    onPress={() => handleAdminSave(order)}
                    style={[
                      styles.adminSaveButton,
                      {
                        backgroundColor: accentColor,
                      },
                    ]}
                  >
                    <Text style={[styles.adminSaveButtonText, { color: surfaceColor }]}>Save changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: primaryBackgroundColor }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: primaryBackgroundColor },
        ]}
      refreshControl={
        !isAdmin
          ? (
              <RefreshControl
                tintColor={accentColor}
                refreshing={false}
                onRefresh={() => {
                  // Consent flow removed - no refresh needed
                }}
              />
            )
          : undefined
      }
      bounces={!isAdmin}
      alwaysBounceVertical={!isAdmin}
      overScrollMode={isAdmin ? 'never' : 'auto'}
    >
      <View style={styles.header}>
        <Text
          style={[
            styles.headerTitle,
            { color: primaryFontColor },
          ]}
        >
          Your orders
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            { color: secondaryFontColor },
          ]}
        >
          Track drafts, submitted sets, and upcoming deliveries.
        </Text>
      </View>

      <View
        style={[
          styles.tabBarContainer,
          {
            backgroundColor: withOpacity(surfaceColor, 0.6),
            borderColor: withOpacity(borderColor, 0.4),
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
          nestedScrollEnabled
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: isActive ? withOpacity(accentColor, 0.16) : surfaceColor,
                    borderColor: isActive ? accentColor : withOpacity(borderColor, 0.5),
                  },
                ]}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="button"
                accessibilityState={isActive ? { selected: true } : undefined}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? accentColor : secondaryFontColor },
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isActive ? accentColor : withOpacity(borderColor, 0.6),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      { color: isActive ? surfaceColor : secondaryFontColor },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isAdmin ? (
        <View
          style={[
            styles.adminToolbar,
            {
              borderColor: withOpacity(borderColor, 0.4),
              backgroundColor: withOpacity(surfaceColor, 0.9),
            },
          ]}
        >
          <View style={styles.adminToggleRow}>
            <Text style={[styles.adminToggleLabel, { color: primaryFontColor }]}>Show admin controls</Text>
            <Switch
              value={showAdminControls}
              onValueChange={setShowAdminControls}
              trackColor={{ false: withOpacity(borderColor, 0.6), true: withOpacity(accentColor, 0.4) }}
              thumbColor={showAdminControls ? accentColor : surfaceColor}
            />
          </View>
          
          {/* Status and User filters on the same line */}
          <View style={styles.adminFiltersRow}>
            {/* Status Filter Dropdown */}
            <View style={styles.filterDropdownContainer}>
              <TouchableOpacity
                onPress={() => setStatusDropdownVisible(true)}
                style={[
                  styles.filterDropdownButton,
                  {
                    borderColor: withOpacity(borderColor, 0.6),
                    backgroundColor: surfaceColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterDropdownButtonText,
                    { color: primaryFontColor },
                  ]}
                  numberOfLines={1}
                >
                  {selectedStatusFilter.includes('all') || selectedStatusFilter.length === 0
                    ? 'All Statuses'
                    : selectedStatusFilter.length === 1
                    ? STATUS_FILTERS.find((f) => f.key === selectedStatusFilter[0])?.label || 'Status'
                    : `${selectedStatusFilter.length} Statuses`}
                </Text>
                <Icon name="chevronDown" color={secondaryFontColor} size={16} />
              </TouchableOpacity>
            </View>

            {/* User Filter Dropdown */}
            <View style={styles.filterDropdownContainer}>
              <TouchableOpacity
                onPress={() => setUserDropdownVisible(true)}
                style={[
                  styles.filterDropdownButton,
                  {
                    borderColor: withOpacity(borderColor, 0.6),
                    backgroundColor: surfaceColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterDropdownButtonText,
                    { color: primaryFontColor },
                  ]}
                  numberOfLines={1}
                >
                  {selectedUserFilter.includes('all') || selectedUserFilter.length === 0
                    ? 'All Users'
                    : selectedUserFilter.length === 1
                    ? userOptions.find((o) => o.email === selectedUserFilter[0])?.name || 'User'
                    : `${selectedUserFilter.length} Users`}
                </Text>
                <Icon name="chevronDown" color={secondaryFontColor} size={16} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {/* Status Filter Dropdown Modal */}
      <Modal
        visible={statusDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setStatusDropdownVisible(false)}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: surfaceColor,
                borderColor: withOpacity(borderColor, 0.6),
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryFontColor }]}>Filter by Status</Text>
              <TouchableOpacity onPress={() => setStatusDropdownVisible(false)}>
                <Icon name="close" color={secondaryFontColor} size={20} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={STATUS_FILTERS}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => {
                const isSelected = selectedStatusFilter.includes(item.key);
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (item.key === 'all') {
                        setSelectedStatusFilter(['all']);
                      } else {
                        setSelectedStatusFilter((prev) => {
                          const newSelection = prev.includes('all')
                            ? []
                            : [...prev];
                          if (isSelected) {
                            return newSelection.filter((key) => key !== item.key).length > 0
                              ? newSelection.filter((key) => key !== item.key)
                              : ['all'];
                          } else {
                            return [...newSelection, item.key];
                          }
                        });
                      }
                    }}
                    style={[
                      styles.modalItem,
                      {
                        backgroundColor: isSelected
                          ? withOpacity(accentColor, 0.12)
                          : 'transparent',
                      },
                    ]}
                  >
                    <View style={styles.modalItemContent}>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: isSelected ? accentColor : withOpacity(borderColor, 0.6),
                            backgroundColor: isSelected ? accentColor : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && (
                          <Icon name="check" color={surfaceColor} size={14} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.modalItemText,
                          {
                            color: isSelected ? accentColor : primaryFontColor,
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedStatusFilter(['all']);
                  setStatusDropdownVisible(false);
                }}
                style={[styles.modalButton, { borderColor: withOpacity(borderColor, 0.6) }]}
              >
                <Text style={[styles.modalButtonText, { color: secondaryFontColor }]}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStatusDropdownVisible(false)}
                style={[styles.modalButton, { backgroundColor: accentColor }]}
              >
                <Text style={[styles.modalButtonText, { color: surfaceColor }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* User Filter Dropdown Modal */}
      <Modal
        visible={userDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUserDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setUserDropdownVisible(false)}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: surfaceColor,
                borderColor: withOpacity(borderColor, 0.6),
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryFontColor }]}>Filter by User</Text>
              <TouchableOpacity onPress={() => setUserDropdownVisible(false)}>
                <Icon name="close" color={secondaryFontColor} size={20} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={userOptions}
              keyExtractor={(item) => item.email}
              renderItem={({ item }) => {
                const isSelected = selectedUserFilter.includes(item.email);
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (item.email === 'all') {
                        setSelectedUserFilter(['all']);
                      } else {
                        setSelectedUserFilter((prev) => {
                          const newSelection = prev.includes('all')
                            ? []
                            : [...prev];
                          if (isSelected) {
                            return newSelection.filter((email) => email !== item.email).length > 0
                              ? newSelection.filter((email) => email !== item.email)
                              : ['all'];
                          } else {
                            return [...newSelection, item.email];
                          }
                        });
                      }
                    }}
                    style={[
                      styles.modalItem,
                      {
                        backgroundColor: isSelected
                          ? withOpacity(accentColor, 0.12)
                          : 'transparent',
                      },
                    ]}
                  >
                    <View style={styles.modalItemContent}>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: isSelected ? accentColor : withOpacity(borderColor, 0.6),
                            backgroundColor: isSelected ? accentColor : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && (
                          <Icon name="check" color={surfaceColor} size={14} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.modalItemText,
                          {
                            color: isSelected ? accentColor : primaryFontColor,
                          },
                        ]}
                      >
                        {item.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedUserFilter(['all']);
                  setUserDropdownVisible(false);
                }}
                style={[styles.modalButton, { borderColor: withOpacity(borderColor, 0.6) }]}
              >
                <Text style={[styles.modalButtonText, { color: secondaryFontColor }]}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setUserDropdownVisible(false)}
                style={[styles.modalButton, { backgroundColor: accentColor }]}
              >
                <Text style={[styles.modalButtonText, { color: surfaceColor }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.sectionContent}>
        {state.ordersError ? (
          <View
            style={[
              styles.placeholder,
              {
                borderColor: accentColor,
                backgroundColor: withOpacity(accentColor, 0.1),
              },
            ]}
          >
            <Text
              style={[
                styles.placeholderTitle,
                { color: accentColor },
              ]}
            >
              Error loading orders
            </Text>
            <Text
              style={[
                styles.placeholderSubtitle,
                { color: secondaryFontColor },
              ]}
            >
              {state.ordersError}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (state.currentUser) {
                  loadOrdersForUser(state.currentUser);
                }
              }}
              style={[
                styles.retryButton,
                { borderColor: accentColor },
              ]}
            >
              <Text style={[styles.retryButtonText, { color: accentColor }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : state.ordersLoading ? (
          <View
            style={[
              styles.placeholder,
              {
                borderColor,
                backgroundColor: surfaceColor,
              },
            ]}
          >
            <Text
              style={[
                styles.placeholderTitle,
                { color: primaryFontColor },
              ]}
            >
              Loading orders...
            </Text>
          </View>
        ) : filteredOrders.length ? (
          filteredOrders.map(renderOrderCard)
        ) : (
          <View
            style={[
              styles.placeholder,
              {
                borderColor,
                backgroundColor: surfaceColor,
              },
            ]}
          >
            <Text
              style={[
                styles.placeholderTitle,
                { color: primaryFontColor },
              ]}
            >
              {activeTab === 'drafts'
                ? 'No drafts yet'
                : (() => {
                    // Convert tab key to user-friendly display name
                    const tabDisplayNames = {
                      'cart': 'drafts',
                      'in_progress': 'in progress',
                      'ready': 'ready',
                      'completed': 'completed',
                      'all': 'orders',
                    };
                    const displayName = tabDisplayNames[activeTab] || activeTab;
                    return `No ${displayName} yet`;
                  })()}
            </Text>
            <Text
              style={[
                styles.placeholderSubtitle,
                { color: secondaryFontColor },
              ]}
            >
              {activeTab === 'drafts'
                ? 'Start a new order to begin.'
                : isAdmin
                ? 'No orders found. Create a test order to verify the system is working.'
                : 'Once you have orders in this category, they will appear here.'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
    
      {/* Admin Image Preview Modal */}
      {previewAdminImage ? (
        <Modal
          transparent
          animationType="fade"
          visible={!!previewAdminImage}
          onRequestClose={() => setPreviewAdminImage(null)}
        >
          <View
            style={[
              styles.previewModalContainer,
              { backgroundColor: 'rgba(0, 0, 0, 0.9)' },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setPreviewAdminImage(null)}
              activeOpacity={1}
            />
            <View style={styles.previewModalContent}>
              <TouchableOpacity
                onPress={() => setPreviewAdminImage(null)}
                style={styles.previewModalClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" color={surfaceColor} size={24} />
              </TouchableOpacity>
              <Image
                source={{ uri: previewAdminImage }}
                style={styles.previewModalImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      ) : null}
    
      {/* Toast notification for awaiting submission */}
      {toastMessage ? (
        <View
          style={[
            styles.toastContainer,
            {
              backgroundColor: withOpacity(warningColor, 0.95),
              shadowColor: shadowColor,
            },
          ]}
        >
          <Text style={[styles.toastText, { color: accentContrastColor, flex: 1 }]}>
            {toastMessage}
          </Text>
          <TouchableOpacity
            onPress={() => setToastMessage(null)}
            style={styles.toastCloseButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.toastCloseText, { color: accentContrastColor }]}>
              ×
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 18,
  },
  header: {
    marginBottom: 12,
    gap: 6,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  sectionContent: {
    gap: 14,
  },
  tabBarContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 20,
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 104,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardOrderNumber: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardMeta: {
    fontSize: 12,
  },
  cardMetaSecondary: {
    fontSize: 12,
    marginTop: 4,
  },
  capacityInfoBanner: {
    marginTop: 10,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  capacityInfoText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  placeholder: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 6,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  placeholderSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  placeholderInline: {
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  adminToolbar: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    gap: 10,
    marginHorizontal: 20,
  },
  adminToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  adminFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  adminFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  filterDropdownContainer: {
    flex: 1,
  },
  filterDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  filterDropdownButtonText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  adminFilterChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  adminFilterChipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemText: {
    fontSize: 14,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  adminSection: {
    marginTop: 16,
    gap: 12,
  },
  adminSectionToggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  adminSectionToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  adminForm: {
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  adminUploadsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  adminImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  adminImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  adminImageTouchable: {
    width: '100%',
    height: '100%',
  },
  adminImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  previewModalContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  previewModalContent: {
    width: '100%',
    maxWidth: 600,
    position: 'relative',
  },
  previewModalClose: {
    position: 'absolute',
    top: -40,
    right: 0,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModalImage: {
    width: '100%',
    height: 500,
    borderRadius: 12,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadOverlayText: {
    fontSize: 10,
    fontWeight: '600',
  },
  adminImageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminImageRemoveText: {
    fontSize: 14,
    fontWeight: '700',
  },
  adminEmptyUpload: {
    minWidth: 160,
    minHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  adminEmptyUploadText: {
    fontSize: 12,
    textAlign: 'center',
  },
  adminImageAddButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  adminImageAddText: {
    fontSize: 12,
    fontWeight: '700',
  },
  adminLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  adminInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  adminField: {
    gap: 6,
  },
  adminStatusRow: {
    gap: 8,
  },
  adminStatusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminStatusChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adminStatusChipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  adminActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  adminSaveButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  adminSaveButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    flex: 1,
  },
  toastCloseButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCloseText: {
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 24,
  },
});

export default OrdersScreen;

