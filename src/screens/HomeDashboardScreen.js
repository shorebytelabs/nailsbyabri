import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {FlatList, Image, Linking, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import AppText from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import Icon from '../icons/Icon';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import { getEnabledTips } from '../services/tipsService';
import { getShapeById } from '../utils/pricing';

const CTA_LABEL = 'Create Nail Set';

function HomeDashboardScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, handleStartOrder, ensureAuthenticated, setState } = useAppState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const colors = theme?.colors || {};
  const horizontalPadding = Math.max(16, Math.min(28, width * 0.06));
  const isCompact = width < 780;
  const cardWidth = Math.min(240, width * 0.65);

  const accentColor = colors.accent || '#6F171F';
  const accentContrastColor = colors.accentContrast || '#FFFFFF';
  const onSurfaceColor = colors.onSurface || colors.primaryFont; // Use onSurface for text on surface backgrounds
  const warningColor = colors.warning || '#FF9800';
  const errorColor = colors.error || '#B33A3A';
  const successColor = colors.success || '#4CAF50';
  const secondaryBackgroundColor = colors.secondaryBackground || '#BF9B7A';
  const surfaceColor = colors.surface || '#FFFFFF';
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const borderColor = colors.border || '#D9C8A9';

  // Order status constants (same as OrdersScreen)
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

  const activeOrders = useMemo(() => {
    const list = [];
    
    // Add activeOrder if it exists
    if (state.activeOrder) {
      list.push(state.activeOrder);
    }
    
    // Add lastCompletedOrder if it exists and is different from activeOrder
    if (state.lastCompletedOrder && state.lastCompletedOrder.id !== state.activeOrder?.id) {
      list.push(state.lastCompletedOrder);
    }
    
    // Also include recent orders from state.orders that are active (not completed/cancelled)
    // This ensures users see their orders even if activeOrder/lastCompletedOrder aren't set
    if (state.orders && Array.isArray(state.orders)) {
      const activeStatuses = ['draft', 'awaiting submission', 'awaiting_submission', 'submitted', 'approved & in progress', 'approved_in_progress', 'ready for pickup', 'ready_for_pickup', 'ready for shipping', 'ready_for_shipping', 'ready for delivery', 'ready_for_delivery'];
      
      state.orders.forEach((order) => {
        // Skip if already in list
        if (list.some((o) => o.id === order.id)) {
          return;
        }
        
        const statusLower = (order.status || '').toLowerCase();
        const normalizedStatus = statusLower.replace(/\s+/g, '_').replace(/&/g, '');
        const isActive = activeStatuses.some((activeStatus) => {
          const normalizedActive = activeStatus.replace(/\s+/g, '_').replace(/&/g, '');
          return normalizedStatus === normalizedActive;
        });
        
        if (isActive) {
          list.push(order);
        }
      });
    }
    
    // Sort by updatedAt (most recent first) and limit to 3
    return list
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 3);
  }, [state.activeOrder, state.lastCompletedOrder, state.orders]);

  // Helper functions (same as OrdersScreen)
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

  // Format updated time (same logic as OrdersScreen)
  const formatUpdatedTime = useCallback((order) => {
    if (!order.updatedAt && !order.createdAt) {
      return 'Recently updated';
    }
    const date = new Date(order.updatedAt || order.createdAt);
    return `Updated ${date.toLocaleString()}`;
  }, []);

  // Get status label and colors (same logic as OrdersScreen)
  const getStatusInfo = useCallback((order) => {
    const status = order.status || '';
    const statusLower = status.toLowerCase();
    const normalizedStatus = statusLower.replace(/\s+/g, '_').replace(/&/g, '');
    
    let statusLabel = ORDER_STATUS.SUBMITTED;
    let statusBackground = withOpacity(accentColor, 0.12);
    let statusTextColor = accentColor;

    if (normalizedStatus === 'draft') {
      statusLabel = ORDER_STATUS.DRAFT;
      statusBackground = withOpacity(secondaryBackgroundColor, 0.2);
      statusTextColor = primaryFontColor;
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

    return { statusLabel, statusBackground, statusTextColor };
  }, [accentColor, warningColor, secondaryBackgroundColor, primaryFontColor]);

  // Handle order card press
  const handleOrderPress = useCallback(async (order) => {
    if (!order) {
      return;
    }

    logEvent('tap_order_view', { orderId: order.id, status: order.status });
    // Navigate to order builder for draft orders and "Awaiting Submission" orders, order details for others
    // Check status case-insensitively
    const orderStatusLower = (order.status || '').toLowerCase();
    if (orderStatusLower === 'draft' || orderStatusLower === 'awaiting submission' || orderStatusLower === 'awaiting_submission') {
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
        if (orderStatusLower === 'awaiting submission' || orderStatusLower === 'awaiting_submission') {
          navigation.navigate('NewOrderFlow', { resume: true, initialStep: 'review' });
        } else {
          navigation.navigate('NewOrderFlow', { resume: true });
        }
      } catch (error) {
        console.error('[HomeDashboard] Failed to fetch full order details:', error);
        setState((prev) => ({ ...prev, ordersLoading: false }));
        // Fallback: use the order from state
        setState((prev) => ({
          ...prev,
          activeOrder: order,
        }));
        // Navigate to NewOrderFlow and go directly to Review & Submit step for "Awaiting Submission" orders
        if (orderStatusLower === 'awaiting submission' || orderStatusLower === 'awaiting_submission') {
          navigation.navigate('NewOrderFlow', { resume: true, initialStep: 'review' });
        } else {
          navigation.navigate('NewOrderFlow', { resume: true });
        }
      }
      return;
    }

    // If order is submitted → open order details page
    // Always pass orderId explicitly to ensure correct order is loaded
    const navigateToRoot = (routeName, params) => {
      let parentNav = navigation;
      while (parentNav?.getParent?.()) {
        parentNav = parentNav.getParent();
      }
      parentNav?.navigate(routeName, params);
    };
    // Pass both order (for initial display) and orderId (for fetching full data)
    navigateToRoot('OrderDetails', { 
      order, 
      orderId: order.id, 
      fromHome: true 
    });
  }, [navigation, setState]);

  const [tips, setTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(true);

  useEffect(() => {
    loadTips();
  }, []);

  const loadTips = async () => {
    try {
      setTipsLoading(true);
      const enabledTips = await getEnabledTips();
      setTips(enabledTips || []);
    } catch (error) {
      console.error('[HomeDashboard] Error loading tips:', error);
      // Fallback to empty array on error
      setTips([]);
    } finally {
      setTipsLoading(false);
    }
  };

  // Calculate notification count for badge
  const notificationCount = useMemo(() => {
    // Return count of notifications (not the actual messages)
    if (activeOrders.length === 0) {
      return 1; // "Create your first set" notification
    }
    return 2; // Shipment and care notifications
  }, [activeOrders.length]);

  const handleCreatePress = () => {
    const canProceed = handleStartOrder({ navigation });
    if (canProceed) {
      logEvent('tap_home_create');
      navigation.navigate('NewOrderFlow');
    }
  };

  const handleOpenUrl = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.warn('[HomeDashboard] Cannot open URL:', url);
      }
    } catch (error) {
      console.error('[HomeDashboard] Error opening URL:', error);
    }
  };

  // Helper function to render tip description with optional YouTube link
  const renderTipDescription = (description, youtubeUrl) => {
    if (!youtubeUrl) {
      return <AppText style={[styles.tipCopy, { color: colors.secondaryFont }]}>{description}</AppText>;
    }

    return (
      <AppText style={[styles.tipCopy, { color: colors.secondaryFont }]}>
        {description}
        {' '}
        <AppText
          style={[styles.tipLink, { color: accentColor }]}
          onPress={() => handleOpenUrl(youtubeUrl)}
        >
          Watch this video
        </AppText>
      </AppText>
    );
  };


  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom + 24, 36),
          paddingHorizontal: horizontalPadding,
          backgroundColor: colors.primaryBackground,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
        <View
          style={[
            styles.heroCard,
            {
              // OPTION 1: Solid color (brown/beige)
              // backgroundColor: colors.secondaryBackground,
              
              // OPTION 2: Lighter gradient-like color (uncomment to try)
              // backgroundColor: withOpacity(colors.primaryBackground, 0.6),
              
              // OPTION 3: Accent color with low opacity
              // backgroundColor: withOpacity(accentColor, 0.1),
              
              // OPTION 3B: Light cream/beige tint (ACTIVE) - similar to Option 3 but different color
              backgroundColor: withOpacity(colors.secondaryBackground || '#E7D8CA', 0.5),//.3
              
              // OPTION 4: White/light surface (uncomment to try)
              // backgroundColor: colors.surface,
              
              // OPTION 5: Image Background - uncomment Image and overlay below
              // backgroundColor: 'transparent',
            },
          ]}
        >
          {/* OPTION 5: Image Background - uncomment to use */}
          {/* 
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80' }}
            style={styles.heroBackgroundImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          */}
          
          <View style={styles.heroTextGroup}>
            <AppText
              style={[
                styles.heroTitle,
                { color: colors.primaryFont },
              ]}
            >
              Design Your Perfect Nails
            </AppText>
            <AppText
              style={[
                styles.heroSubtitle,
                { color: colors.secondaryFont },
              ]}
            >
              Pick your shape, design, and sizing in minutes
            </AppText>
            <TouchableOpacity
              style={[
                styles.heroButton,
                { 
                  backgroundColor: accentColor,
                  shadowColor: accentColor,
                },
              ]}
              onPress={handleCreatePress}
              accessibilityLabel="Create new custom nail set"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.85}
            >
              <AppText style={[styles.heroButtonText, { color: accentContrastColor }]}>
                {CTA_LABEL}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <AppText
            style={[
              styles.sectionTitle,
              { color: colors.primaryFont },
            ]}
          >
            Active orders
          </AppText>
          <TouchableOpacity
            onPress={() => {
              const allowed = ensureAuthenticated({
                navigation,
                message: 'Log in to view your orders.',
                redirect: { type: 'tab', tab: 'Orders' },
              });
              if (!allowed) {
                return;
              }
              navigation.navigate('Orders');
            }}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText
              style={[
                styles.sectionAction,
                { color: accentColor },
              ]}
            >
              View all
            </AppText>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.orderStrip}
        >
          {activeOrders.length === 0 ? (
            [
              <View
                key="no-orders-placeholder"
                style={[
                  styles.orderCard,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    width: cardWidth,
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.orderName,
                    { color: onSurfaceColor },
                  ]}
                >
                  No active orders
                </AppText>
                <AppText
                  style={[
                    styles.orderMeta,
                    { color: colors.secondaryFont },
                  ]}
                >
                  Start your first custom set to track it here.
                </AppText>
              </View>
            ]
          ) : (
            activeOrders.map((order) => {
              const statusInfo = getStatusInfo(order);
              return (
                <TouchableOpacity
                  key={order.id}
                  style={[
                    styles.orderCard,
                    {
                      borderColor: borderColor,
                      backgroundColor: surfaceColor,
                      width: cardWidth,
                    },
                  ]}
                  onPress={() => handleOrderPress(order)}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderCardContent}>
                    {/* Order Number */}
                    <AppText
                      style={[
                        styles.orderNumber,
                        { color: primaryFontColor },
                      ]}
                      numberOfLines={1}
                    >
                      Order #{getOrderNumber(order)}
                    </AppText>
                    
                    {/* Status */}
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: statusInfo.statusBackground,
                          alignSelf: 'flex-start',
                        },
                      ]}
                    >
                      <AppText
                        style={[
                          styles.statusText,
                          { color: statusInfo.statusTextColor },
                        ]}
                        numberOfLines={1}
                      >
                        {statusInfo.statusLabel.toUpperCase()}
                      </AppText>
                    </View>
                    
                    {/* Set Summary */}
                    <AppText
                      style={[
                        styles.orderSummary,
                        { color: secondaryFontColor },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {getOrderSummary(order)}
                    </AppText>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <AppText
            style={[
              styles.sectionTitle,
              { color: colors.primaryFont },
            ]}
          >
            Tips
          </AppText>
        </View>
        {tipsLoading ? (
          <View style={styles.tipsLoadingContainer}>
            <AppText style={[styles.tipsLoadingText, { color: colors.secondaryFont }]}>Loading tips...</AppText>
          </View>
        ) : tips.length === 0 ? (
          <View style={styles.tipsEmptyContainer}>
            <AppText style={[styles.tipsEmptyText, { color: colors.secondaryFont }]}>No tips available</AppText>
          </View>
        ) : (
          <FlatList
            data={tips}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tipsCarousel}
            snapToInterval={cardWidth + 12} // card width + gap
            decelerationRate="fast"
            pagingEnabled={false}
            renderItem={({ item: tip }) => (
              <View
                style={[
                  styles.tipCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    width: cardWidth,
                  },
                ]}
              >
                {tip.image_url ? (
                  <Image
                    source={{ uri: tip.image_url }}
                    style={styles.tipImage}
                    resizeMode="cover"
                  />
                ) : null}
                <AppText
                  style={[
                    styles.tipTitle,
                    { color: onSurfaceColor },
                  ]}
                  numberOfLines={1}
                >
                  {tip.title}
                </AppText>
                {renderTipDescription(tip.description, tip.youtube_url)}
              </View>
            )}
          />
        )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingTop: 10,
  },
  heroCard: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    minHeight: 180,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Dark overlay for text readability
  },
  heroTextGroup: {
    gap: 12,
    zIndex: 1,
    position: 'relative',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 2,
  },
  heroButton: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    alignSelf: 'flex-start',
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  heroButtonText: {
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderStrip: {
    gap: 12,
    paddingVertical: 4,
  },
  orderCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  orderCardContent: {
    gap: 8,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
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
  orderSummary: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  orderMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  tipsCarousel: {
    paddingVertical: 4,
    gap: 12,
  },
  tipsLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  tipsLoadingText: {
    fontSize: 14,
  },
  tipsEmptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  tipsEmptyText: {
    fontSize: 14,
  },
  tipCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 0,
    gap: 0,
    marginRight: 12,
    overflow: 'hidden',
  },
  tipImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    padding: 16,
    paddingBottom: 8,
  },
  tipCopy: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tipLink: {
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default HomeDashboardScreen;

