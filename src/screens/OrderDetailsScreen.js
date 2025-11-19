import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { formatCurrency } from '../utils/pricing';
import { withOpacity } from '../utils/color';

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
      backgroundColor: colors.surfaceMuted || withOpacity(colors.accent || '#6F171F', 0.06),
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
  });
}

function OrderDetailsScreen({ navigation, route }) {
  const initialOrder = route.params?.order || null;
  const fromOrders = Boolean(route.params?.fromOrders);
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [order, setOrder] = useState(initialOrder);
  const [loadingOrder, setLoadingOrder] = useState(false);
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
  const totalPaid = order?.pricing ? formatCurrency(order.pricing.total) : formatCurrency(order?.total);
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
              index: 2,
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
            <Text style={styles.emptyTitle}>Order not found</Text>
            <Text style={styles.emptySubtitle}>
              We couldn’t load the order details. Return to your profile or contact support for help.
            </Text>
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
              <Text style={styles.backLinkLabel}>
                {fromOrders ? 'Back to Orders' : 'Back to Order Confirmation'}
              </Text>
            </Pressable>
            <Text style={styles.pageTitle}>Order #{displayOrderId}</Text>
          </View>

          <View style={styles.cardsColumn}>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Order Summary</Text>
              </View>

              <View style={styles.summaryOrderIdContainer}>
                <Text style={styles.summaryOrderIdLabel}>Order ID</Text>
                <View style={styles.summaryOrderIdRow}>
                  <Text style={styles.summaryOrderIdValue}>{displayOrderId}</Text>
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
                    <Text style={styles.summaryCopyLabel}>Copy</Text>
                  </Pressable>
                </View>
                <Text style={styles.summaryOrderIdSubtitle}>Order ID: {orderId}</Text>
              </View>

              <View style={styles.summarySection}>
                <View style={styles.summaryRowCompact}>
                  <Text style={styles.summaryLabelCompact}>Placed on</Text>
                  <Text style={styles.summaryValueCompact}>
                    {orderTimestamp ? formatDateTime(orderTimestamp) : '—'}
                  </Text>
                </View>
                <View style={styles.summaryRowCompact}>
                  <Text style={styles.summaryLabelCompact}>Status</Text>
                  <View
                    style={[styles.statusBadge, getStatusPillColors(status, colors)]}
                  >
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                </View>
                <View style={styles.summaryRowCompact}>
                  <Text style={styles.summaryLabelCompact}>Total paid</Text>
                  <Text style={styles.summaryValueCompact}>{totalPaid || '—'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Items Ordered</Text>
              </View>
              <View style={styles.itemsList}>
                {items.length ? (
                  items.map((item, index) => {
                    const sizePairs = extractSizePairs(item.sizes);
                    const designRequested = Boolean(
                      item.requiresFollowUp || item.requestDesignHelp || item.designHelp,
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
                            <Text style={styles.itemHeading}>Nail Set #{index + 1}</Text>
                            <Text style={styles.itemSubHeading}>
                              {item.name ? item.name : formatTitleCase(item.shapeName || item.shapeId || 'Custom')}
                            </Text>
                            <Text style={styles.itemMetaLine}>
                              Shape: {formatTitleCase(item.shapeName || item.shapeId || 'Custom')}
                            </Text>
                          </View>
                          {item.unitPrice ? (
                            <View style={styles.itemQuantityPill}>
                              <Text style={styles.itemQuantityValue}>{formatCurrency(item.unitPrice)}</Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.itemSection}>
                          <Text style={styles.sectionLabel}>Custom Sizes</Text>
                          {sizePairs.length ? (
                            <View style={styles.sizeChipRow}>
                              {sizePairs.map((pair) => (
                                <View key={`${pair.finger}-${pair.value}`} style={styles.sizeChip}>
                                  <Text style={styles.sizeChipText}>
                                    {pair.finger}: {pair.value || '?'}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.secondaryText}>Standard set</Text>
                          )}
                        </View>

                        <View style={styles.itemSection}>
                          <Text style={styles.sectionLabel}>Design Assistance</Text>
                          <Text style={styles.itemBodyCopy}>{designRequested ? 'Yes' : 'No'}</Text>
                          {item.designAssistanceNotes ? (
                            <Text style={styles.secondaryText}>{item.designAssistanceNotes}</Text>
                          ) : null}
                        </View>

                        {item.description ? (
                          <View style={styles.itemSection}>
                            <Text style={styles.sectionLabel}>Description</Text>
                            <Text style={styles.itemBodyCopy}>{item.description}</Text>
                          </View>
                        ) : null}

                        {item.setNotes ? (
                          <View style={styles.itemSection}>
                            <Text style={styles.sectionLabel}>Notes</Text>
                            <Text style={styles.itemBodyCopy}>{item.setNotes}</Text>
                          </View>
                        ) : null}

                        {item.specialRequests ? (
                          <View style={styles.itemSection}>
                            <Text style={styles.sectionLabel}>Special Requests</Text>
                            <Text style={styles.itemBodyCopy}>{item.specialRequests}</Text>
                          </View>
                        ) : null}

                        <View style={styles.itemSection}>
                          <Text style={styles.sectionLabel}>Design Images</Text>
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
                            <Text style={styles.secondaryText}>No design images provided.</Text>
                          )}
                        </View>

                        <View style={styles.itemSection}>
                          <Text style={styles.sectionLabel}>Sizing Images</Text>
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
                              <Text style={styles.secondaryText}>No sizing images provided.</Text>
                            );
                          })()}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.placeholderText}>No items found for this order.</Text>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Delivery Details</Text>
              </View>
              <View style={styles.itemSection}>
                <Text style={styles.inlineLabelText}>
                  Estimated ready date:{' '}
                  <Text style={styles.inlineValueText}>
                    {order?.pricing?.estimatedCompletionDate
                      ? formatDeliveryWindow(order.pricing.estimatedCompletionDate)
                      : deliveryTiming
                      ? formatDeliveryWindow(deliveryTiming)
                      : 'Pending'}
                  </Text>
                </Text>
              </View>
              <View style={styles.itemSection}>
                <Text style={styles.sectionLabel}>Delivery Method</Text>
                <Text style={styles.itemBodyCopy}>{formatTitleCase(deliveryMethod)}</Text>
              </View>
              <View style={styles.itemSection}>
                <Text style={styles.sectionLabel}>Delivery Timing</Text>
                <Text style={styles.itemBodyCopy}>{`${formatTitleCase(deliveryOptionLabel)} (${deliveryDays})`}</Text>
              </View>
              {hasAddress ? (
                <View style={styles.itemSection}>
                  <Text style={styles.sectionLabel}>Delivery Address</Text>
                  <View style={styles.addressGroup}>
                    <Text style={styles.addressLine}>{fulfillment.address?.name}</Text>
                    <Text style={styles.addressLine}>{fulfillment.address?.line1}</Text>
                    {fulfillment.address?.line2 ? (
                      <Text style={styles.addressLine}>{fulfillment.address.line2}</Text>
                    ) : null}
                    <Text style={styles.addressLine}>
                      {[fulfillment.address?.city, fulfillment.address?.state, fulfillment.address?.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Price Breakdown</Text>
              </View>
              {Array.isArray(order?.pricing?.lineItems) && order.pricing.lineItems.length ? (
                order.pricing.lineItems.map((item) => (
                  <SummaryRow
                    key={item.id}
                    styles={styles}
                    label={item.label}
                    value={formatCurrency(item.amount)}
                  />
                ))
              ) : (
                <Text style={styles.secondaryText}>Pricing details unavailable.</Text>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(order?.pricing?.total)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Next Steps</Text>
            <Text style={styles.bodyText}>
              Need help or an update? Reach out anytime and we’ll get back to you.
            </Text>
            <Pressable
              onPress={handleContactSupport}
              style={({ pressed }) => [styles.secondaryAction, { opacity: pressed ? 0.8 : 1 }]}
              accessibilityRole="button"
            >
              <View style={styles.secondaryActionIcon}>
                <Icon name="mail" color={colors.accent} size={18} />
              </View>
              <Text style={styles.secondaryActionLabel}>Contact Support</Text>
            </Pressable>
          </View>
        </ScrollView>

        {copied ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>Order ID copied</Text>
          </View>
        ) : null}

        <Modal visible={Boolean(previewImage)} transparent animationType="fade" onRequestClose={closePreview}>
          <View style={styles.previewBackdrop}>
            <Pressable style={styles.previewBackdropOverlay} onPress={closePreview} accessibilityRole="button" />
            {previewImage ? (
              <Image source={{ uri: previewImage }} style={styles.previewImage} />
            ) : null}
            <Pressable style={styles.previewCloseButton} onPress={closePreview} accessibilityRole="button">
              <Text style={styles.previewCloseLabel}>Close</Text>
            </Pressable>
          </View>
        </Modal>
      </ScreenContainer>
    </View>
  );
}

function SummaryRow({ styles, label, value }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={styles.summaryValue}>{value}</Text>
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
  const possible =
    upload.uri ||
    upload.url ||
    upload.preview ||
    upload.data ||
    upload.base64 ||
    upload.content ||
    null;
  if (!possible || typeof possible !== 'string') {
    return null;
  }
  if (/^https?:|^file:|^data:/.test(possible)) {
    return possible;
  }
  if (possible.startsWith('data:')) {
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