import React, { useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';

function OrdersScreen() {
  const { theme } = useTheme();
  const { state, refreshConsentLogs } = useAppState();
  const colors = theme?.colors || {};
  const {
    primaryBackground,
    secondaryBackground,
    surface,
    primaryFont,
    secondaryFont,
    accent,
    accentContrast,
    border,
  } = colors;
  const accentColor = accent || '#6F171F';
  const secondaryBackgroundColor = secondaryBackground || '#BF9B7A';
  const primaryBackgroundColor = primaryBackground || '#F4EBE3';
  const surfaceColor = surface || '#FFFFFF';
  const primaryFontColor = primaryFont || '#220707';
  const secondaryFontColor = secondaryFont || '#5C5F5D';
  const borderColor = border || '#D9C8A9';

  const orders = useMemo(() => {
    const collection = [];
    if (state.activeOrder) {
      collection.push({ ...state.activeOrder, label: 'In progress' });
    }
    if (state.lastCompletedOrder && state.lastCompletedOrder.id !== state.activeOrder?.id) {
      collection.push({ ...state.lastCompletedOrder, label: 'Recent' });
    }
    return collection;
  }, [state.activeOrder, state.lastCompletedOrder]);

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: primaryBackgroundColor },
      ]}
      ListHeaderComponent={
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
      }
      renderItem={({ item }) => (
        <View
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
              {item.nailSets?.[0]?.name || 'Custom Set'}
            </Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    item.status === 'submitted'
                      ? withOpacity(accentColor, 0.12)
                      : withOpacity(secondaryBackgroundColor, 0.35),
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: accentColor },
                ]}
              >
                {item.status || 'draft'}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.cardMeta,
              { color: secondaryFontColor },
            ]}
          >
            Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'recently'}
          </Text>
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={[
                styles.linkButton,
                { borderColor: accentColor },
              ]}
              onPress={() => {
                logEvent('tap_order_view', { orderId: item.id });
              }}
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
            <TouchableOpacity
              style={styles.linkInline}
              onPress={() => {
                logEvent('tap_order_support', { orderId: item.id });
              }}
            >
              <Text
                style={[
                  styles.linkInlineText,
                  { color: secondaryFontColor },
                ]}
              >
                Need help?
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View
          style={[
            styles.emptyState,
            {
              borderColor,
              backgroundColor: surfaceColor,
            },
          ]}
        >
          <Text
            style={[
              styles.emptyTitle,
              { color: primaryFontColor },
            ]}
          >
            No orders yet
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: secondaryFontColor },
            ]}
          >
            Tap the Create button to start your first custom set and track it here.
          </Text>
        </View>
      }
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
    />
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
  linkInline: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkInlineText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 8,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default OrdersScreen;

