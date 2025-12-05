import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import Icon from '../icons/Icon';
import { withOpacity } from '../utils/color';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  archiveNotification,
} from '../services/notificationService';

function NotificationsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state } = useAppState();

  const colors = theme?.colors || {};
  const accentColor = colors.accent || '#6F171F';
  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';

  const currentUserId = state.currentUser?.id || state.currentUser?.userId;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      // Always load all notifications first to determine unread count
      const data = await getUserNotifications(currentUserId, {
        includeRead: true,
        includeArchived: false,
      });
      setNotifications(data || []);
      
      // Set default filter on first load: show only unread if there are any unread notifications
      if (!hasInitialized) {
        const unreadCount = (data || []).filter((n) => !n.isRead).length;
        if (unreadCount > 0) {
          setShowOnlyUnread(true);
        }
        setHasInitialized(true);
      }
    } catch (error) {
      console.error('[NotificationsScreen] Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId, hasInitialized]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Handle notification tap - mark as read and optionally navigate
  const handleNotificationPress = useCallback(
    async (notification) => {
      if (!notification.isRead && notification.recipientId) {
        try {
          await markNotificationAsRead(notification.recipientId, currentUserId);
          // Update local state
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notification.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
            )
          );
        } catch (error) {
          console.error('[NotificationsScreen] Error marking as read:', error);
        }
      }

      // Check for deep link in metadata (for feedback requests)
      if (notification.metadata?.deepLink) {
        const deepLink = notification.metadata.deepLink;
        if (deepLink.startsWith('feedback:')) {
          const orderId = deepLink.replace('feedback:', '');
          navigation.goBack();
          setTimeout(() => {
            navigation.navigate('Feedback', { orderId });
          }, 100);
          return;
        }
      }

      // Navigate to order if related - fetch order first
      if (notification.relatedOrderId) {
        try {
          // Close the notifications panel first
          navigation.goBack();
          
          // Fetch the order and navigate
          const { fetchOrder } = await import('../services/orderService');
          const { order: fullOrder } = await fetchOrder(notification.relatedOrderId);
          
          if (fullOrder) {
            // Small delay to ensure panel is closed
            setTimeout(() => {
              navigation.navigate('OrderDetails', { order: fullOrder });
            }, 100);
          } else {
            Alert.alert('Order not found', 'The order associated with this notification could not be found.');
          }
        } catch (error) {
          console.error('[NotificationsScreen] Error fetching order:', error);
          Alert.alert('Error', 'Failed to load order details. Please try again.');
        }
        return; // Don't open YouTube if we're navigating to an order
      }

      // Open YouTube link if present
      if (notification.youtubeUrl) {
        try {
          const supported = await Linking.canOpenURL(notification.youtubeUrl);
          if (supported) {
            await Linking.openURL(notification.youtubeUrl);
          }
        } catch (error) {
          console.error('[NotificationsScreen] Error opening YouTube link:', error);
        }
      }
    },
    [currentUserId, navigation]
  );

  // Handle dismiss
  const handleDismiss = useCallback(
    async (notification) => {
      if (!notification.allowDismiss && notification.type === 'global') {
        return; // Can't dismiss if not allowed
      }

      try {
        if (notification.recipientId) {
          await dismissNotification(notification.recipientId, currentUserId);
          // Remove from list
          setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
        }
      } catch (error) {
        console.error('[NotificationsScreen] Error dismissing notification:', error);
        Alert.alert('Error', 'Failed to dismiss notification. Please try again.');
      }
    },
    [currentUserId]
  );

  // Handle mark all as read
  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead(currentUserId);
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
    } catch (error) {
      console.error('[NotificationsScreen] Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark all as read. Please try again.');
    }
  }, [currentUserId]);

  // Get icon for notification type
  const getNotificationIcon = useCallback((notification) => {
    if (notification.type === 'system') {
      switch (notification.systemEventType) {
        case 'tracking_added':
          return 'mapPin';
        case 'status_approved':
        case 'status_in_progress':
        case 'status_ready':
          return 'orders';
        case 'payment_received':
          return 'check';
        case 'discount_applied':
          return 'tag';
        default:
          return 'info';
      }
    }
    return 'info';
  }, []);

  // Filter notifications
  const displayedNotifications = useMemo(() => {
    if (showOnlyUnread) {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, showOnlyUnread]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  if (!currentUserId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevronRight" color={primaryFont} size={20} />
          </TouchableOpacity>
          <AppText style={[styles.headerTitle, { color: primaryFont }]}>Notifications</AppText>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <AppText style={[styles.emptyText, { color: secondaryFont }]}>Please log in to view notifications</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronRight" color={primaryFont} size={20} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Notifications</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {/* Controls */}
      {notifications.length > 0 && (
        <View style={[styles.controls, { borderBottomColor: colors.border || '#D9C8A9' }]}>
          {unreadCount === 0 ? (
            // Show message when all are read
            <View style={styles.catchUpMessage}>
              <AppText style={[styles.catchUpText, { color: secondaryFont }]}>
                You're all caught up - no new notifications
              </AppText>
            </View>
          ) : (
            // Show toggle button when there are unread notifications
            <TouchableOpacity
              onPress={() => {
                // Toggle between show all and show only unread
                setShowOnlyUnread(!showOnlyUnread);
              }}
              style={styles.controlButton}
            >
              <AppText style={[styles.controlText, { color: accentColor }]}>
                {showOnlyUnread ? 'Show All' : 'Show Only Unread'}
              </AppText>
            </TouchableOpacity>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.controlButton}>
              <AppText style={[styles.controlText, { color: accentColor }]}>Mark All Read</AppText>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={loadNotifications}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={accentColor} />
            <AppText style={[styles.loadingText, { color: secondaryFont }]}>Loading notifications...</AppText>
          </View>
        ) : displayedNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="bell" color={secondaryFont} size={48} />
            <AppText style={[styles.emptyText, { color: secondaryFont }]}>
              {showOnlyUnread ? 'No unread notifications' : 'No notifications yet'}
            </AppText>
          </View>
        ) : (
          <View style={styles.notificationList}>
            {displayedNotifications.map((notification) => {
              const isUnread = !notification.isRead;
              const iconName = getNotificationIcon(notification);

              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: isUnread
                        ? withOpacity(accentColor, 0.08)
                        : withOpacity(colors.secondaryBackground, 0.25),
                      borderColor: colors.border,
                      borderLeftWidth: isUnread ? 4 : StyleSheet.hairlineWidth,
                      borderLeftColor: isUnread ? accentColor : colors.border,
                    },
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: withOpacity(accentColor, 0.1) }]}>
                    <Icon name={iconName} color={accentColor} size={20} />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <AppText style={[styles.notificationTitle, { color: primaryFont }]}>
                        {notification.title}
                      </AppText>
                      {notification.allowDismiss !== false && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDismiss(notification);
                          }}
                          style={styles.dismissButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon name="close" color={secondaryFont} size={16} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <AppText style={[styles.notificationMessage, { color: secondaryFont }]}>
                      {notification.message}
                    </AppText>
                    {notification.youtubeUrl && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          Linking.openURL(notification.youtubeUrl);
                        }}
                        style={styles.youtubeLink}
                      >
                        <AppText style={[styles.youtubeLinkText, { color: accentColor }]}>
                          Watch this video
                        </AppText>
                      </TouchableOpacity>
                    )}
                    <AppText style={[styles.notificationTime, { color: secondaryFont }]}>
                      {new Date(notification.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </AppText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
    transform: [{ rotate: '180deg' }],
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
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  controlButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  controlText: {
    fontSize: 14,
    fontWeight: '600',
  },
  catchUpMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  catchUpText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
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
    alignItems: 'flex-start',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notificationContent: {
    flex: 1,
    gap: 6,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  dismissButton: {
    padding: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  youtubeLink: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  youtubeLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationTime: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default NotificationsScreen;
