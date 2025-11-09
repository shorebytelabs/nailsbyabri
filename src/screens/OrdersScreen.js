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

function OrdersScreen() {
  const { theme } = useTheme();
  const { state, refreshConsentLogs } = useAppState();
  const colors = theme?.colors || {};

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
        { backgroundColor: colors.primaryBackground || '#F7F7FB' },
      ]}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.primaryFont || '#220707' },
            ]}
          >
            Your orders
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: colors.secondaryFont || '#5C5F5D' },
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
              borderColor: colors.border || '#D9C8A9',
              backgroundColor: colors.surface || '#FFFFFF',
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.primaryFont || '#220707' },
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
                      ? `${(colors.accent || '#531C22')}20`
                      : `${(colors.secondaryBackground || '#E7D8CA')}50`,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: colors.accent || '#531C22' },
                ]}
              >
                {item.status || 'draft'}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.cardMeta,
              { color: colors.secondaryFont || '#5C5F5D' },
            ]}
          >
            Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'recently'}
          </Text>
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={[
                styles.linkButton,
                { borderColor: colors.accent || '#531C22' },
              ]}
              onPress={() => {
                logEvent('tap_order_view', { orderId: item.id });
              }}
            >
              <Text
                style={[
                  styles.linkButtonText,
                  { color: colors.accent || '#531C22' },
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
                  { color: colors.secondaryFont || '#5C5F5D' },
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
              borderColor: colors.border || '#D9C8A9',
              backgroundColor: colors.surface || '#FFFFFF',
            },
          ]}
        >
          <Text
            style={[
              styles.emptyTitle,
              { color: colors.primaryFont || '#220707' },
            ]}
          >
            No orders yet
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: colors.secondaryFont || '#5C5F5D' },
            ]}
          >
            Tap the Create button to start your first custom set and track it here.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          tintColor={colors.accent || '#531C22'}
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

