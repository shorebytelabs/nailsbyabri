/**
 * Venmo Payment Info Component
 * Displays Venmo payment details including handle, QR code, amount, and instructions
 */

import React, { useCallback } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { formatCurrency } from '../utils/pricing';
import { withOpacity } from '../utils/color';
import Icon from '../icons/Icon';
import AppText from './AppText';

const VENMO_HANDLE = '@Arlene-AldayChheng';
const VENMO_URL = 'https://venmo.com/u/Arlene-AldayChheng';

// Venmo QR Code Image
// Try to load the QR code image (supports both .png and .jpg extensions)
let VENMO_QR_CODE = null;
try {
  // Try PNG first - path is relative to this component file location
  VENMO_QR_CODE = require('../../assets/images/venmo-qr.png');
  console.log('[VenmoPaymentInfo] Successfully loaded QR code image');
} catch (e) {
  console.log('[VenmoPaymentInfo] Failed to load PNG, trying JPG:', e.message);
  try {
    // Try JPG/JPEG as fallback
    VENMO_QR_CODE = require('../../assets/images/venmo-qr.jpg');
    console.log('[VenmoPaymentInfo] Successfully loaded QR code image (JPG)');
  } catch (e2) {
    // Image not found - will show placeholder
    console.log('[VenmoPaymentInfo] QR code image not found. Error:', e2.message);
    console.log('[VenmoPaymentInfo] Please add venmo-qr.png to assets/images/ and restart Metro with --reset-cache');
  }
}

function VenmoPaymentInfo({
  totalAmount,
  orderNumber,
  showQRCode = true,
  compact = false,
  showPaymentNeeded = false,
}) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const styles = createStyles(colors, compact);

  const handleOpenVenmo = useCallback(async () => {
    try {
      const canOpen = await Linking.canOpenURL(VENMO_URL);
      if (canOpen) {
        await Linking.openURL(VENMO_URL);
      } else {
        // Fallback: try to open Venmo app
        await Linking.openURL('venmo://');
      }
    } catch (error) {
      console.error('[VenmoPaymentInfo] Error opening Venmo:', error);
    }
  }, []);

  const handleCopyVenmoHandle = useCallback(() => {
    const Clipboard = require('@react-native-clipboard/clipboard').default;
    Clipboard.setString(VENMO_HANDLE);
  }, []);

  return (
    <View style={styles.container}>
      {showPaymentNeeded && (
        <View style={styles.paymentNeededBanner}>
          <Icon name="info" color={colors.warning || '#FF9800'} size={16} />
          <AppText variant="ui" style={styles.paymentNeededText}>Payment Needed</AppText>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="ui" style={styles.title}>Pay with Venmo</AppText>
        </View>

        {totalAmount && (
          <View style={styles.amountRow}>
            <AppText variant="ui" style={styles.amountLabel}>Total Amount:</AppText>
            <AppText variant="ui" style={styles.amountValue}>{formatCurrency(totalAmount)}</AppText>
          </View>
        )}

        <View style={styles.venmoHandleRow}>
          <AppText variant="ui" style={styles.venmoLabel}>Venmo Handle:</AppText>
          <Pressable
            onPress={handleCopyVenmoHandle}
            style={({ pressed }) => [
              styles.venmoHandleButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <AppText variant="ui" style={styles.venmoHandle}>{VENMO_HANDLE}</AppText>
            <Icon name="copy" color={colors.accent} size={14} />
          </Pressable>
        </View>

        {showQRCode && (
          <View style={styles.qrCodeContainer}>
            {VENMO_QR_CODE ? (
              <>
                <Image
                  source={VENMO_QR_CODE}
                  style={styles.qrCode}
                  resizeMode="contain"
                  accessibilityLabel="Venmo QR code for payment"
                  onError={(error) => {
                    console.error('[VenmoPaymentInfo] Error loading QR code image:', error);
                  }}
                />
                <AppText variant="small" style={styles.qrCodeHint}>Scan to pay</AppText>
              </>
            ) : (
              <View style={styles.qrCodePlaceholder}>
                <Icon name="image" color={colors.secondaryFont} size={32} />
                <AppText variant="small" style={styles.qrCodePlaceholderText}>
                  QR code image not found.{'\n'}Add venmo-qr.png to assets/images/{'\n'}Then restart Metro bundler
                </AppText>
              </View>
            )}
          </View>
        )}

        <View style={styles.instructionsContainer}>
          <AppText style={styles.instructionsText}>
            {orderNumber
              ? `Please include your order number "${orderNumber}" in the Venmo note when sending payment.`
              : 'Please include your order number in the Venmo note when sending payment.'}
          </AppText>
        </View>

        <Pressable
          onPress={handleOpenVenmo}
          style={({ pressed }) => [
            styles.venmoButton,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <AppText variant="ui" style={styles.venmoButtonText}>Open Venmo</AppText>
          <Icon name="chevronRight" color={colors.accentContrast || '#FFFFFF'} size={16} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors, compact) {
  const cardShadow = {
    shadowColor: colors.shadow || '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  };

  return StyleSheet.create({
    container: {
      gap: compact ? 12 : 16,
    },
    paymentNeededBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: withOpacity(colors.warning || '#FF9800', 0.1),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withOpacity(colors.warning || '#FF9800', 0.3),
    },
    paymentNeededText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.warning || '#FF9800',
    },
    content: {
      borderRadius: 20,
      padding: compact ? 16 : 20,
      gap: compact ? 12 : 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      backgroundColor: colors.surface || '#FFFFFF',
      ...cardShadow,
    },
    header: {
      marginBottom: compact ? 4 : 8,
    },
    title: {
      fontSize: compact ? 16 : 18,
      fontWeight: '700',
      color: colors.primaryFont || '#354037',
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.06),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withOpacity(colors.accent || '#6F171F', 0.2),
    },
    amountLabel: {
      fontSize: 14,
      color: colors.secondaryFont || '#767154',
      fontWeight: '500',
    },
    amountValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.accent || '#6F171F',
    },
    venmoHandleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    venmoLabel: {
      fontSize: 14,
      color: colors.secondaryFont || '#767154',
    },
    venmoHandleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.08),
    },
    venmoHandle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.accent || '#6F171F',
    },
    qrCodeContainer: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    qrCode: {
      width: compact ? 160 : 200,
      height: compact ? 160 : 200,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
    },
    qrCodeHint: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
      fontStyle: 'italic',
    },
    qrCodePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: withOpacity(colors.secondaryBackground || '#E7D8CA', 0.3),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider || '#E6DCD0',
      borderStyle: 'dashed',
      gap: 8,
    },
    qrCodePlaceholderText: {
      fontSize: 12,
      color: colors.secondaryFont || '#767154',
      textAlign: 'center',
    },
    instructionsContainer: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: withOpacity(colors.accent || '#6F171F', 0.05),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withOpacity(colors.accent || '#6F171F', 0.15),
    },
    instructionsText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.primaryFont || '#354037',
      textAlign: 'center',
    },
    venmoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.accent || '#6F171F',
    },
    venmoButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.accentContrast || '#FFFFFF',
    },
  });
}

export default VenmoPaymentInfo;

