import React, { useMemo } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import Icon from '../icons/Icon';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';

const CTA_LABEL = 'Create Nail Set';

function HomeDashboardScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, handleStartOrder, ensureAuthenticated } = useAppState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const colors = theme?.colors || {};
  const horizontalPadding = Math.max(16, Math.min(28, width * 0.06));
  const isCompact = width < 780;
  const cardWidth = Math.min(240, width * 0.65);

  const accentColor = colors.accent || '#6F171F';
  const accentContrastColor = colors.accentContrast || '#FFFFFF';

  const activeOrders = useMemo(() => {
    const list = [];
    if (state.activeOrder) {
      list.push({
        id: state.activeOrder.id,
        name: state.activeOrder.nailSets?.[0]?.name || 'Draft Set',
        status: state.activeOrder.status || 'draft',
        submittedAt: state.activeOrder.updatedAt || state.activeOrder.createdAt,
      });
    }
    if (state.lastCompletedOrder && state.lastCompletedOrder.id !== state.activeOrder?.id) {
      list.push({
        id: state.lastCompletedOrder.id,
        name: state.lastCompletedOrder.nailSets?.[0]?.name || 'Recent Order',
        status: state.lastCompletedOrder.status || 'submitted',
        submittedAt:
          state.lastCompletedOrder.updatedAt || state.lastCompletedOrder.createdAt,
      });
    }
    return list.slice(0, 3);
  }, [state.activeOrder, state.lastCompletedOrder]);

  const tips = [
    {
      id: 'tip1',
      title: 'How to prep your nails',
      copy: 'Cleanse with alcohol wipes before applying press-ons for longer wear. Watch this video for a step-by-step guide: https://www.youtube.com/watch?v=example1',
    },
    {
      id: 'tip2',
      title: 'How to glue your nails',
      copy: 'Learn the best techniques for applying glue and securing your press-ons. Watch this video tutorial: https://www.youtube.com/watch?v=example2',
    },
  ];

  const notifications = useMemo(() => {
    if (activeOrders.length === 0) {
      return [
        {
          id: 'notify-empty',
          message: 'No shipments on the move yet. Create your first set to get started!',
        },
      ];
    }
    return [
      {
        id: 'notify-shipment',
        message: 'Local delivery slots fill quickly—schedule pickup or delivery at checkout.',
      },
      {
        id: 'notify-care',
        message: 'Remember to store your sets flat to keep their shape perfect.',
      },
    ];
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

  // Helper function to extract URL from tip copy text
  const extractUrlFromText = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  // Helper function to render tip copy with clickable links
  const renderTipCopy = (copy) => {
    const url = extractUrlFromText(copy);
    if (!url) {
      return <Text style={[styles.tipCopy, { color: colors.secondaryFont }]}>{copy}</Text>;
    }

    // Split text around the URL and render with a clickable link
    const parts = copy.split(url);
    const beforeUrl = parts[0];
    const afterUrl = parts.slice(1).join(url); // In case URL appears multiple times

    return (
      <Text style={[styles.tipCopy, { color: colors.secondaryFont }]}>
        {beforeUrl}
        <Text
          style={[styles.tipLink, { color: accentColor }]}
          onPress={() => handleOpenUrl(url)}
        >
          Watch this video
        </Text>
        {afterUrl}
      </Text>
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
              backgroundColor: colors.secondaryBackground,
              flexDirection: 'row',
              alignItems: 'flex-start',
              flexWrap: 'nowrap',
            },
          ]}
        >
          <View style={styles.heroTextGroup}>
            <Text
              style={[
                styles.heroTitle,
                { color: colors.primaryFont },
              ]}
            >
              Design Your Perfect Nails
            </Text>
            <Text
              style={[
                styles.heroSubtitle,
                { color: colors.secondaryFont },
              ]}
            >
              Pick your shape, design, and sizing in minutes
            </Text>
            <TouchableOpacity
              style={[
                styles.heroButton,
                { backgroundColor: accentColor },
              ]}
              onPress={handleCreatePress}
              accessibilityLabel="Create new custom nail set"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.heroButtonText, { color: accentContrastColor }]}>{CTA_LABEL}</Text>
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.heroSwatches,
              {
                backgroundColor: colors.surface,
                alignSelf: 'flex-start',
                flexBasis: isCompact ? 88 : 110,
                width: isCompact ? 88 : 110,
                marginLeft: 'auto',
                marginTop: isCompact ? 8 : 0,
              },
            ]}
          >
            <View style={[styles.swatchHeader, { borderColor: colors.divider }]}
            >
              <Text
                style={[
                  styles.swatchTitle,
                  { color: colors.primaryFont },
                ]}
              >
                Most-loved shape
              </Text>
            </View>
            <View style={styles.swatchPreviewRow}>
              <View
                style={[
                  styles.swatchNail,
                  {
                    backgroundColor: colors.swatchBase,
                    borderColor: colors.border,
                    shadowColor: colors.shadow,
                  },
                ]}
              />
              <View style={styles.swatchPaletteRow}>
                {[colors.swatchTone1, colors.swatchTone2, colors.swatchTone3]
                  .filter((tone) => tone) // Filter out undefined/null values
                  .map((tone, index) => (
                  <View
                    key={tone || `swatch-${index}`}
                    style={[
                      styles.swatchDot,
                      {
                        backgroundColor: tone,
                        borderColor: withOpacity(colors.shadow, 0.06),
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text
              style={[
                styles.swatchCaption,
                { color: colors.secondaryFont },
              ]}
              numberOfLines={2}
            >
              Almond silhouettes with blush gradients stay our client favorite.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.primaryFont },
            ]}
          >
            Active orders
          </Text>
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
            <Text
              style={[
                styles.sectionAction,
                { color: accentColor },
              ]}
            >
              View all
            </Text>
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
                <Text
                  style={[
                    styles.orderName,
                    { color: colors.primaryFont },
                  ]}
                >
                  No active orders
                </Text>
                <Text
                  style={[
                    styles.orderMeta,
                    { color: colors.secondaryFont },
                  ]}
                >
                  Start your first custom set to track it here.
                </Text>
              </View>
            ]
          ) : (
            activeOrders.map((order) => (
              <View
                key={order.id}
                style={[
                  styles.orderCard,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    width: cardWidth,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.orderName,
                    { color: colors.primaryFont },
                  ]}
                >
                  {order.name}
                </Text>
                <View
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor:
                        (order.status || '').toLowerCase() === 'submitted' ||
                        (order.status || '').toLowerCase() === 'approved & in progress' ||
                        (order.status || '').toLowerCase() === 'approved_in_progress' ||
                        (order.status || '').toLowerCase().includes('ready')
                          ? withOpacity(accentColor, 0.1)
                          : withOpacity(colors.secondaryBackground, 0.38),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: accentColor },
                    ]}
                  >
                    {order.status || 'Draft'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.orderMeta,
                    { color: colors.secondaryFont },
                  ]}
                >
                  Updated {order.submittedAt ? new Date(order.submittedAt).toLocaleDateString() : 'today'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.primaryFont },
            ]}
          >
            Tips
          </Text>
        </View>
        <View style={styles.tipsGrid}>
          {tips.map((tip) => (
            <View
              key={tip.id}
              style={[
                styles.tipCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  flexBasis: isCompact ? '100%' : '48%',
                },
              ]}
            >
              <Text
                style={[
                  styles.tipTitle,
                  { color: colors.primaryFont },
                ]}
              >
                {tip.title}
              </Text>
              {renderTipCopy(tip.copy)}
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.primaryFont },
            ]}
          >
            Notifications
          </Text>
        </View>
        <View style={styles.notificationList}>
          {notifications.map((note) => (
            <View
              key={note.id}
              style={[
                styles.notificationCard,
                {
                  backgroundColor: withOpacity(colors.secondaryBackground, 0.25),
                  borderColor: colors.border,
                },
              ]}
            >
              <Icon name="orders" color={accentColor} size={18} />
              <Text
                style={[
                  styles.notificationText,
                  { color: colors.primaryFont },
                ]}
              >
                {note.message}
              </Text>
            </View>
          ))}
        </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingTop: 10,
  },
  heroCard: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: 'flex-start',
    gap: 12,
  },
  heroTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroButton: {
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    alignSelf: 'flex-start',
    minHeight: 52,
    justifyContent: 'center',
  },
  heroButtonText: {
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.4,
  },
  heroSwatches: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  swatchHeader: {
    paddingBottom: 1,
    marginBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swatchTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  swatchPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  swatchNail: {
    width: 30,
    height: 45,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '-6deg' }],
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  swatchPaletteRow: {
    flex: 1,
    flexDirection: 'column',
    gap: 3,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  swatchDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatchCaption: {
    fontSize: 10,
    lineHeight: 14,
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
    gap: 10,
  },
  orderName: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  orderMeta: {
    fontSize: 12,
  },
  tipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tipCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  tipCopy: {
    fontSize: 13,
    lineHeight: 18,
  },
  tipLink: {
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  notificationList: {
    gap: 10,
  },
  notificationCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  notificationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default HomeDashboardScreen;

