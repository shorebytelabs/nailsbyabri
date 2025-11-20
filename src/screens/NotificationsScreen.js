import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import Icon from '../icons/Icon';
import { withOpacity } from '../utils/color';

function NotificationsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state } = useAppState();

  const colors = theme?.colors || {};
  const accentColor = colors.accent || '#6F171F';

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

  const notifications = useMemo(() => {
    if (activeOrders.length === 0) {
      return [
        {
          id: 'notify-empty',
          message: 'No shipments on the move yet. Create your first set to get started!',
          icon: 'info',
        },
      ];
    }
    return [
      {
        id: 'notify-shipment',
        message: 'Local delivery slots fill quickly—schedule pickup or delivery at checkout.',
        icon: 'orders',
      },
      {
        id: 'notify-care',
        message: 'Remember to store your sets flat to keep their shape perfect.',
        icon: 'info',
      },
    ];
  }, [activeOrders.length]);

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronRight" color={primaryFont} size={20} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
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
              <View style={[styles.iconWrapper, { backgroundColor: withOpacity(accentColor, 0.1) }]}>
                <Icon name={note.icon || 'info'} color={accentColor} size={20} />
              </View>
              <Text
                style={[
                  styles.notificationText,
                  { color: primaryFont },
                ]}
              >
                {note.message}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }], // Rotate chevronRight to point left
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  notificationList: {
    gap: 12,
  },
  notificationCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default NotificationsScreen;

