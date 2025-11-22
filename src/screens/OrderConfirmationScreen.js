import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import {
  formatCurrency,
  getShapeCatalog,
  pricingConstants,
} from '../utils/pricing';
import { withOpacity } from '../utils/color';
import VenmoPaymentInfo from '../components/VenmoPaymentInfo';

const shapeCatalog = getShapeCatalog();
const deliveryMethodConfig = pricingConstants.DELIVERY_METHODS;
const SUPPORT_EMAIL = 'mailto:NailsByAbriannaC@gmail.com';
const LOGO_SOURCE = require('../../assets/images/NailsByAbriLogo.png');

function OrderConfirmationScreen({ order, onDone, onViewOrder }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const styles = useMemo(() => createStyles(colors, isWide), [colors, isWide]);

  const methodConfig =
    deliveryMethodConfig[order?.fulfillment?.method] || deliveryMethodConfig.pickup;
  const speedConfig =
    methodConfig.speedOptions[order?.fulfillment?.speed] ||
    methodConfig.speedOptions[methodConfig.defaultSpeed];
  const estimatedDate = order?.estimatedFulfillmentDate
    ? new Date(order.estimatedFulfillmentDate).toLocaleDateString()
    : null;

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timeout = setTimeout(() => setCopied(false), 2800);
    return () => clearTimeout(timeout);
  }, [copied]);

  const orderId = order?.id || '';
  const displayOrderId = orderId ? orderId.slice(0, 8).toUpperCase() : '—';
  const orderItem =
    order?.nailSets?.[0]?.name || shapeCatalog[0]?.name || 'Custom Nail Set';
  const fulfillmentMethod = methodConfig.label;
  const totalPaid = order?.pricing ? formatCurrency(order.pricing.total) : '—';
  const contactEmail =
    order?.contactEmail ||
    order?.customerEmail ||
    order?.email ||
    order?.userEmail ||
    'your email';

  const summaryRows = useMemo(
    () => [
      { label: 'Order Item', value: orderItem },
      { label: 'Delivery Method', value: fulfillmentMethod },
      { label: 'Delivery Timing', value: speedConfig?.description || '—' },
      { label: 'Total Paid', value: totalPaid },
    ],
    [orderItem, totalPaid, fulfillmentMethod, speedConfig?.description],
  );

  const handleCopyOrderId = useCallback(async () => {
    if (!orderId) {
      return;
    }

    try {
      if (typeof Clipboard?.setString === 'function') {
        Clipboard.setString(orderId);
      } else if (
        typeof navigator !== 'undefined' &&
        navigator?.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(orderId);
      }
    } catch (error) {
      // Clipboard might not be available; continue silently.
    }
    setCopied(true);
  }, [orderId]);

  const handleViewOrder = useCallback(() => {
    if (typeof onViewOrder === 'function') {
      onViewOrder(order);
    }
  }, [onViewOrder, order]);

  const handleBackToProfile = useCallback(() => {
    if (typeof onDone === 'function') {
      onDone(order);
    }
  }, [onDone, order]);

  const handleContactSupport = useCallback(() => {
    Alert.alert('Contact Support', 'Please email NailsByAbriannaC@gmail.com for assistance.');
  }, []);

  if (!order) {
    return (
      <ScreenContainer>
        <View style={styles.page}>
          <ConfirmationHeader
            styles={styles}
            colors={colors}
            title="Order Confirmed"
            message="We could not find the order details, but your confirmation is complete."
          />
          <View style={styles.card}>
            <Text style={styles.bodyText}>
              Return to your profile to review recent orders or contact support if you need help.
            </Text>
          </View>
          <PrimaryButton label="Back to Home" onPress={handleBackToProfile} />
        </View>
      </ScreenContainer>
    );
  }

  const backgroundColor = colors.primaryBackground || '#F4EBE3';

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[
          styles.brandHeaderSafe,
          {
            backgroundColor,
            borderBottomColor: withOpacity(colors.shadow || '#000000', 0.08),
          },
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

      <ScreenContainer>
        <View style={styles.page}>
        <ConfirmationHeader
          styles={styles}
          colors={colors}
          title="Order Confirmed"
          message="Thank you! We've started crafting your custom set."
          timeline={
            estimatedDate
              ? `Ready by ${estimatedDate}`
              : `Ready in ${speedConfig?.description || '10 to 14 days'}`
          }
        />

        {/* Venmo Payment Info - Prominent section right after confirmation */}
        <VenmoPaymentInfo
          totalAmount={order?.pricing?.total || order?.total}
          orderNumber={orderId || displayOrderId}
          showQRCode={true}
          compact={false}
        />

        <View style={styles.sectionRow}>
          <View style={styles.sectionColumn}>
            <OrderSummaryCard
              styles={styles}
              colors={colors}
              orderId={orderId}
              displayOrderId={displayOrderId}
              summaryRows={summaryRows}
              onCopy={handleCopyOrderId}
            />
            <NextStepsCard
              styles={styles}
              colors={colors}
              email={contactEmail}
              timeline={
                estimatedDate
                  ? `Your set will be ready by ${estimatedDate}`
                  : `Estimated turnaround: ${speedConfig?.description || '10 to 14 days'}`
              }
              onContactSupport={handleContactSupport}
              onViewOrder={handleViewOrder}
            />
          </View>
        </View>

        <View
          style={[
            styles.ctaRow,
            isWide && styles.ctaRowWide,
          ]}
        >
          <PrimaryButton
            label="View Order"
            onPress={handleViewOrder}
            style={styles.ctaPrimaryButton}
            testID="view-order-cta"
            accessibilityHint="Opens the order details screen"
          />
          <Pressable
            onPress={handleBackToProfile}
            style={({ pressed }) => [
              styles.secondaryButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            testID="back-to-home-cta"
          >
            <Text style={styles.secondaryButtonLabel}>Back to Home</Text>
          </Pressable>
        </View>

          {copied ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>Order ID copied</Text>
            </View>
          ) : null}
        </View>
      </ScreenContainer>
    </View>
  );
}

