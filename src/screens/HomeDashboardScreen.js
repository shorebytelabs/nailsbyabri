import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import Icon from '../icons/Icon';
import { logEvent } from '../utils/analytics';

const CTA_VARIANTS = ['Create Set', 'Design', 'Make Magic'];

function HomeDashboardScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, handleStartOrder } = useAppState();

  const colors = theme?.colors || {};

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
      title: 'Prep your nails',
      copy: 'Cleanse with alcohol wipes before applying press-ons for longer wear.',
    },
    {
      id: 'tip2',
      title: 'Sizing cheat sheet',
      copy: 'Keep a note of your perfect size mix so reorders are a breeze.',
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
    const canProceed = handleStartOrder();
    if (canProceed) {
      logEvent('tap_home_create');
      navigation.navigate('NewOrderFlow');
    }
  };

  const handleSizingGuide = () => {
    logEvent('tap_home_sizing');
    navigation.navigate('Orders');
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.primaryBackground || '#F7F7FB' },
      ]}
    >
      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.secondaryBackground || '#E7D8CA' },
        ]}
      >
        <View style={styles.heroTextGroup}>
          <Text
            style={[
              styles.heroTitle,
              { color: colors.primaryFont || '#220707' },
            ]}
          >
            Create your custom set
          </Text>
          <Text
            style={[
              styles.heroSubtitle,
              { color: colors.secondaryFont || '#5C5F5D' },
            ]}
          >
            Pick your shape, finish, and sizing in minutes—save your style for next time.
          </Text>
          <TouchableOpacity
            style={[
              styles.heroButton,
              { backgroundColor: colors.accent || '#531C22' },
            ]}
            onPress={handleCreatePress}
            accessibilityLabel="Create new custom nail set"
          >
            <Text style={styles.heroButtonText}>{CTA_VARIANTS[0]}</Text>
          </TouchableOpacity>
          <View style={styles.variantRow}>
            {CTA_VARIANTS.map((variant) => (
              <View
                key={variant}
                style={[
                  styles.variantChip,
                  {
                    borderColor: colors.border || '#D9C8A9',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.variantLabel,
                    { color: colors.primaryFont || '#220707' },
                  ]}
                >
                  {variant}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View
          style={[
            styles.heroSwatches,
            { backgroundColor: colors.surface || '#FFFFFF' },
          ]}
        >
          <View
            style={[styles.swatchHeader, { borderColor: colors.border || '#D9C8A9' }]}
          >
            <Text
              style={[
                styles.swatchTitle,
                { color: colors.primaryFont || '#220707' },
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
                  backgroundColor: '#FCE9E3',
                  borderColor: colors.border || '#D9C8A9',
                },
              ]}
            />
            <View style={styles.swatchPaletteRow}>
              {['#F8D9DD', '#E5C7DA', '#D7B4C2'].map((tone) => (
                <View key={tone} style={[styles.swatchDot, { backgroundColor: tone }]} />
              ))}
            </View>
          </View>
          <Text
            style={[
              styles.swatchCaption,
              { color: colors.secondaryFont || '#5C5F5D' },
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
            { color: colors.primaryFont || '#220707' },
          ]}
        >
          Active orders
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
          <Text
            style={[
              styles.sectionAction,
              { color: colors.accent || '#531C22' },
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
          <View
            style={[
              styles.orderCard,
              {
                borderColor: colors.border || '#D9C8A9',
                backgroundColor: colors.surface || '#FFFFFF',
              },
            ]}
          >
            <Text
              style={[
                styles.orderName,
                { color: colors.primaryFont || '#220707' },
              ]}
            >
              No active orders
            </Text>
            <Text
              style={[
                styles.orderMeta,
                { color: colors.secondaryFont || '#5C5F5D' },
              ]}
            >
              Start your first custom set to track it here.
            </Text>
          </View>
        ) : (
          activeOrders.map((order) => (
            <View
              key={order.id}
              style={[
                styles.orderCard,
                {
                  borderColor: colors.border || '#D9C8A9',
                  backgroundColor: colors.surface || '#FFFFFF',
                },
              ]}
            >
              <Text
                style={[
                  styles.orderName,
                  { color: colors.primaryFont || '#220707' },
                ]}
              >
                {order.name}
              </Text>
              <View
                style={[
                  styles.statusChip,
                  {
                    backgroundColor:
                      order.status === 'submitted'
                        ? `${(colors.accent || '#531C22')}15`
                        : `${(colors.secondaryBackground || '#E7D8CA')}60`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: colors.accent || '#531C22' },
                  ]}
                >
                  {order.status || 'draft'}
                </Text>
              </View>
              <Text
                style={[
                  styles.orderMeta,
                  { color: colors.secondaryFont || '#5C5F5D' },
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
            { color: colors.primaryFont || '#220707' },
          ]}
        >
          Tips & inspiration
        </Text>
        <TouchableOpacity onPress={handleSizingGuide}>
          <Text
            style={[
              styles.sectionAction,
              { color: colors.accent || '#531C22' },
            ]}
          >
            Sizing guide
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tipsGrid}>
        {tips.map((tip) => (
          <View
            key={tip.id}
            style={[
              styles.tipCard,
              {
                backgroundColor: colors.surface || '#FFFFFF',
                borderColor: colors.border || '#D9C8A9',
              },
            ]}
          >
            <Text
              style={[
                styles.tipTitle,
                { color: colors.primaryFont || '#220707' },
              ]}
            >
              {tip.title}
            </Text>
            <Text
              style={[
                styles.tipCopy,
                { color: colors.secondaryFont || '#5C5F5D' },
              ]}
            >
              {tip.copy}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.primaryFont || '#220707' },
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
                backgroundColor: `${(colors.secondaryBackground || '#E7D8CA')}40`,
                borderColor: colors.border || '#D9C8A9',
              },
            ]}
          >
            <Icon name="orders" color={colors.accent || '#531C22'} size={18} />
            <Text
              style={[
                styles.notificationText,
                { color: colors.primaryFont || '#220707' },
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 24,
  },
  heroCard: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTextGroup: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 10,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  heroButton: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  variantChip: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  variantLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroSwatches: {
    width: 116,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 8,
    alignSelf: 'flex-start',
  },
  swatchHeader: {
    paddingBottom: 4,
    marginBottom: 2,
  },
  swatchTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  swatchChip: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatchPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatchNail: {
    width: 40,
    height: 66,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '-6deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  swatchPaletteRow: {
    flex: 1,
    flexDirection: 'column',
    gap: 5,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  swatchDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  swatchCaption: {
    fontSize: 10.5,
    lineHeight: 15,
  },
  swatchCard: {
    width: 94,
    height: 80,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: {
    fontWeight: '700',
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '600',
  },
  orderStrip: {
    gap: 12,
    paddingVertical: 4,
  },
  orderCard: {
    width: 200,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
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
    gap: 12,
  },
  tipCard: {
    flex: 1,
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
  notificationList: {
    gap: 10,
  },
  notificationCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
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

