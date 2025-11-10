import React, { useCallback, useMemo, useState } from 'react';
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
const SUPPORT_EMAIL = 'mailto:NailsByAbri@gmail.com';
const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

function OrderDetailsScreen({ navigation, route }) {
  const order = route.params?.order || null;
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [copied, setCopied] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const orderId = order?.id || '—';
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
    Alert.alert('Contact Support', 'Please email NailsByAbri@gmail.com for assistance.');
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

  const handleBackToConfirmation = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('OrderConfirmation', { order });
  }, [navigation, order]);

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
              onPress={handleBackToConfirmation}
              style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Back to order confirmation"
            >
              <Icon name="chevronRight" color={colors.accent} style={styles.backIcon} size={20} />
              <Text style={styles.backLinkLabel}>Back to Order Confirmation</Text>
            </Pressable>
            <Text style={styles.pageTitle}>Order #{orderId.slice(0, 8).toUpperCase()}</Text>
          </View>

          <View style={styles.cardsColumn}>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Order Summary</Text>
              </View>
              <Pressable
                onPress={handleCopyOrderId}
                style={({ pressed }) => [
                  styles.orderIdRow,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Copy order ID"
              >
                <View style={styles.orderIdTextGroup}>
                  <Text style={styles.orderIdLabel}>Order ID</Text>
                  <Text style={styles.orderIdValue}>{orderId}</Text>
                </View>
                <View style={styles.orderIdIconContainer}>
                  <Icon name="copy" color={colors.accent} />
                </View>
              </Pressable>
              <SummaryRow styles={styles} label="Placed on" value={orderTimestamp ? formatDateTime(orderTimestamp) : '—'} />
              <SummaryRow
                styles={styles}
                label="Status"
                value={
                  <View style={[styles.statusBadge, getStatusBadgeStyle(status, colors)]}>
                    <Text style={styles.statusBadgeText}>{status}</Text>
                  </View>
                }
              />
              <SummaryRow styles={styles} label="Total paid" value={totalPaid || '—'} />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Items Ordered</Text>
              </View>
              <View style={styles.itemsList}>
                {items.length ? (
                  items.map((item, index) => (
                    <View
                      key={item.id || `item-${index}`}
                      style={[styles.itemCard, index < items.length - 1 && styles.itemCardSpacing]}
                    >
                      <View style={styles.itemHeaderRow}>
                        <Text style={styles.itemName}>{item.name || `Set #${index + 1}`}</Text>
                        <Text style={styles.itemMetaRight}>
                          Qty {item.quantity || 1}
                          {item.unitPrice ? ` · ${formatCurrency(item.unitPrice)}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.itemSubtitle}>
                        Shape: {formatTitleCase(item.shapeName || item.shapeId || 'Custom')}
                      </Text>
                      {renderSizeDetails(item, styles)}
                      {item.description ? (
                        <Text style={styles.itemBodyCopy}>Description: {item.description}</Text>
                      ) : null}
                      {Boolean(item.requiresFollowUp || item.requestDesignHelp || item.designHelp) ? (
                        <Text style={styles.itemBodyCopy}>Requested design assistance: Yes</Text>
                      ) : null}
                      {item.designAssistanceNotes ? (
                        <Text style={styles.itemBodyCopy}>Design notes: {item.designAssistanceNotes}</Text>
                      ) : null}
                      {item.setNotes ? (
                        <Text style={styles.itemBodyCopy}>Notes: {item.setNotes}</Text>
                      ) : null}
                      {item.specialRequests ? (
                        <Text style={styles.itemBodyCopy}>Special request: {item.specialRequests}</Text>
                      ) : null}
                      {Array.isArray(item.designUploads) && item.designUploads.length ? (
                        <View style={styles.uploadsRow}>
                          {item.designUploads.map((upload, uploadIndex) => {
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
                                accessibilityLabel={`Preview upload ${uploadIndex + 1}`}
                              >
                                <Image
                                  source={{ uri: source }}
                                  style={styles.uploadImage}
                                />
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.placeholderText}>No items found for this order.</Text>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Delivery Details</Text>
              </View>
              <SummaryRow styles={styles} label="Delivery method" value={formatTitleCase(deliveryMethod)} />
              <SummaryRow
                styles={styles}
                label="Delivery timing"
                value={`${formatTitleCase(deliveryOptionLabel)} (${deliveryDays})`}
              />
              <SummaryRow
                styles={styles}
                label="Estimated delivery"
                value={deliveryTiming ? formatDeliveryWindow(deliveryTiming) : 'Pending'}
              />
              {hasAddress ? (
                <View style={styles.addressGroup}>
                  <Text style={styles.addressLabel}>Delivery address</Text>
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
              ) : null}
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
              <Icon name="mail" color={colors.accent} />
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

function summarizeSizes(sizes) {
  if (!sizes) {
    return 'Standard';
  }
  if (Array.isArray(sizes?.entries) && sizes.entries.length) {
    return sizes.entries
      .map((entry) => `${formatFingerLabel(entry?.finger || '')}:${entry?.value || '?'}`)
      .join(', ');
  }
  if (Array.isArray(sizes?.values) && sizes.values.length) {
    return sizes.values.join(', ');
  }
  if (sizes?.values && typeof sizes.values === 'object') {
    const pairs = FINGER_KEYS.filter((key) => sizes.values[key])
      .map((key) => `${formatFingerLabel(key)}:${sizes.values[key]}`);
    if (pairs.length) {
      return pairs.join(', ');
    }
    const dynamicPairs = Object.entries(sizes.values)
      .filter(([, value]) => Boolean(value))
      .map(([finger, value]) => `${formatFingerLabel(finger)}:${value}`);
    if (dynamicPairs.length) {
      return dynamicPairs.join(', ');
    }
  }
  if (typeof sizes?.mode === 'string') {
    return sizes.mode === 'perSet' ? 'Custom' : formatTitleCase(sizes.mode);
  }
  return 'Standard';
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

function getStatusBadgeStyle(status, colors) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('complete') || normalized.includes('delivered')) {
    return {
      backgroundColor: withOpacity(colors.success || '#4B7A57', 0.18),
      borderColor: withOpacity(colors.success || '#4B7A57', 0.4),
    };
  }
  if (normalized.includes('ship') || normalized.includes('out')) {
    return {
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.16),
      borderColor: withOpacity(colors.accent || '#6F171F', 0.35),
    };
  }
  return {
    backgroundColor: withOpacity(colors.warning || '#C27A3B', 0.16),
    borderColor: withOpacity(colors.warning || '#C27A3B', 0.35),
  };
}

function renderSizeDetails(item, styles) {
  const sizes = item?.sizes;
  if (!sizes) {
    return <Text style={styles.itemBodyCopy}>Sizes: Not provided</Text>;
  }

  const pairs = [];

  if (Array.isArray(sizes.entries) && sizes.entries.length) {
    sizes.entries.forEach((entry, index) => {
      if (!entry) {
        return;
      }
      pairs.push({
        finger: formatFingerLabel(entry.finger || `Finger ${index + 1}`),
        value: entry.value || '?',
      });
    });
  } else if (Array.isArray(sizes.values) && sizes.values.length) {
    sizes.values.forEach((value, index) => {
      pairs.push({
        finger: formatFingerLabel(`Finger ${index + 1}`),
        value: value || '?',
      });
    });
  } else if (sizes?.values && typeof sizes.values === 'object') {
    FINGER_KEYS.forEach((key) => {
      const value = sizes.values[key];
      if (value !== undefined && value !== null && value !== '') {
        pairs.push({
          finger: formatFingerLabel(key),
          value,
        });
      }
    });
    Object.entries(sizes.values)
      .filter(([key]) => !FINGER_KEYS.includes(key))
      .forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          pairs.push({ finger: formatFingerLabel(key), value });
        }
      });
  } else if (sizes.mode === 'perSet' && Array.isArray(sizes.details) && sizes.details.length) {
    sizes.details.forEach((detail, index) => {
      if (!detail) {
        return;
      }
      pairs.push({
        finger: formatFingerLabel(detail.finger || `Finger ${index + 1}`),
        value: detail.value || '?',
      });
    });
  }

  if (pairs.length) {
    return (
      <View style={styles.sizeSection}>
        <Text style={styles.sizeLabel}>Custom sizes</Text>
        <View style={styles.sizeChipRow}>
          {pairs.map((pair) => (
            <View key={`${pair.finger}-${pair.value}`} style={styles.sizeChip}>
              <Text style={styles.sizeChipText}>
                {pair.finger}: {pair.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (sizes.mode === 'standard') {
    return <Text style={styles.itemBodyCopy}>Sizes: Standard set</Text>;
  }

  return null;
}

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
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
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
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      backgroundColor: colors.surface || '#FFFFFF',
      padding: 16,
      gap: 8,
      ...cardShadow,
    },
    itemCardSpacing: {
      marginBottom: 4,
    },
    itemHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    itemName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
    },
    itemSubtitle: {
      fontSize: 13,
      color: colors.secondaryFont || '#767154',
    },
    itemBodyCopy: {
      fontSize: 13,
      color: colors.primaryFont || '#354037',
      lineHeight: 18,
    },
    itemMeta: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
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
    placeholderText: {
      fontSize: 13,
      color: colors.secondaryFont || '#767154',
    },
    addressGroup: {
      gap: 4,
    },
    addressLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseButton: {
      position: 'absolute',
      top: 40,
      right: 20,
      zIndex: 1,
    },
    modalImage: {
      width: '90%',
      height: '90%',
      borderRadius: 10,
    },
    sizeDetails: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider || '#E6DCD0',
    },
    sizeDetailsTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
      marginBottom: 8,
    },
    sizeEntriesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sizeEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    sizeEntryLabel: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
    },
    sizeEntryValue: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
    },
    sizeSection: {
      gap: 6,
    },
    sizeLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
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
  });
}

export default OrderDetailsScreen;

