import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { formatCurrency } from '../utils/pricing';
import { withOpacity } from '../utils/color';
import VenmoPaymentInfo from '../components/VenmoPaymentInfo';
import { updateOrder } from '../services/orderService';

const LOGO_SOURCE = require('../../assets/images/NailsByAbriLogo.png');
const SUPPORT_EMAIL = 'mailto:NailsByAbriannaC@gmail.com';
const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

function createStyles(colors) {
  const cardShadow = {
    shadowColor: colors.shadow || '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  };

  return StyleSheet.create({
    root: {
      flex: 1,
    },
    brandHeaderSafe: {
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    brandHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 6,
      gap: 8,
    },
    brandInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brandLogoFrame: {
      height: 56,
      width: 200,
      justifyContent: 'center',
      overflow: 'hidden',
      marginTop: 4,
    },
    brandLogo: {
      width: '100%',
      height: 120,
      marginTop: 50,
    },
    scrollContent: {
      gap: 24,
      paddingBottom: 40,
    },
    pageHeader: {
      gap: 8,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.primaryFont || '#354037',
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    backIcon: {
      transform: [{ rotate: '180deg' }],
    },
    backLinkLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent || '#6F171F',
    },
    cardsColumn: {
      gap: 20,
    },
    card: {
      borderRadius: 20,
      padding: 20,
      gap: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      backgroundColor: colors.surface || '#FFFFFF',
      ...cardShadow,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
    },
    orderIdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      backgroundColor: colors.surfaceMuted || withOpacity(colors.accent || '#6F171F', 0.05),
    },
    orderIdTextGroup: {
      gap: 4,
    },
    orderIdLabel: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.secondaryFont || '#767154',
    },
    orderIdValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
    },
    orderIdIconContainer: {
      height: 32,
      width: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface || '#FFFFFF',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    summaryLabel: {
      fontSize: 13,
      color: colors.secondaryFont || '#767154',
      flex: 0.6,
    },
    summaryValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
      flex: 0.4,
      textAlign: 'right',
    },
    itemsList: {
      gap: 16,
    },
    itemCard: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      backgroundColor: colors.surface || '#FFFFFF',
      padding: 18,
      gap: 16,
      ...cardShadow,
    },
    itemCardSpacing: {
      marginBottom: 4,
    },
    itemHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    itemHeaderText: {
      flex: 1,
      gap: 4,
    },
    itemHeading: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
    },
    itemSubHeading: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.secondaryFont || '#767154',
    },
    itemMetaLine: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
    },
    itemQuantityPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted || withOpacity(colors.accent || '#6F171F', 0.08),
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 2,
    },
    itemQuantityValue: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
    },
    itemSection: {
      gap: 8,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    timelineHighlight: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent || '#6F171F',
    },
    itemBodyCopy: {
      fontSize: 13,
      color: colors.primaryFont || '#354037',
      lineHeight: 18,
    },
    itemMetaRight: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
    },
    uploadsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 8,
    },
    uploadThumbnail: {
      height: 64,
      width: 64,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.08),
    },
    uploadImage: {
      height: '100%',
      width: '100%',
      resizeMode: 'cover',
    },
    sizeSection: {
      gap: 8,
    },
    sizeChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sizeChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.12),
    },
    sizeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
    },
    secondaryText: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
    },
    addressGroup: {
      gap: 4,
    },
    addressLine: {
      fontSize: 13,
      color: colors.secondaryFont || '#767154',
    },
    actionsCard: {
      gap: 12,
      borderRadius: 20,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      backgroundColor: colors.surface || '#FFFFFF',
      ...cardShadow,
    },
    secondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
    },
    secondaryActionIcon: {
      height: 28,
      width: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.1),
    },
    secondaryActionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
    },
    bodyText: {
      fontSize: 14,
      color: colors.secondaryFont || '#767154',
      lineHeight: 20,
    },
    toast: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 24,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.95),
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow || '#000000',
      shadowOpacity: 0.2,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    toastText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accentContrast || '#FFFFFF',
    },
    previewBackdrop: {
      flex: 1,
      backgroundColor: withOpacity(colors.shadow || '#000000', 0.85),
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewBackdropOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    previewImage: {
      width: '82%',
      aspectRatio: 1,
      borderRadius: 18,
      resizeMode: 'contain',
    },
    previewImageContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewImageZoomable: {
      width: '100%',
      height: '100%',
    },
    previewActionsContainer: {
      position: 'absolute',
      bottom: 40,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
    },
    previewActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 999,
      minWidth: 100,
    },
    previewCloseButtonModal: {
      backgroundColor: withOpacity(colors.surface || '#FFFFFF', 0.9),
    },
    previewActionLabel: {
      fontSize: 14,
      fontWeight: '700',
    },
    previewCloseButton: {
      position: 'absolute',
      bottom: 40,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.surface || '#FFFFFF', 0.9),
    },
    previewCloseLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.secondaryFont || '#767154',
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    totalRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider || '#E6DCD0',
      paddingTop: 12,
    },
    totalLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
    },
    totalValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primaryFont || '#354037',
    },
    summarySection: {
      gap: 12,
    },
    summaryRowCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    summaryLabelCompact: {
      fontSize: 13,
      color: colors.secondaryFont || '#767154',
    },
    summaryValueCompact: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
    },
    summaryOrderIdContainer: {
      borderRadius: 16,
      padding: 16,
      gap: 8,
      backgroundColor: withOpacity(colors.surface, 0.6),//colors.surfaceMuted || withOpacity(colors.accent || '#6F171F', 0.06),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
    },
    summaryOrderIdLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.secondaryFont || '#767154',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    summaryOrderIdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    summaryOrderIdValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.primaryFont || '#354037',
    },
    summaryCopyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      backgroundColor: colors.surface || '#FFFFFF',
    },
    summaryCopyLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent || '#6F171F',
    },
    summaryOrderIdSubtitle: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
    },
    inlineLabelText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent || '#6F171F',
    },
    inlineValueText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent || '#6F171F',
    },
    secondaryActionIcon: {
      height: 36,
      width: 36,
      borderRadius: 18,
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.1),
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: colors.accent || '#6F171F',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: colors.accent || '#6F171F',
    },
    adminPaymentAction: {
      marginTop: 16,
      padding: 16,
      borderRadius: 16,
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.05),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withOpacity(colors.accent || '#6F171F', 0.2),
      gap: 8,
    },
    markPaidButton: {
      backgroundColor: colors.success || '#4B7A57',
    },
    adminPaymentHint: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
      textAlign: 'center',
      fontStyle: 'italic',
    },
    paymentReceivedCard: {
      borderRadius: 20,
      padding: 20,
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      backgroundColor: colors.surface || '#FFFFFF',
      ...cardShadow,
    },
    paymentReceivedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    paymentReceivedTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.success || '#4B7A57',
    },
    paymentReceivedText: {
      fontSize: 14,
      color: colors.secondaryFont || '#767154',
      lineHeight: 20,
    },
    paymentReceivedAdminNote: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
      fontStyle: 'italic',
      marginTop: 4,
    },
  });
}

