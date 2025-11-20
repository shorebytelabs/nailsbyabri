import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
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
import { getEnabledTips } from '../services/tipsService';

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
      return <Text style={[styles.tipCopy, { color: colors.secondaryFont }]}>{description}</Text>;
    }

    return (
      <Text style={[styles.tipCopy, { color: colors.secondaryFont }]}>
        {description}
        {' '}
        <Text
          style={[styles.tipLink, { color: accentColor }]}
          onPress={() => handleOpenUrl(youtubeUrl)}
        >
          Watch this video
        </Text>
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
              <Text style={[styles.heroButtonText, { color: accentContrastColor }]}>
                {CTA_LABEL}
              </Text>
            </TouchableOpacity>
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
        {tipsLoading ? (
          <View style={styles.tipsLoadingContainer}>
            <Text style={[styles.tipsLoadingText, { color: colors.secondaryFont }]}>Loading tips...</Text>
          </View>
        ) : tips.length === 0 ? (
          <View style={styles.tipsEmptyContainer}>
            <Text style={[styles.tipsEmptyText, { color: colors.secondaryFont }]}>No tips available</Text>
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
                <Text
                  style={[
                    styles.tipTitle,
                    { color: colors.primaryFont },
                  ]}
                  numberOfLines={1}
                >
                  {tip.title}
                </Text>
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
  },
  heroTextGroup: {
    gap: 12,
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

