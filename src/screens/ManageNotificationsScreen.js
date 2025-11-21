/**
 * Manage Notifications Screen
 * Admin-only screen for viewing and managing global notifications
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import {
  getAllGlobalNotifications,
  createGlobalNotification,
  updateGlobalNotification,
  deleteGlobalNotification,
} from '../services/notificationService';
import PrimaryButton from '../components/PrimaryButton';

function ManageNotificationsScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(null); // null = all, 'published' = published/active, 'paused' = paused, 'archived' = archived
  const [refreshing, setRefreshing] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  const [notificationFormData, setNotificationFormData] = useState({
    title: '',
    message: '',
    youtube_url: '',
    audience: 'all',
    send_at: '',
    expire_at: '',
    is_sticky: false,
    allow_dismiss: true,
    status: 'draft',
  });
  const [showSendAtPicker, setShowSendAtPicker] = useState(false);
  const [showExpireAtPicker, setShowExpireAtPicker] = useState(false);
  const [sendAtDate, setSendAtDate] = useState(new Date());
  const [expireAtDate, setExpireAtDate] = useState(new Date());

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadNotifications();
  }, [isAdmin, navigation]);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const notifs = await getAllGlobalNotifications();
      setNotifications(notifs || []);
    } catch (error) {
      console.error('[ManageNotifications] Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
  }, []);

  const handleStatusFilter = useCallback((status) => {
    setStatusFilter(status === statusFilter ? null : status);
  }, [statusFilter]);

  // Helper functions for California timezone (PST/PDT)
  const formatCaliforniaDateTime = (dateString) => {
    if (!dateString) return '';
    let date;
    if (typeof dateString === 'string' && dateString.includes('T')) {
      const hasTimezone = dateString.includes('Z') || 
                         dateString.includes('+') || 
                         (dateString.match(/-/g) || []).length > 2;
      if (!hasTimezone) {
        date = new Date(dateString + 'Z');
      } else {
        date = new Date(dateString);
      }
    } else {
      date = new Date(dateString);
    }
    return date.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const parseStoredDateForPicker = (storedDateString) => {
    if (!storedDateString) return new Date();
    const storedDate = new Date(storedDateString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(storedDate);
    const year = parseInt(parts.find(p => p.type === 'year').value);
    const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
    const day = parseInt(parts.find(p => p.type === 'day').value);
    const hour = parseInt(parts.find(p => p.type === 'hour').value);
    const minute = parseInt(parts.find(p => p.type === 'minute').value);
    return new Date(year, month, day, hour, minute);
  };

  const convertLocalDateToISOForStorage = (localDate) => {
    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    const day = localDate.getDate();
    const hour = localDate.getHours();
    const minute = localDate.getMinutes();
    
    const testUTC = new Date(Date.UTC(year, month, day, 12, 0));
    const caTestStr = testUTC.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'short',
    });
    const isPDT = caTestStr.includes('PDT');
    const offsetHours = isPDT ? 7 : 8;
    
    let utcHour = hour + offsetHours;
    let utcDay = day;
    let utcMonth = month;
    let utcYear = year;
    
    if (utcHour >= 24) {
      utcHour = utcHour - 24;
      utcDay = utcDay + 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      if (utcDay > daysInMonth) {
        utcDay = 1;
        utcMonth = utcMonth + 1;
        if (utcMonth >= 12) {
          utcMonth = 0;
          utcYear = utcYear + 1;
        }
      }
    }
    
    const utcDate = new Date(Date.UTC(utcYear, utcMonth, utcDay, utcHour, minute));
    return utcDate.toISOString();
  };

  const formatStatus = (status) => {
    const statusMap = {
      draft: 'Draft',
      scheduled: 'Scheduled',
      published: 'Published',
      paused: 'Paused',
      archived: 'Archived',
    };
    return statusMap[status] || status;
  };

  const formatAudience = (audience) => {
    const audienceMap = {
      all: 'All users',
      active_orders: 'Users with active orders',
      no_orders: 'Users with no orders',
    };
    return audienceMap[audience] || audience;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published':
        return withOpacity(accent, 0.1);
      case 'scheduled':
      case 'paused':
        return withOpacity(warningColor, 0.1);
      case 'archived':
        return withOpacity(secondaryFont, 0.1);
      default:
        return withOpacity(borderColor, 0.2);
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'published':
        return accent;
      case 'scheduled':
      case 'paused':
        return warningColor;
      default:
        return secondaryFont;
    }
  };

  const handleCreateNotification = () => {
    setEditingNotification(null);
    const now = new Date();
    setNotificationFormData({
      title: '',
      message: '',
      youtube_url: '',
      audience: 'all',
      send_at: '',
      expire_at: '',
      is_sticky: false,
      allow_dismiss: true,
      status: 'draft',
    });
    setSendAtDate(now);
    setExpireAtDate(now);
    setShowNotificationForm(true);
  };

  const handleEditNotification = (notification) => {
    setEditingNotification(notification);
    const sendAt = notification.send_at ? parseStoredDateForPicker(notification.send_at) : new Date();
    const expireAt = notification.expire_at ? parseStoredDateForPicker(notification.expire_at) : new Date();
    setNotificationFormData({
      title: notification.title || '',
      message: notification.message || '',
      youtube_url: notification.youtube_url || '',
      audience: notification.audience || 'all',
      send_at: notification.send_at || '',
      expire_at: notification.expire_at || '',
      is_sticky: notification.is_sticky || false,
      allow_dismiss: notification.allow_dismiss !== false,
      status: notification.status || 'draft',
    });
    setSendAtDate(sendAt);
    setExpireAtDate(expireAt);
    setShowNotificationForm(true);
  };

  const handleSaveNotification = async () => {
    try {
      if (!notificationFormData.title || !notificationFormData.message) {
        Alert.alert('Error', 'Title and message are required.');
        return;
      }

      const adminId = state.currentUser?.id;
      if (!adminId) {
        Alert.alert('Error', 'Admin user ID not found');
        return;
      }

      let sendAt = null;
      if (notificationFormData.send_at) {
        const dateStr = notificationFormData.send_at;
        const utcDateStr = dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)
          ? dateStr + 'Z'
          : dateStr;
        sendAt = new Date(utcDateStr).toISOString();
      }
      let expireAt = null;
      if (notificationFormData.expire_at) {
        const dateStr = notificationFormData.expire_at;
        const utcDateStr = dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)
          ? dateStr + 'Z'
          : dateStr;
        expireAt = new Date(utcDateStr).toISOString();
      }

      if (editingNotification) {
        await updateGlobalNotification(editingNotification.id, {
          title: notificationFormData.title,
          message: notificationFormData.message,
          youtubeUrl: notificationFormData.youtube_url || null,
          audience: notificationFormData.audience,
          sendAt,
          expireAt,
          isSticky: notificationFormData.is_sticky,
          allowDismiss: notificationFormData.allow_dismiss,
          status: notificationFormData.status,
        });
        Alert.alert('Success', 'Notification updated');
      } else {
        await createGlobalNotification({
          title: notificationFormData.title,
          message: notificationFormData.message,
          youtubeUrl: notificationFormData.youtube_url || null,
          audience: notificationFormData.audience,
          sendAt,
          expireAt,
          isSticky: notificationFormData.is_sticky,
          allowDismiss: notificationFormData.allow_dismiss,
          status: notificationFormData.status,
          createdByAdminId: adminId,
        });
        Alert.alert('Success', 'Notification created');
      }

      setShowNotificationForm(false);
      await loadNotifications();
    } catch (error) {
      console.error('[ManageNotifications] Error saving notification:', error);
      Alert.alert('Error', error.message || 'Failed to save notification. Please try again.');
    }
  };

  const handleDeleteNotification = (notification) => {
    Alert.alert(
      'Delete Notification',
      `Are you sure you want to delete "${notification.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGlobalNotification(notification.id);
              await loadNotifications();
            } catch (error) {
              console.error('[ManageNotifications] Error deleting notification:', error);
              Alert.alert('Error', 'Failed to delete notification. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleToggleNotificationStatus = async (notification, newStatus) => {
    try {
      await updateGlobalNotification(notification.id, { status: newStatus });
      await loadNotifications();
    } catch (error) {
      console.error('[ManageNotifications] Error updating notification status:', error);
      Alert.alert('Error', 'Failed to update notification status. Please try again.');
    }
  };

  // Filter notifications based on search and status filter
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (notif) =>
          notif.title?.toLowerCase().includes(query) ||
          notif.message?.toLowerCase().includes(query)
      );
    }

    // Apply status filter - map Published to "published" for filtering
    if (statusFilter !== null) {
      if (statusFilter === 'published') {
        // Show published (active) notifications
        filtered = filtered.filter((notif) => notif.status === 'published' || notif.status === 'scheduled');
      } else {
        // Show specific status
        filtered = filtered.filter((notif) => notif.status === statusFilter);
      }
    }

    return filtered;
  }, [notifications, searchQuery, statusFilter]);

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';
  const warningColor = colors.warning || '#FF9800';

  const renderNotificationRow = ({ item: notification }) => (
    <View
      style={[
        styles.notificationCard,
        {
          backgroundColor: surface,
          borderColor: withOpacity(borderColor, 0.5),
        },
      ]}
    >
      <View style={styles.notificationCardHeader}>
        <View style={styles.notificationCardTitleRow}>
          <Text style={[styles.notificationTitle, { color: primaryFont }]}>
            {notification.title}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const statuses = ['draft', 'scheduled', 'published', 'paused', 'archived'];
              const currentIndex = statuses.indexOf(notification.status);
              const nextStatus = statuses[(currentIndex + 1) % statuses.length];
              handleToggleNotificationStatus(notification, nextStatus);
            }}
            style={[
              styles.statusButton,
              {
                backgroundColor: getStatusColor(notification.status),
              },
            ]}
          >
            <Text
              style={[
                styles.statusButtonText,
                {
                  color: getStatusTextColor(notification.status),
                },
              ]}
            >
              {formatStatus(notification.status)}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.notificationMessage, { color: secondaryFont }]} numberOfLines={2}>
          {notification.message}
        </Text>
        <View style={styles.notificationMeta}>
          <Text style={[styles.notificationMetaText, { color: secondaryFont }]}>
            Audience: {formatAudience(notification.audience)}
          </Text>
          {notification.send_at && (
            <Text style={[styles.notificationMetaText, { color: secondaryFont }]}>
              Send: {formatCaliforniaDateTime(notification.send_at)}
            </Text>
          )}
          {notification.expire_at && (
            <Text style={[styles.notificationMetaText, { color: secondaryFont }]}>
              Expire: {formatCaliforniaDateTime(notification.expire_at)}
            </Text>
          )}
          {notification.is_sticky && (
            <Text style={[styles.notificationMetaText, { color: accent }]}>📌 Sticky</Text>
          )}
          {!notification.allow_dismiss && (
            <Text style={[styles.notificationMetaText, { color: warningColor }]}>🔒 No dismiss</Text>
          )}
        </View>
      </View>

      <View style={styles.notificationActions}>
        <TouchableOpacity
          onPress={() => handleEditNotification(notification)}
          style={[styles.actionButton, { borderColor: withOpacity(borderColor, 0.5) }]}
        >
          <Text style={[styles.actionButtonText, { color: primaryFont }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteNotification(notification)}
          style={[styles.actionButton, { borderColor: withOpacity(colors.error || '#B33A3A', 0.5) }]}
        >
          <Text style={[styles.actionButtonText, { color: colors.error || '#B33A3A' }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronRight" color={primaryFont} size={20} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Manage Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filtersContainer}>
        <View style={[styles.searchContainer, { borderColor: withOpacity(borderColor, 0.5) }]}>
          <Icon name="search" color={secondaryFont} size={18} />
          <TextInput
            style={[styles.searchInput, { color: primaryFont }]}
            placeholder="Search by title or message..."
            placeholderTextColor={withOpacity(secondaryFont, 0.5)}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Icon name="close" color={secondaryFont} size={18} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
          <TouchableOpacity
            onPress={() => handleStatusFilter('published')}
            style={[
              styles.filterChip,
              {
                backgroundColor: statusFilter === 'published' ? withOpacity(accent, 0.1) : surface,
                borderColor: statusFilter === 'published' ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color: statusFilter === 'published' ? accent : primaryFont,
                },
              ]}
            >
              Published/Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleStatusFilter('paused')}
            style={[
              styles.filterChip,
              {
                backgroundColor: statusFilter === 'paused' ? withOpacity(warningColor, 0.1) : surface,
                borderColor: statusFilter === 'paused' ? warningColor : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color: statusFilter === 'paused' ? warningColor : primaryFont,
                },
              ]}
            >
              Paused
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleStatusFilter('archived')}
            style={[
              styles.filterChip,
              {
                backgroundColor: statusFilter === 'archived' ? withOpacity(secondaryFont, 0.1) : surface,
                borderColor: statusFilter === 'archived' ? secondaryFont : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color: statusFilter === 'archived' ? secondaryFont : primaryFont,
                },
              ]}
            >
              Archived
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleStatusFilter(null)}
            style={[
              styles.filterChip,
              {
                backgroundColor: statusFilter === null ? withOpacity(accent, 0.1) : surface,
                borderColor: statusFilter === null ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color: statusFilter === null ? accent : primaryFont,
                },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.contentHeader}>
        <Text style={[styles.sectionTitle, { color: primaryFont }]}>Global Notifications</Text>
        <TouchableOpacity
          onPress={handleCreateNotification}
          style={[styles.addButton, { backgroundColor: accent }]}
        >
          <Icon name="plus" color={colors.accentContrast || '#FFFFFF'} size={16} />
          <Text style={[styles.addButtonText, { color: colors.accentContrast || '#FFFFFF' }]}>
            Create
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={[styles.loadingText, { color: secondaryFont }]}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotificationRow}
          keyExtractor={(item) => item.id}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: secondaryFont }]}>
                  {searchQuery || statusFilter !== null
                    ? 'No notifications match your filters'
                    : 'No notifications yet. Create one to get started.'}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Notification Form Modal */}
      <Modal visible={showNotificationForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryFont }]}>
                {editingNotification ? 'Edit Notification' : 'Create Notification'}
              </Text>
              <TouchableOpacity onPress={() => setShowNotificationForm(false)}>
                <Icon name="close" color={primaryFont} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContent}>
              <Text style={[styles.formLabel, { color: primaryFont }]}>Title *</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={notificationFormData.title}
                onChangeText={(text) => setNotificationFormData((prev) => ({ ...prev, title: text }))}
                placeholder="New promotion available"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Message *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={notificationFormData.message}
                onChangeText={(text) => setNotificationFormData((prev) => ({ ...prev, message: text }))}
                placeholder="Get 20% off your next order with code SAVE20"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                multiline
                numberOfLines={4}
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>YouTube URL (optional)</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={notificationFormData.youtube_url}
                onChangeText={(text) => setNotificationFormData((prev) => ({ ...prev, youtube_url: text }))}
                placeholder="https://www.youtube.com/watch?v=..."
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Audience *</Text>
              <View style={styles.typeButtons}>
                {[
                  { value: 'all', label: 'All users' },
                  { value: 'active_orders', label: 'Users with active orders' },
                  { value: 'no_orders', label: 'Users with no orders' },
                ].map((audience) => (
                  <TouchableOpacity
                    key={audience.value}
                    onPress={() => setNotificationFormData((prev) => ({ ...prev, audience: audience.value }))}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor:
                          notificationFormData.audience === audience.value
                            ? withOpacity(accent, 0.1)
                            : withOpacity(borderColor, 0.2),
                        borderColor:
                          notificationFormData.audience === audience.value ? accent : withOpacity(borderColor, 0.5),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        {
                          color: notificationFormData.audience === audience.value ? accent : primaryFont,
                        },
                      ]}
                    >
                      {audience.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.formLabel, { color: primaryFont }]}>Send At (optional)</Text>
              <TouchableOpacity
                onPress={() => setShowSendAtPicker(true)}
                style={[styles.formInput, styles.datePickerButton, { borderColor: withOpacity(borderColor, 0.5), backgroundColor: surface }]}
              >
                <Text style={[styles.datePickerText, { color: notificationFormData.send_at ? primaryFont : secondaryFont }]}>
                  {notificationFormData.send_at
                    ? formatCaliforniaDateTime(notificationFormData.send_at)
                    : 'Select date and time'}
                </Text>
                <Icon name="note" color={secondaryFont} size={20} />
              </TouchableOpacity>
              {Platform.OS === 'android' && showSendAtPicker && (
                <DateTimePicker
                  value={sendAtDate}
                  mode="datetime"
                  display="default"
                  onChange={(event, selectedDate) => {
                    if (event.type === 'set' && selectedDate) {
                      setSendAtDate(selectedDate);
                      setNotificationFormData((prev) => ({
                        ...prev,
                        send_at: convertLocalDateToISOForStorage(selectedDate),
                      }));
                    }
                    setShowSendAtPicker(false);
                  }}
                  minimumDate={new Date()}
                />
              )}
              {Platform.OS === 'ios' && showSendAtPicker && (
                <View style={[styles.iosPickerContainer, { backgroundColor: surface, borderColor: borderColor }]}>
                  <View style={[styles.iosPickerHeader, { borderBottomColor: withOpacity(borderColor, 0.3) }]}>
                    <TouchableOpacity
                      onPress={() => setShowSendAtPicker(false)}
                      style={styles.iosPickerButton}
                    >
                      <Text style={[styles.iosPickerButtonText, { color: primaryFont }]}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={[styles.iosPickerTitle, { color: primaryFont }]}>Select Date & Time</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setNotificationFormData((prev) => ({
                          ...prev,
                          send_at: convertLocalDateToISOForStorage(sendAtDate),
                        }));
                        setShowSendAtPicker(false);
                      }}
                      style={styles.iosPickerButton}
                    >
                      <Text style={[styles.iosPickerButtonText, { color: accent }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={sendAtDate}
                    mode="datetime"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setSendAtDate(selectedDate);
                      }
                    }}
                    minimumDate={new Date()}
                    style={styles.iosPicker}
                  />
                </View>
              )}

              <Text style={[styles.formLabel, { color: primaryFont }]}>Expire At (optional)</Text>
              <TouchableOpacity
                onPress={() => setShowExpireAtPicker(true)}
                style={[styles.formInput, styles.datePickerButton, { borderColor: withOpacity(borderColor, 0.5), backgroundColor: surface }]}
              >
                <Text style={[styles.datePickerText, { color: notificationFormData.expire_at ? primaryFont : secondaryFont }]}>
                  {notificationFormData.expire_at
                    ? formatCaliforniaDateTime(notificationFormData.expire_at)
                    : 'Select date and time'}
                </Text>
                <Icon name="note" color={secondaryFont} size={20} />
              </TouchableOpacity>
              {Platform.OS === 'android' && showExpireAtPicker && (
                <DateTimePicker
                  value={expireAtDate}
                  mode="datetime"
                  display="default"
                  onChange={(event, selectedDate) => {
                    if (event.type === 'set' && selectedDate) {
                      setExpireAtDate(selectedDate);
                      setNotificationFormData((prev) => ({
                        ...prev,
                        expire_at: convertLocalDateToISOForStorage(selectedDate),
                      }));
                    }
                    setShowExpireAtPicker(false);
                  }}
                  minimumDate={sendAtDate || new Date()}
                />
              )}
              {Platform.OS === 'ios' && showExpireAtPicker && (
                <View style={[styles.iosPickerContainer, { backgroundColor: surface, borderColor: borderColor }]}>
                  <View style={[styles.iosPickerHeader, { borderBottomColor: withOpacity(borderColor, 0.3) }]}>
                    <TouchableOpacity
                      onPress={() => setShowExpireAtPicker(false)}
                      style={styles.iosPickerButton}
                    >
                      <Text style={[styles.iosPickerButtonText, { color: primaryFont }]}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={[styles.iosPickerTitle, { color: primaryFont }]}>Select Date & Time</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setNotificationFormData((prev) => ({
                          ...prev,
                          expire_at: convertLocalDateToISOForStorage(expireAtDate),
                        }));
                        setShowExpireAtPicker(false);
                      }}
                      style={styles.iosPickerButton}
                    >
                      <Text style={[styles.iosPickerButtonText, { color: accent }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={expireAtDate}
                    mode="datetime"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setExpireAtDate(selectedDate);
                      }
                    }}
                    minimumDate={sendAtDate || new Date()}
                    style={styles.iosPicker}
                  />
                </View>
              )}

              <Text style={[styles.formLabel, { color: primaryFont }]}>Status *</Text>
              <View style={styles.typeButtons}>
                {['draft', 'scheduled', 'published', 'paused', 'archived'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setNotificationFormData((prev) => ({ ...prev, status }))}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor:
                          notificationFormData.status === status
                            ? withOpacity(accent, 0.1)
                            : withOpacity(borderColor, 0.2),
                        borderColor:
                          notificationFormData.status === status ? accent : withOpacity(borderColor, 0.5),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        {
                          color: notificationFormData.status === status ? accent : primaryFont,
                        },
                      ]}
                    >
                      {formatStatus(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() => setNotificationFormData((prev) => ({ ...prev, is_sticky: !prev.is_sticky }))}
                  style={styles.checkboxContainer}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: notificationFormData.is_sticky ? accent : 'transparent',
                        borderColor: withOpacity(borderColor, 0.5),
                      },
                    ]}
                  >
                    {notificationFormData.is_sticky && (
                      <Icon name="check" color={colors.accentContrast || '#FFFFFF'} size={14} />
                    )}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: primaryFont }]}>Sticky (pin to top)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() =>
                    setNotificationFormData((prev) => ({ ...prev, allow_dismiss: !prev.allow_dismiss }))
                  }
                  style={styles.checkboxContainer}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: notificationFormData.allow_dismiss ? accent : 'transparent',
                        borderColor: withOpacity(borderColor, 0.5),
                      },
                    ]}
                  >
                    {notificationFormData.allow_dismiss && (
                      <Icon name="check" color={colors.accentContrast || '#FFFFFF'} size={14} />
                    )}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: primaryFont }]}>Allow dismiss</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowNotificationForm(false)}
                style={[styles.modalButton, { borderColor: withOpacity(borderColor, 0.5) }]}
              >
                <Text style={[styles.modalButtonText, { color: primaryFont }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveNotification}
                disabled={!notificationFormData.title.trim() || !notificationFormData.message.trim()}
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  {
                    backgroundColor: accent,
                    opacity: (!notificationFormData.title.trim() || !notificationFormData.message.trim()) ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonPrimaryText, { color: colors.accentContrast || '#FFFFFF' }]}>
                  {editingNotification ? 'Update' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';
  const warningColor = colors.warning || '#FF9800';

  return StyleSheet.create({
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
      borderBottomColor: withOpacity(colors.shadow || '#000000', 0.08),
    },
    backButton: {
      padding: 8,
      transform: [{ rotate: '180deg' }],
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    headerSpacer: {
      width: 36,
    },
    filtersContainer: {
      padding: 16,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withOpacity(borderColor, 0.3),
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: surface,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
    },
    filtersRow: {
      flexDirection: 'row',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
    },
    contentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      marginTop: 8,
    },
    listContent: {
      padding: 16,
    },
    notificationCard: {
      padding: 16,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
    },
    notificationCardHeader: {
      gap: 8,
    },
    notificationCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    notificationTitle: {
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
    },
    statusButton: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusButtonText: {
      fontSize: 12,
      fontWeight: '600',
    },
    notificationMessage: {
      fontSize: 14,
      lineHeight: 20,
    },
    notificationMeta: {
      gap: 4,
      marginTop: 4,
    },
    notificationMetaText: {
      fontSize: 12,
    },
    notificationActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
      paddingBottom: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withOpacity(colors.shadow || '#000000', 0.08),
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    formContent: {
      padding: 16,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 6,
      marginTop: 12,
    },
    formInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
    },
    formTextArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    typeButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    typeButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      minWidth: '47%',
    },
    typeButtonText: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    checkboxRow: {
      marginTop: 16,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxLabel: {
      fontSize: 14,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(colors.shadow || '#000000', 0.08),
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    modalButtonPrimary: {
      borderWidth: 0,
    },
    modalButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    modalButtonPrimaryText: {
      color: '#FFFFFF',
    },
    datePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    datePickerText: {
      fontSize: 14,
    },
    iosPickerContainer: {
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 8,
      overflow: 'hidden',
    },
    iosPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    iosPickerButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    iosPickerButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    iosPickerTitle: {
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
      textAlign: 'center',
    },
    iosPicker: {
      height: 200,
    },
  });
}

export default ManageNotificationsScreen;