function ConfirmationHeader({ styles, colors, title, message, timeline }) {
  return (
    <View style={styles.headerCard}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Icon name="checkCircle" color={colors.success || '#4B7A57'} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{title}</Text>
          {timeline ? <Text style={styles.headerTimeline}>{timeline}</Text> : null}
        </View>
      </View>
      <Text style={styles.headerSubtitle}>{message}</Text>
    </View>
  );
}

function OrderSummaryCard({
  styles,
  colors,
  orderId,
  displayOrderId,
  summaryRows,
  onCopy,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Order Summary</Text>
      </View>

      <View style={styles.orderIdContainer}>
        <Text style={styles.orderIdLabel}>Order ID</Text>
        <View style={styles.orderIdValueRow}>
          <Text style={styles.orderIdValue}>{displayOrderId}</Text>
          <Pressable
            onPress={onCopy}
            style={({ pressed }) => [
              styles.copyButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Copy order ID"
            testID="order-copy-action"
          >
            <Icon name="copy" color={colors.accent} size={18} />
            <Text style={styles.copyLabel}>Copy</Text>
          </Pressable>
        </View>
        {orderId ? (
          <Text style={styles.orderIdSubtitle}>Order ID: {orderId}</Text>
        ) : null}
      </View>

      <View style={styles.summaryGrid}>
        {summaryRows.map((row) => (
          <View key={row.label} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{row.label}</Text>
            <Text style={styles.summaryValue}>{row.value || '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function NextStepsCard({
  styles,
  colors,
  email,
  timeline,
  onContactSupport,
  onViewOrder,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Next Steps & Support</Text>
      </View>
      <Text style={styles.bodyText}>
        Email confirmation sent to <Text style={styles.emphasis}>{email}</Text>.
      </Text>
      <Text style={styles.timelineHighlight}>{timeline}</Text>
      <View style={styles.supportList}>
        <Pressable
          onPress={onViewOrder}
          style={({ pressed }) => [
            styles.supportRow,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="View order details"
        >
          <View style={styles.supportIcon}>
            <Icon name="info" color={colors.accent} size={18} />
          </View>
          <Text style={styles.supportLabel}>View order details</Text>
          <Icon name="chevronRight" color={colors.secondaryFont} size={18} />
        </Pressable>
        <Pressable
          onPress={onContactSupport}
          style={({ pressed }) => [
            styles.supportRow,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Contact support via email"
        >
          <View style={styles.supportIcon}>
            <Icon name="mail" color={colors.accent} size={18} />
          </View>
          <Text style={styles.supportLabel}>Contact support</Text>
          <Icon name="chevronRight" color={colors.secondaryFont} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors, isWide) {
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
    page: {
      flex: 1,
      gap: 20,
      paddingBottom: 32,
      position: 'relative',
    },
    headerCard: {
      borderRadius: 20,
      backgroundColor: colors.surface || '#FFFFFF',
      padding: 20,
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      ...cardShadow,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    headerIcon: {
      height: 40,
      width: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withOpacity(colors.success || '#4B7A57', 0.12),
    },
    headerContent: {
      flex: 1,
      gap: 2,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.accent || '#6F171F',
    },
    headerTimeline: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.secondaryFont || '#767154',
      lineHeight: 20,
    },
    sectionRow: {
      flexDirection: isWide ? 'row' : 'column',
      gap: isWide ? 20 : 16,
    },
    sectionColumn: {
      flex: 1,
      gap: 16,
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
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
    },
    orderIdContainer: {
      borderRadius: 16,
      padding: 16,
      gap: 8,
      backgroundColor: withOpacity(colors.surface, 0.6),//colors.surfaceMuted || withOpacity(colors.accent || '#6F171F', 0.06),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
    },
    orderIdLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.secondaryFont || '#767154',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    orderIdValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    orderIdValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.primaryFont || '#354037',
    },
    copyButton: {
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
    copyLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent || '#6F171F',
    },
    orderIdSubtitle: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
    },
    summaryGrid: {
      gap: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    },
    summaryLabel: {
      flex: 1,
      fontSize: 13,
      color: colors.secondaryFont || '#767154',
    },
    summaryValue: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryFont || '#354037',
      textAlign: 'right',
    },
    bodyText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.secondaryFont || '#767154',
    },
    supportList: {
      marginTop: 20,
      gap: 12,
    },
    supportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    supportIcon: {
      height: 28,
      width: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.1),
    },
    supportLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.primaryFont || '#354037',
      fontWeight: '500',
    },
    ctaRow: {
      marginTop: 8,
      gap: 12,
    },
    ctaRowWide: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    ctaPrimaryButton: {
      flex: isWide ? 1 : 0,
    },
    secondaryButton: {
      flex: isWide ? 1 : 0,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface || '#FFFFFF',
      ...cardShadow,
    },
    secondaryButtonLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
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
  });
}

export default OrderConfirmationScreen;