/**
 * ZoomableImageModal - A full-screen image viewer with pinch-to-zoom and pan gestures
 */
function ZoomableImageModal({ imageUri, onClose, colors, styles: modalStyles }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      // Clamp scale between 1 and 5
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > 5) {
        scale.value = withSpring(5);
      }
      savedScale.value = scale.value;
    });

  // Pan gesture for moving zoomed image
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Combined gestures
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Animated style for the image
  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Reset zoom when image changes
  useEffect(() => {
    if (imageUri) {
      scale.value = withTiming(1);
      savedScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [imageUri, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const handleDoubleTap = useCallback(() => {
    if (scale.value > 1) {
      // Reset zoom
      scale.value = withSpring(1);
      savedScale.value = 1;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    } else {
      // Zoom to 2x
      scale.value = withSpring(2);
      savedScale.value = 2;
    }
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(handleDoubleTap);

  const finalGesture = Gesture.Race(doubleTapGesture, composedGesture);

  if (!imageUri) {
    return null;
  }

  return (
    <View style={modalStyles.previewBackdrop}>
      <Pressable
        style={modalStyles.previewBackdropOverlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close image preview"
      />
      
      <GestureDetector gesture={finalGesture}>
        <Animated.View style={[modalStyles.previewImageContainer, imageAnimatedStyle]}>
          <Image
            source={{ uri: imageUri }}
            style={modalStyles.previewImageZoomable}
            resizeMode="contain"
          />
        </Animated.View>
      </GestureDetector>

      {/* Action buttons */}
      <View style={modalStyles.previewActionsContainer}>
        <Pressable
          style={({ pressed }) => [
            modalStyles.previewActionButton,
            modalStyles.previewCloseButtonModal,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <AppText variant="ui" style={[modalStyles.previewCloseLabel, { color: colors.primaryFont || '#354037' }]}>
            Close
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function OrderDetailsScreen({ navigation, route }) {
  const initialOrder = route.params?.order || null;
  const fromOrders = Boolean(route.params?.fromOrders);
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isAdmin = state.currentUser?.isAdmin || false;

  const [order, setOrder] = useState(initialOrder);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Fetch full order details if order doesn't have images (likely from list view)
  useEffect(() => {
    const fetchFullOrder = async () => {
      // Only fetch if we have an order ID, came from orders list, and haven't already started loading
      if (!initialOrder?.id || !fromOrders || loadingOrder) {
        return;
      }

      // Check if order sets have images - if not, fetch full order
      const hasImages = initialOrder?.nailSets?.some((set) => {
        const hasDesignImages = Array.isArray(set.designUploads) && set.designUploads.length > 0;
        const hasSizingImages = Array.isArray(set.sizingUploads) && set.sizingUploads.length > 0;
        return hasDesignImages || hasSizingImages;
      });

      // If no images found, fetch full order details
      if (!hasImages) {
        try {
          setLoadingOrder(true);
          const { fetchOrder } = await import('../services/orderService');
          const { order: fullOrder } = await fetchOrder(initialOrder.id);
          setOrder(fullOrder);
        } catch (error) {
          console.error('[OrderDetailsScreen] Failed to fetch full order details:', error);
          // Keep using the initial order if fetch fails
        } finally {
          setLoadingOrder(false);
        }
      }
    };

    fetchFullOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrder?.id, fromOrders]);

  const orderId = order?.id || '—';
  const displayOrderId = orderId && orderId !== '—' ? orderId.slice(0, 8).toUpperCase() : '—';
  const orderDate = order?.placedAt || order?.createdAt || order?.submittedAt || order?.updatedAt || null;
  const orderTimestamp = orderDate ? new Date(orderDate) : null;
  const status = order?.status || 'Processing';
  const items = Array.isArray(order?.nailSets) ? order.nailSets : [];
  const fulfillment = order?.fulfillment || {};
  const deliveryMethod =
    fulfillment?.methodLabel ||
    fulfillment?.deliveryMethod ||
    fulfillment?.method ||
    'Delivery';
  const deliveryOptionLabel =
    fulfillment?.speedLabel ||
    fulfillment?.speedOption ||
    fulfillment?.speed ||
    'Standard';
  const deliveryTiming =
    fulfillment?.expectedDate ||
    order?.estimatedFulfillmentDate ||
    fulfillment?.estimatedWindow ||
    order?.estimatedReadyWindow ||
    order?.estimatedTurnaround ||
    fulfillment?.timing ||
    '';
  const deliveryDays =
    fulfillment?.speedDescription ||
    fulfillment?.speedTimeline ||
    order?.estimatedTurnaround ||
    fulfillment?.speedRange ||
    '10 to 14 days';
  const hasAddress =
    fulfillment?.address && (fulfillment.address.line1 || fulfillment.address.city || fulfillment.address.postalCode);

  const backgroundColor = colors.primaryBackground || '#F4EBE3';

  const handleCopyOrderId = useCallback(() => {
    if (!orderId || orderId === '—') {
      return;
    }
    try {
      if (typeof Clipboard?.setString === 'function') {
        Clipboard.setString(orderId);
      }
    } catch (error) {
      // ignore clipboard errors
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  }, [orderId]);

  const handleContactSupport = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(SUPPORT_EMAIL);
      if (canOpen) {
        await Linking.openURL(SUPPORT_EMAIL);
        return;
      }
    } catch (error) {
      // ignore
    }
    Alert.alert('Contact Support', 'Please email NailsByAbriannaC@gmail.com for assistance.');
  }, []);

  const handleMarkAsPaid = useCallback(async () => {
    if (!order?.id) {
      return;
    }

    Alert.alert(
      'Mark Order as Paid',
      `Are you sure you want to mark order #${displayOrderId} as paid? This will update the payment status.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Paid',
          style: 'default',
          onPress: async () => {
            try {
              setMarkingPaid(true);
              const now = new Date().toISOString();
              await updateOrder(order.id, {
                paid_at: now,
              });
              
              // Update local state
              setOrder((prev) => ({
                ...prev,
                paid_at: now,
                paidAt: now, // Also set camelCase version for consistency
              }));
              
              Alert.alert('Success', 'Order has been marked as paid.');
            } catch (error) {
              console.error('[OrderDetailsScreen] Error marking order as paid:', error);
              Alert.alert('Error', 'Failed to mark order as paid. Please try again.');
            } finally {
              setMarkingPaid(false);
            }
          },
        },
      ]
    );
  }, [order?.id, displayOrderId]);

  const handlePreviewImage = useCallback((upload) => {
    const source = resolveImageSource(upload);
    if (!source) {
      Alert.alert('Preview unavailable', 'Unable to open this image preview right now.');
      return;
    }
    setPreviewImage(source);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);


  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (fromOrders) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              index: 2, // Orders tab index
              routes: [{ name: 'Home' }, { name: 'Gallery' }, { name: 'Orders' }, { name: 'Profile' }],
            },
          },
        ],
      });
      return;
    }

    navigation.navigate('OrderConfirmation', { order });
  }, [fromOrders, navigation, order]);

  if (!order) {
    return (
      <View style={[styles.root, { backgroundColor }]}>
        <SafeAreaView
          edges={['top', 'left', 'right']}
          style={[
            styles.brandHeaderSafe,
            { backgroundColor, borderBottomColor: withOpacity(colors.shadow || '#000000', 0.08) },
          ]}
        >
          <View style={styles.brandHeader}>
            <View style={styles.brandInfo}>
              <View style={styles.brandLogoFrame}>
                <Image source={LOGO_SOURCE} style={styles.brandLogo} resizeMode="cover" />
              </View>
            </View>
          </View>
        </SafeAreaView>
        <ScreenContainer scroll={false}>
          <View style={styles.emptyState}>
            <AppText style={styles.emptyTitle}>Order not found</AppText>
            <AppText style={styles.emptySubtitle}>
              We couldn’t load the order details. Return to your profile or contact support for help.
            </AppText>
            <PrimaryButton label="Back to Home" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })} />
          </View>
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[
          styles.brandHeaderSafe,
          { backgroundColor, borderBottomColor: withOpacity(colors.shadow || '#000000', 0.08) },
        ]}
      >
        <View style={styles.brandHeader}>
          <View style={styles.brandInfo}>
            <View style={styles.brandLogoFrame}>
              <Image
                source={LOGO_SOURCE}
                style={styles.brandLogo}
                resizeMode="cover"
                accessibilityRole="image"
                accessibilityLabel="Nails by Abri"
              />
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScreenContainer scroll={false}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.pageHeader}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={fromOrders ? 'Back to orders' : 'Back to order confirmation'}
            >
              <Icon name="chevronRight" color={colors.accent} style={styles.backIcon} size={20} />
              <AppText style={styles.backLinkLabel}>
                {fromOrders ? 'Back to Orders' : 'Back to Order Confirmation'}
              </AppText>
            </Pressable>
            <AppText style={styles.pageTitle}>Order #{displayOrderId}</AppText>
          </View>

          <View style={styles.cardsColumn}>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <AppText style={styles.cardTitle}>Order Summary</AppText>
              </View>

              <View style={styles.summaryOrderIdContainer}>
                <AppText style={styles.summaryOrderIdLabel}>Order ID</AppText>
                <View style={styles.summaryOrderIdRow}>
                  <AppText style={styles.summaryOrderIdValue}>{displayOrderId}</AppText>
                  <Pressable
                    onPress={handleCopyOrderId}
                    style={({ pressed }) => [
                      styles.summaryCopyButton,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Copy order ID"
                    testID="order-details-copy-action"
                  >
                    <Icon name="copy" color={colors.accent} size={18} />
                    <AppText style={styles.summaryCopyLabel}>Copy</AppText>
                  </Pressable>
                </View>
                <AppText style={styles.summaryOrderIdSubtitle}>Order ID: {orderId}</AppText>
              </View>

              <View style={styles.summarySection}>
                <View style={styles.summaryRowCompact}>
                  <AppText style={styles.summaryLabelCompact}>Placed on</AppText>
                  <AppText style={styles.summaryValueCompact}>
                    {orderTimestamp ? formatDateTime(orderTimestamp) : '—'}
                  </AppText>
                </View>
                <View style={styles.summaryRowCompact}>
                  <AppText style={styles.summaryLabelCompact}>Status</AppText>
                  <View
                    style={[styles.statusBadge, getStatusPillColors(status, colors)]}
                  >
                    <AppText style={styles.statusText}>{status}</AppText>
                  </View>
                </View>
              </View>
            </View>

            {/* Payment Info Section */}
            {/* Check paidAt (transformed field from fetchOrder) or paid_at (database field) */}
            {!(order?.paidAt || order?.paid_at) ? (
              <View>
                <VenmoPaymentInfo
                  totalAmount={order?.pricing?.total || order?.total}
                  orderNumber={orderId || displayOrderId}
                  showQRCode={true}
                  compact={false}
                  showPaymentNeeded={true}
                />
                {/* Admin: Mark as Paid Button */}
                {isAdmin && (
                  <View style={styles.adminPaymentAction}>
                    <PrimaryButton
                      label={markingPaid ? 'Marking as Paid...' : 'Mark Order as Paid'}
                      onPress={handleMarkAsPaid}
                      disabled={markingPaid}
                      style={styles.markPaidButton}
                    />
                    <AppText style={styles.adminPaymentHint}>
                      Click this button after confirming payment has been received via Venmo.
                    </AppText>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.paymentReceivedCard}>
                <View style={styles.paymentReceivedHeader}>
                  <Icon name="checkCircle" color={colors.success || '#4B7A57'} size={24} />
                  <AppText style={styles.paymentReceivedTitle}>Payment Received</AppText>
                </View>
                <AppText style={styles.paymentReceivedText}>
                  Payment was received on {(order.paid_at || order.paidAt) ? new Date(order.paid_at || order.paidAt).toLocaleDateString() : '—'}
                </AppText>
              </View>
            )}

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <AppText style={styles.cardTitle}>Items Ordered</AppText>
              </View>
              <View style={styles.itemsList}>
                {items.length ? (
                  items.map((item, index) => {
                    const sizePairs = extractSizePairs(item.sizes);
                    const designRequested = Boolean(
                      item.requiresFollowUp || item.requestDesignHelp || item.designHelp,
                    );
                    const sizingRequested = Boolean(
                      item.requiresSizingHelp || item.requires_sizing_help,
                    );
                    const uploads = Array.isArray(item.designUploads) ? item.designUploads : [];
                    const primaryImage = uploads.length ? resolveImageSource(uploads[0]) : null;

                    return (
                      <View
                        key={item.id || `item-${index}`}
                        style={[styles.itemCard, index < items.length - 1 && styles.itemCardSpacing]}
                      >
                        <View style={styles.itemHeaderRow}>
                          <View style={styles.itemHeaderText}>
                            <AppText style={styles.itemHeading}>Nail Set #{index + 1}</AppText>
                            <AppText style={styles.itemSubHeading}>
                              {item.name ? item.name : formatTitleCase(item.shapeName || item.shapeId || 'Custom')}
                            </AppText>
                            <AppText style={styles.itemMetaLine}>
                              Shape: {formatTitleCase(item.shapeName || item.shapeId || 'Custom')}
                            </AppText>
                          </View>
                          {item.unitPrice ? (
                            <View style={styles.itemQuantityPill}>
                              <AppText style={styles.itemQuantityValue}>{formatCurrency(item.unitPrice)}</AppText>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.itemSection}>
                          <AppText style={styles.sectionLabel}>Custom Sizes</AppText>
                          {sizePairs.length ? (
                            <View style={styles.sizeChipRow}>
                              {sizePairs.map((pair) => (
                                <View key={`${pair.finger}-${pair.value}`} style={styles.sizeChip}>
                                  <AppText style={styles.sizeChipText}>
                                    {pair.finger}: {pair.value || '?'}
                                  </AppText>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <AppText style={styles.secondaryText}>Standard set</AppText>
                          )}
                        </View>

                        <View style={styles.itemSection}>
                          <AppText style={styles.sectionLabel}>Design Assistance</AppText>
                          <AppText style={styles.itemBodyCopy}>{designRequested ? 'Yes' : 'No'}</AppText>
                          {item.designAssistanceNotes ? (
                            <AppText style={styles.secondaryText}>{item.designAssistanceNotes}</AppText>
                          ) : null}
                        </View>

                        <View style={styles.itemSection}>
                          <AppText style={styles.sectionLabel}>Sizing Assistance</AppText>
                          <AppText style={styles.itemBodyCopy}>{sizingRequested ? 'Yes' : 'No'}</AppText>
                        </View>

                        {item.description ? (
                          <View style={styles.itemSection}>
                            <AppText style={styles.sectionLabel}>Description</AppText>
                            <AppText style={styles.itemBodyCopy}>{item.description}</AppText>
                          </View>
                        ) : null}

                        {item.setNotes ? (
                          <View style={styles.itemSection}>
                            <AppText style={styles.sectionLabel}>Notes</AppText>
                            <AppText style={styles.itemBodyCopy}>{item.setNotes}</AppText>
                          </View>
                        ) : null}

                        {item.specialRequests ? (
                          <View style={styles.itemSection}>
                            <AppText style={styles.sectionLabel}>Special Requests</AppText>
                            <AppText style={styles.itemBodyCopy}>{item.specialRequests}</AppText>
                          </View>
                        ) : null}

                        <View style={styles.itemSection}>
                          <AppText style={styles.sectionLabel}>Design Images</AppText>
                          {uploads.length ? (
                            <View style={styles.uploadsRow}>
                              {uploads.map((upload, uploadIndex) => {
                                const source = resolveImageSource(upload);
                                if (!source) {
                                  return null;
                                }
                                return (
                                  <Pressable
                                    key={upload?.id || `${item.id || index}-upload-${uploadIndex}`}
                                    onPress={() => handlePreviewImage(upload)}
                                    style={({ pressed }) => [
                                      styles.uploadThumbnail,
                                      pressed && { opacity: 0.7 },
                                    ]}
                                    accessibilityRole="imagebutton"
                                    accessibilityLabel={`Preview design image ${uploadIndex + 1}`}
                                  >
                                    <Image source={{ uri: source }} style={styles.uploadImage} />
                                  </Pressable>
                                );
                              })}
                            </View>
                          ) : (
                            <AppText style={styles.secondaryText}>No design images provided.</AppText>
                          )}
                        </View>

                        <View style={styles.itemSection}>
                          <AppText style={styles.sectionLabel}>Sizing Images</AppText>
                          {(() => {
                            const sizingUploads = Array.isArray(item.sizingUploads) ? item.sizingUploads : [];
                            return sizingUploads.length ? (
                              <View style={styles.uploadsRow}>
                                {sizingUploads.map((upload, uploadIndex) => {
                                  const source = resolveImageSource(upload);
                                  if (!source) {
                                    return null;
                                  }
                                  return (
                                    <Pressable
                                      key={upload?.id || `${item.id || index}-sizing-${uploadIndex}`}
                                      onPress={() => handlePreviewImage(upload)}
                                      style={({ pressed }) => [
                                        styles.uploadThumbnail,
                                        pressed && { opacity: 0.7 },
                                      ]}
                                      accessibilityRole="imagebutton"
                                      accessibilityLabel={`Preview sizing image ${uploadIndex + 1}`}
                                    >
                                      <Image source={{ uri: source }} style={styles.uploadImage} />
                                    </Pressable>
                                  );
                                })}
                              </View>
                            ) : (
                              <AppText style={styles.secondaryText}>No sizing images provided.</AppText>
                            );
                          })()}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <AppText style={styles.placeholderText}>No items found for this order.</AppText>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <AppText style={styles.cardTitle}>Delivery Details</AppText>
              </View>
              <View style={styles.itemSection}>
                <AppText style={styles.inlineLabelText}>
                  Estimated ready date:{' '}
                  <AppText style={styles.inlineValueText}>
                    {order?.pricing?.estimatedCompletionDate
                      ? formatDeliveryWindow(order.pricing.estimatedCompletionDate)
                      : deliveryTiming
                      ? formatDeliveryWindow(deliveryTiming)
                      : 'Pending'}
                  </AppText>
                </AppText>
              </View>
              <View style={styles.itemSection}>
                <AppText style={styles.sectionLabel}>Delivery Method</AppText>
                <AppText style={styles.itemBodyCopy}>{formatTitleCase(deliveryMethod)}</AppText>
              </View>
              <View style={styles.itemSection}>
                <AppText style={styles.sectionLabel}>Delivery Timing</AppText>
                <AppText style={styles.itemBodyCopy}>{`${formatTitleCase(deliveryOptionLabel)} (${deliveryDays})`}</AppText>
              </View>
              {hasAddress ? (
                <View style={styles.itemSection}>
                  <AppText style={styles.sectionLabel}>Delivery Address</AppText>
                  <View style={styles.addressGroup}>
                    <AppText style={styles.addressLine}>{fulfillment.address?.name}</AppText>
                    <AppText style={styles.addressLine}>{fulfillment.address?.line1}</AppText>
                    {fulfillment.address?.line2 ? (
                      <AppText style={styles.addressLine}>{fulfillment.address.line2}</AppText>
                    ) : null}
                    <AppText style={styles.addressLine}>
                      {[fulfillment.address?.city, fulfillment.address?.state, fulfillment.address?.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </AppText>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <AppText style={styles.cardTitle}>Price Breakdown</AppText>
              </View>
              {order?.pricing && typeof order.pricing === 'object' && Array.isArray(order.pricing.lineItems) && order.pricing.lineItems.length > 0 ? (
                order.pricing.lineItems.map((item) => (
                  <SummaryRow
                    key={item.id}
                    styles={styles}
                    label={item.label}
                    value={formatCurrency(item.amount)}
                  />
                ))
              ) : (
                <AppText style={styles.secondaryText}>Pricing details unavailable.</AppText>
              )}
              <View style={styles.totalRow}>
                <AppText style={styles.totalLabel}>Total</AppText>
                <AppText style={styles.totalValue}>
                  {order?.pricing && typeof order.pricing === 'object' && typeof order.pricing.total === 'number'
                    ? formatCurrency(order.pricing.total)
                    : typeof order?.total === 'number'
                    ? formatCurrency(order.total)
                    : formatCurrency(0)}
                </AppText>
              </View>
            </View>
          </View>

          <View style={styles.actionsCard}>
            <AppText style={styles.cardTitle}>Next Steps</AppText>
            <AppText style={styles.bodyText}>
              Need help or an update? Reach out anytime and we’ll get back to you.
            </AppText>
            <Pressable
              onPress={handleContactSupport}
              style={({ pressed }) => [styles.secondaryAction, { opacity: pressed ? 0.8 : 1 }]}
              accessibilityRole="button"
            >
              <View style={styles.secondaryActionIcon}>
                <Icon name="mail" color={colors.accent} size={18} />
              </View>
              <AppText style={styles.secondaryActionLabel}>Contact Support</AppText>
            </Pressable>
          </View>
        </ScrollView>

        {copied ? (
          <View style={styles.toast}>
            <AppText style={styles.toastText}>Order ID copied</AppText>
          </View>
        ) : null}

        <Modal visible={Boolean(previewImage)} transparent animationType="fade" onRequestClose={closePreview}>
          <ZoomableImageModal
            imageUri={previewImage}
            onClose={closePreview}
            colors={colors}
            styles={styles}
          />
        </Modal>
      </ScreenContainer>
    </View>
  );
}

function SummaryRow({ styles, label, value }) {
  return (
    <View style={styles.summaryRow}>
      <AppText style={styles.summaryLabel}>{label}</AppText>
      {typeof value === 'string' || typeof value === 'number' ? (
        <AppText style={styles.summaryValue}>{value}</AppText>
      ) : (
        value
      )}
    </View>
  );
}

function formatDateTime(date) {
  try {
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    return '—';
  }
}

function formatTitleCase(value) {
  if (typeof value !== 'string') {
    return value || '—';
  }
  return value
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatFingerLabel(finger) {
  if (!finger) {
    return 'Finger';
  }
  const spaced = finger.replace(/([a-z])([A-Z])/g, '$1 $2');
  return formatTitleCase(spaced);
}

function resolveImageSource(upload) {
  if (!upload) {
    return null;
  }
  
  // Priority: Storage URL > uri > base64 (for backward compatibility)
  const storageUrl = upload.url || upload.storageUrl || null;
  const uri = upload.uri || null;
  const base64Data = upload.data || upload.base64 || upload.content || null;
  
  // If we have a Storage URL, use it
  if (storageUrl && !storageUrl.startsWith('data:')) {
    return storageUrl;
  }
  
  // If we have a URI (could be Storage URL or file URI), use it
  if (uri && !uri.startsWith('data:')) {
    return uri;
  }
  
  // Fallback to base64 for backward compatibility
  if (base64Data) {
    return `data:image/jpeg;base64,${base64Data}`;
  }
  
  // Legacy fallback for other formats
  const possible =
    upload.preview ||
    upload.thumbnail ||
    upload.source ||
    null;
    
  if (!possible || typeof possible !== 'string') {
    return null;
  }
  
  if (/^https?:|^file:|^data:/.test(possible)) {
    return possible;
  }
  
  return `data:image/jpeg;base64,${possible}`;
}

function extractSizePairs(sizes) {
  if (!sizes) {
    return [];
  }

  const pairs = [];

  if (Array.isArray(sizes.entries) && sizes.entries.length) {
    sizes.entries.forEach((entry, index) => {
      if (!entry) {
        return;
      }
      pairs.push({
        finger: formatFingerLabel(entry.finger || `Finger ${index + 1}`),
        value: typeof entry.value === 'string' || typeof entry.value === 'number' ? String(entry.value) : '',
      });
    });
    return pairs;
  }

  if (Array.isArray(sizes.values) && sizes.values.length) {
    sizes.values.forEach((value, index) => {
      pairs.push({
        finger: formatFingerLabel(FINGER_KEYS[index] || `Finger ${index + 1}`),
        value: typeof value === 'string' || typeof value === 'number' ? String(value) : '',
      });
    });
    return pairs;
  }

  if (sizes?.values && typeof sizes.values === 'object') {
    FINGER_KEYS.forEach((key) => {
      const value = sizes.values[key];
      if (value !== undefined && value !== null && value !== '') {
        pairs.push({ 
          finger: formatFingerLabel(key), 
          value: typeof value === 'string' || typeof value === 'number' ? String(value) : '' 
        });
      }
    });
    Object.entries(sizes.values)
      .filter(([key]) => !FINGER_KEYS.includes(key))
      .forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          pairs.push({ 
            finger: formatFingerLabel(key), 
            value: typeof value === 'string' || typeof value === 'number' ? String(value) : '' 
          });
        }
      });
    return pairs;
  }

  if (sizes.mode === 'perSet' && Array.isArray(sizes.details) && sizes.details.length) {
    sizes.details.forEach((detail, index) => {
      if (!detail) {
        return;
      }
      pairs.push({
        finger: formatFingerLabel(detail.finger || `Finger ${index + 1}`),
        value: typeof detail.value === 'string' || typeof detail.value === 'number' ? String(detail.value) : '',
      });
    });
    return pairs;
  }

  // Handle case where sizes is directly an object with finger keys (not nested under values)
  // This can happen if sizes is stored as {thumb: '7', index: '8', ...} instead of {mode: 'perSet', values: {...}}
  if (typeof sizes === 'object' && !Array.isArray(sizes) && sizes !== null) {
    // Check if it has finger keys directly (not nested)
    const hasFingerKeys = FINGER_KEYS.some((key) => key in sizes);
    if (hasFingerKeys && !sizes.mode && !sizes.values && !sizes.entries && !sizes.details) {
      FINGER_KEYS.forEach((key) => {
        const value = sizes[key];
        if (value !== undefined && value !== null && value !== '') {
          pairs.push({ finger: formatFingerLabel(key), value: String(value) });
        }
      });
      return pairs;
    }
  }

  return pairs;
}

/**
 * Get status pill colors based on order status
 * Updated to handle new status structure:
 * - Draft, Submitted, Approved & In Progress, Ready statuses, Completed, Cancelled
 */
function getStatusPillColors(status, colors) {
  const statusLower = (status || '').toLowerCase();
  // Use accent color for submitted and in-progress statuses, secondary for others
  const isActiveStatus = statusLower === 'submitted' || 
                         statusLower === 'approved & in progress' ||
                         statusLower === 'approved_in_progress' ||
                         statusLower.includes('ready');
  const tint = isActiveStatus ? colors.accent || '#6F171F' : colors.secondaryBackground || '#BF9B7A';
  return {
    backgroundColor: withOpacity(tint, 0.12),
    borderColor: withOpacity(tint, 0.3),
  };
}

function formatDeliveryWindow(value) {
  if (!value) {
    return 'Pending';
  }
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
    return value;
  } catch (error) {
    return value;
  }
  }
  
export default OrderDetailsScreen;