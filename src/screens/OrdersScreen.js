import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';

function OrdersScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, refreshConsentLogs, setState } = useAppState();
  const colors = theme?.colors || {};
  const {
    primaryBackground,
    secondaryBackground,
    surface,
    primaryFont,
    secondaryFont,
    accent,
    border,
  } = colors;
  const accentColor = accent || '#6F171F';
  const secondaryBackgroundColor = secondaryBackground || '#BF9B7A';
  const primaryBackgroundColor = primaryBackground || '#F4EBE3';
  const surfaceColor = surface || '#FFFFFF';
  const primaryFontColor = primaryFont || '#220707';
  const secondaryFontColor = secondaryFont || '#5C5F5D';
  const borderColor = border || '#D9C8A9';

  const draftOrders = useMemo(() => {
    if (state.activeOrder?.status === 'draft') {
      return [state.activeOrder];
    }
    return [];
  }, [state.activeOrder]);

  const submittedOrders = useMemo(() => {
    const map = new Map();
    const addOrder = (order) => {
      if (!order || order.status !== 'submitted') {
        return;
      }
      if (!map.has(order.id)) {
        map.set(order.id, order);
      }
    };

    addOrder(state.activeOrder);
    addOrder(state.lastCompletedOrder);

    return Array.from(map.values());
  }, [state.activeOrder, state.lastCompletedOrder]);

  const completedOrders = useMemo(() => {
    const map = new Map();
    const addOrder = (order) => {
      if (!order || order.status !== 'completed') {
        return;
      }
      if (!map.has(order.id)) {
        map.set(order.id, order);
      }
    };

    addOrder(state.activeOrder);
    addOrder(state.lastCompletedOrder);

    return Array.from(map.values());
  }, [state.activeOrder, state.lastCompletedOrder]);

  const allOrders = useMemo(() => {
    const map = new Map();
    const addOrder = (order) => {
      if (!order) {
        return;
      }
      if (!map.has(order.id)) {
        map.set(order.id, order);
      }
    };

    addOrder(state.activeOrder);
    addOrder(state.lastCompletedOrder);

    const items = Array.from(map.values());

    return items.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [state.activeOrder, state.lastCompletedOrder]);

  const [activeTab, setActiveTab] = useState('drafts');

  const tabs = useMemo(
    () => [
      { key: 'drafts', label: 'Drafts', count: draftOrders.length },
      { key: 'submitted', label: 'Submitted', count: submittedOrders.length },
      { key: 'completed', label: 'Delivered', count: completedOrders.length },
      { key: 'all', label: 'All', count: allOrders.length },
    ],
    [draftOrders.length, submittedOrders.length, completedOrders.length, allOrders.length],
  );

  const visibleOrders = useMemo(() => {
    switch (activeTab) {
      case 'submitted':
        return submittedOrders;
      case 'completed':
        return completedOrders;
      case 'all':
        return allOrders;
      case 'drafts':
      default:
        return draftOrders;
    }
  }, [activeTab, draftOrders, submittedOrders, completedOrders, allOrders]);

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
    (order) => {
      if (!order) {
        return;
      }

      logEvent('tap_order_view', { orderId: order.id, status: order.status });

      if (order.status === 'draft') {
        setState((prev) => ({
          ...prev,
          activeOrder: order,
        }));
        navigateToRoot('NewOrderFlow', { resume: true });
        return;
      }

      navigateToRoot('OrderDetails', { order, fromOrders: true });
    },
    [navigateToRoot, setState],
  );

  const renderOrderCard = (order) => {
    const primarySet = order.nailSets?.[0];
    const needsFollowUp = order.nailSets?.some((set) => set.requiresFollowUp);
    const statusLabel =
      order.status === 'draft'
        ? 'Draft'
        : order.status === 'completed'
        ? 'Delivered'
        : 'Submitted';
    const statusBackground =
      order.status === 'draft'
        ? withOpacity(secondaryBackgroundColor, 0.2)
        : withOpacity(accentColor, 0.12);

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
          <Text
            style={[
              styles.cardTitle,
              { color: primaryFontColor },
            ]}
          >
            {primarySet?.name || 'Custom Set'}
          </Text>
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
                { color: accentColor },
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
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
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: primaryBackgroundColor },
      ]}
      refreshControl={
        <RefreshControl
          tintColor={accentColor}
          refreshing={state.loadingConsentLogs}
          onRefresh={() => {
            if (state.currentUser) {
              refreshConsentLogs(state.currentUser.id);
            }
          }}
        />
      }
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

      <View style={styles.sectionContent}>
        {visibleOrders.length ? (
          visibleOrders.map(renderOrderCard)
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
                : `No ${activeTab === 'all' ? 'orders' : activeTab} yet`}
            </Text>
            <Text
              style={[
                styles.placeholderSubtitle,
                { color: secondaryFontColor },
              ]}
            >
              {activeTab === 'drafts'
                ? 'Start a new order to begin.'
                : 'Once you have orders in this category, they will appear here.'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
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
    fontSize: 24,
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
    alignItems: 'center',
  },
  cardTitle: {
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
  cardMeta: {
    fontSize: 12,
  },
  cardFooter: {
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
});

export default OrdersScreen;

