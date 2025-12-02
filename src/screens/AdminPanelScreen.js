/**
 * Admin Panel Screen
 * Provides admin-only access to manage promo codes and other admin features
 * Designed to match ProfileScreen style with expandable sections
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  getAllPromoCodes,
  createPromoCode,
  updatePromoCode,
  togglePromoCode,
  deletePromoCode,
} from '../services/promoCodeService';
import {
  getWeeklyCapacity,
  updateWeeklyCapacity,
  resetCurrentWeekCount,
  createNextWeekCapacity,
  formatNextWeekStartForAdmin,
  getNextWeekStartDateTime,
} from '../services/workloadService';
import {
  getAllTips,
  createTip,
  updateTip,
  deleteTip,
  toggleTipEnabled,
} from '../services/tipsService';
import {
  getAllGlobalNotifications,
  createGlobalNotification,
  updateGlobalNotification,
  deleteGlobalNotification,
} from '../services/notificationService';
import { uploadImageToStorage } from '../services/imageStorageService';
import { launchImageLibrary } from 'react-native-image-picker';
import { getActiveTheme, setActiveTheme } from '../services/appSettingsService';
import PrimaryButton from '../components/PrimaryButton';
import ManageUsersScreen from './ManageUsersScreen';
import UserDetailScreen from './UserDetailScreen';
import ManagePromoCodesScreen from './ManagePromoCodesScreen';
import ManageWorkloadScreen from './ManageWorkloadScreen';
import ManageNotificationsScreen from './ManageNotificationsScreen';
import ManageTipsScreen from './ManageTipsScreen';
import ManageThemeScreen from './ManageThemeScreen';
import ManageShapesScreen from './ManageShapesScreen';
import ManageDeliveryMethodsScreen from './ManageDeliveryMethodsScreen';
import ManageFeedbackScreen from './ManageFeedbackScreen';
import { Image } from 'react-native';

function AdminPanelScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  // Track which view is active: 'main', 'manageUsers', or 'userDetail'
  const [activeView, setActiveView] = useState('main');
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoCodesExpanded, setPromoCodesExpanded] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  
  // Workload state
  const [workloadExpanded, setWorkloadExpanded] = useState(false);
  const [workloadInfo, setWorkloadInfo] = useState(null);
  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [capacityInput, setCapacityInput] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [resettingWeek, setResettingWeek] = useState(false);

  // Tips state
  const [tips, setTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const [editingTip, setEditingTip] = useState(null);
  const [showTipForm, setShowTipForm] = useState(false);
  const [tipFormData, setTipFormData] = useState({
    title: '',
    description: '',
    image_url: null,
    image_path: null,
    youtube_url: '',
    enabled: true,
    display_order: 0,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
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

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    type: 'percentage',
    value: '',
    min_order_amount: '',
    start_date: '',
    end_date: '',
    max_uses: '',
    per_user_limit: '',
    combinable: true,
    active: true,
  });

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    // If impersonating, redirect to home screen instead of showing alert
    if (state.impersonating) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
      return;
    }
    
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    if (promoCodesExpanded) {
      loadPromoCodes();
    }
    if (workloadExpanded) {
      loadWorkloadInfo();
    }
    if (notificationsExpanded) {
      loadNotifications();
    }
    if (tipsExpanded) {
      loadTips();
    }
  }, [isAdmin, navigation, promoCodesExpanded, workloadExpanded, notificationsExpanded, tipsExpanded, state.impersonating]);

  useEffect(() => {
    if (!confirmation) {
      return undefined;
    }
    const timeout = setTimeout(() => setConfirmation(null), 3200);
    return () => clearTimeout(timeout);
  }, [confirmation]);

  const loadPromoCodes = async () => {
    try {
      setLoading(true);
      const codes = await getAllPromoCodes();
      setPromoCodes(codes || []);
    } catch (error) {
      console.error('[AdminPanel] Error loading promo codes:', error);
      Alert.alert('Error', 'Failed to load promo codes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const notifs = await getAllGlobalNotifications();
      setNotifications(notifs || []);
    } catch (error) {
      console.error('[AdminPanel] Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleCreatePromo = () => {
    setEditingPromo(null);
    setFormData({
      code: '',
      description: '',
      type: 'percentage',
      value: '',
      min_order_amount: '',
      start_date: '',
      end_date: '',
      max_uses: '',
      per_user_limit: '',
      combinable: true,
      active: true,
    });
    setShowPromoForm(true);
  };

  const handleEditPromo = (promo) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code || '',
      description: promo.description || '',
      type: promo.type || 'percentage',
      value: promo.value ? String(promo.value) : '',
      min_order_amount: promo.min_order_amount ? String(promo.min_order_amount) : '',
      start_date: promo.start_date ? new Date(promo.start_date).toISOString().split('T')[0] : '',
      end_date: promo.end_date ? new Date(promo.end_date).toISOString().split('T')[0] : '',
      max_uses: promo.max_uses ? String(promo.max_uses) : '',
      per_user_limit: promo.per_user_limit ? String(promo.per_user_limit) : '',
      combinable: promo.combinable !== false,
      active: promo.active !== false,
    });
    setShowPromoForm(true);
  };

  const handleSavePromo = async () => {
    try {
      const adminId = state.currentUser?.id;
      if (!adminId) {
        Alert.alert('Error', 'Admin user ID not found');
        return;
      }

      const promoData = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || null,
        type: formData.type,
        value: formData.value ? Number(formData.value) : null,
        min_order_amount: formData.min_order_amount ? Number(formData.min_order_amount) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        max_uses: formData.max_uses ? Number(formData.max_uses) : null,
        per_user_limit: formData.per_user_limit ? Number(formData.per_user_limit) : null,
        combinable: formData.combinable,
        active: formData.active,
      };

      if (editingPromo) {
        await updatePromoCode(editingPromo.id, promoData);
        setConfirmation('Promo code updated');
      } else {
        await createPromoCode(promoData, adminId);
        setConfirmation('Promo code created');
      }

      setShowPromoForm(false);
      await loadPromoCodes();
    } catch (error) {
      console.error('[AdminPanel] Error saving promo code:', error);
      Alert.alert('Error', error.message || 'Failed to save promo code. Please try again.');
    }
  };

  const handleToggleActive = async (promo) => {
    try {
      await togglePromoCode(promo.id, !promo.active);
      await loadPromoCodes();
      setConfirmation(promo.active ? 'Promo code deactivated' : 'Promo code activated');
    } catch (error) {
      console.error('[AdminPanel] Error toggling promo code:', error);
      Alert.alert('Error', 'Failed to update promo code. Please try again.');
    }
  };

  const handleDeletePromo = (promo) => {
    Alert.alert(
      'Delete Promo Code',
      `Are you sure you want to delete "${promo.code}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePromoCode(promo.id);
              await loadPromoCodes();
              setConfirmation('Promo code deleted');
            } catch (error) {
              console.error('[AdminPanel] Error deleting promo code:', error);
              Alert.alert('Error', 'Failed to delete promo code. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatPromoType = (type) => {
    const types = {
      percentage: 'Percentage',
      fixed_amount: 'Fixed Amount',
      free_shipping: 'Free Shipping',
      free_order: 'Free Order',
      fixed_price_item: 'Fixed Price Item',
    };
    return types[type] || type;
  };

  const loadWorkloadInfo = async () => {
    try {
      setWorkloadLoading(true);
      const info = await getWeeklyCapacity();
      setWorkloadInfo(info);
      setCapacityInput(String(info.weeklyCapacity));
    } catch (error) {
      console.error('[AdminPanel] Error loading workload info:', error);
      
      // Check if table doesn't exist
      if (error?.code === 'PGRST205') {
        Alert.alert(
          'Database Migration Required',
          'The workload_capacity table does not exist yet. Please run the SQL migration script in your Supabase SQL Editor:\n\n' +
          'File: docs/supabase-create-workload-capacity.sql\n\n' +
          'After running the script, wait a few seconds for the schema cache to refresh, then try again.',
          [
            {
              text: 'OK',
              style: 'default',
            },
          ]
        );
      } else {
        Alert.alert('Error', error?.message || 'Failed to load workload information. Please try again.');
      }
    } finally {
      setWorkloadLoading(false);
    }
  };

  const handleUpdateCapacity = async () => {
    const capacity = parseInt(capacityInput, 10);
    if (isNaN(capacity) || capacity < 1) {
      Alert.alert('Invalid Input', 'Please enter a valid capacity number (minimum 1).');
      return;
    }

    try {
      setSavingCapacity(true);
      await updateWeeklyCapacity(capacity);
      await loadWorkloadInfo();
      setConfirmation('Weekly capacity updated');
    } catch (error) {
      console.error('[AdminPanel] Error updating capacity:', error);
      Alert.alert('Error', error.message || 'Failed to update capacity. Please try again.');
    } finally {
      setSavingCapacity(false);
    }
  };

  const handleResetWeekCount = async () => {
    Alert.alert(
      'Reset Week Count',
      'This will reset the current week\'s order count to 0. This is useful for testing weekly resets.\n\n' +
      'Note: This only resets the count for the current week. The capacity setting will remain unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setResettingWeek(true);
              await resetCurrentWeekCount();
              await loadWorkloadInfo();
              setConfirmation('Week count reset to 0');
            } catch (error) {
              console.error('[AdminPanel] Error resetting week count:', error);
              Alert.alert('Error', error.message || 'Failed to reset week count. Please try again.');
            } finally {
              setResettingWeek(false);
            }
          },
        },
      ]
    );
  };

  const handleCreateNextWeek = async () => {
    Alert.alert(
      'Create Next Week',
      'This will create a capacity record for next week (starting Monday). This simulates what happens when the week automatically resets.\n\n' +
      'The next week will inherit the current week\'s capacity setting and start with 0 orders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            try {
              setResettingWeek(true);
              await createNextWeekCapacity();
              await loadWorkloadInfo();
              setConfirmation('Next week capacity created');
            } catch (error) {
              console.error('[AdminPanel] Error creating next week:', error);
              Alert.alert('Error', error.message || 'Failed to create next week. Please try again.');
            } finally {
              setResettingWeek(false);
            }
          },
        },
      ]
    );
  };

  const loadTips = async () => {
    try {
      setTipsLoading(true);
      const allTips = await getAllTips();
      setTips(allTips || []);
    } catch (error) {
      console.error('[AdminPanel] Error loading tips:', error);
      Alert.alert('Error', 'Failed to load tips. Please try again.');
    } finally {
      setTipsLoading(false);
    }
  };

  const handleCreateTip = () => {
    setEditingTip(null);
    setTipFormData({
      title: '',
      description: '',
      image_url: null,
      image_path: null,
      youtube_url: '',
      enabled: true,
      display_order: tips.length,
    });
    setShowTipForm(true);
  };

  const handleEditTip = (tip) => {
    setEditingTip(tip);
    setTipFormData({
      title: tip.title || '',
      description: tip.description || '',
      image_url: tip.image_url || null,
      image_path: tip.image_path || null,
      youtube_url: tip.youtube_url || '',
      enabled: tip.enabled !== false,
      display_order: tip.display_order || 0,
    });
    setShowTipForm(true);
  };

  const handleUploadTipImage = async () => {
    try {
      setUploadingImage(true);
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false,
        quality: 0.85,
        maxWidth: 1500,
      });

      if (response.didCancel || !response.assets?.[0]) {
        setUploadingImage(false);
        return;
      }

      const asset = response.assets[0];
      if (!asset.uri) {
        setUploadingImage(false);
        return;
      }

      // Upload directly to Supabase Storage for tips
      const { supabase } = require('../lib/supabaseClient');
      const { SUPABASE_URL } = require('../config/env');
      const STORAGE_BUCKET = 'order-images'; // Using same bucket as orders

      // Get session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Not authenticated');
      }

      // Generate unique filename
      const fileExt = asset.fileName?.split('.').pop() || asset.type?.split('/')[1] || 'jpg';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileName = `${timestamp}_${randomId}.${fileExt}`;
      
      // Build storage path: tips/{tipId or 'new'}/{fileName}
      const tipId = editingTip?.id || 'new';
      const filePath = `tips/${tipId}/${fileName}`;

      // Create FormData for React Native
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: fileName,
      });

      // Upload using Supabase Storage REST API
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        let errorMessage = 'Upload failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get image URL from storage.');
      }

      setTipFormData((prev) => ({
        ...prev,
        image_url: urlData.publicUrl,
        image_path: filePath,
      }));
    } catch (error) {
      console.error('[AdminPanel] Error uploading tip image:', error);
      Alert.alert('Upload Error', error.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveTip = async () => {
    try {
      if (!tipFormData.title || !tipFormData.description) {
        Alert.alert('Error', 'Title and description are required.');
        return;
      }

      const adminId = state.currentUser?.id;
      if (!adminId) {
        Alert.alert('Error', 'Admin user ID not found');
        return;
      }

      if (editingTip) {
        await updateTip(editingTip.id, tipFormData);
        setConfirmation('Tip updated');
      } else {
        await createTip(tipFormData, adminId);
        setConfirmation('Tip created');
      }

      setShowTipForm(false);
      await loadTips();
    } catch (error) {
      console.error('[AdminPanel] Error saving tip:', error);
      Alert.alert('Error', error.message || 'Failed to save tip. Please try again.');
    }
  };

  const handleToggleTipEnabled = async (tip) => {
    try {
      await toggleTipEnabled(tip.id, !tip.enabled);
      await loadTips();
      setConfirmation(tip.enabled ? 'Tip disabled' : 'Tip enabled');
    } catch (error) {
      console.error('[AdminPanel] Error toggling tip:', error);
      Alert.alert('Error', 'Failed to update tip. Please try again.');
    }
  };

  const handleDeleteTip = (tip) => {
    Alert.alert(
      'Delete Tip',
      `Are you sure you want to delete "${tip.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTip(tip.id);
              await loadTips();
              setConfirmation('Tip deleted');
            } catch (error) {
              console.error('[AdminPanel] Error deleting tip:', error);
              Alert.alert('Error', 'Failed to delete tip. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Helper functions for California timezone (PST/PDT)
  const formatCaliforniaDateTime = (dateString) => {
    if (!dateString) return '';
    // Ensure the date string is parsed as UTC
    // If the string doesn't have timezone info (no 'Z', '+', or '-' after the date), append 'Z' to force UTC parsing
    let date;
    if (typeof dateString === 'string' && dateString.includes('T')) {
      // Check if it has timezone info
      const hasTimezone = dateString.includes('Z') || 
                         dateString.includes('+') || 
                         (dateString.match(/-/g) || []).length > 2; // More than 2 dashes means timezone offset
      if (!hasTimezone) {
        // Date string like "2025-11-20T21:00" or "2025-11-20T21:00:00" - add 'Z' to force UTC parsing
        date = new Date(dateString + 'Z');
      } else {
        date = new Date(dateString);
      }
    } else {
      date = new Date(dateString);
    }
    // Format in California timezone
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
    // Parse the stored ISO string
    const storedDate = new Date(storedDateString);
    // Get the California time components
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
    // Create a date in local time with the California time values
    // This makes the picker show the correct time when opened
    return new Date(year, month, day, hour, minute);
  };

  const convertLocalDateToISOForStorage = (localDate) => {
    // The picker gives us a Date object in local time, but we interpret it as California time
    // Get the time components (year, month, day, hour, minute)
    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    const day = localDate.getDate();
    const hour = localDate.getHours();
    const minute = localDate.getMinutes();
    
    // We need to create a UTC date that, when displayed in California timezone, shows this time
    // Get timezone offset for California on this specific date
    // Create a test UTC date at noon on this day to check if it's PST or PDT
    const testUTC = new Date(Date.UTC(year, month, day, 12, 0));
    const caTestStr = testUTC.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'short',
    });
    const isPDT = caTestStr.includes('PDT');
    const offsetHours = isPDT ? 7 : 8; // PDT is UTC-7, PST is UTC-8
    
    // Convert California time to UTC by ADDING the offset hours
    // Example: If it's 1pm PST (UTC-8), UTC is 1pm + 8 hours = 9pm UTC (13 + 8 = 21)
    // Example: If it's 1pm PDT (UTC-7), UTC is 1pm + 7 hours = 8pm UTC (13 + 7 = 20)
    let utcHour = hour + offsetHours;
    let utcDay = day;
    let utcMonth = month;
    let utcYear = year;
    
    // Handle hour overflow
    if (utcHour >= 24) {
      utcHour = utcHour - 24;
      utcDay = utcDay + 1;
      // Handle day overflow
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
    
    // Create UTC date and return as ISO string with 'Z' suffix to ensure UTC parsing
    const utcDate = new Date(Date.UTC(utcYear, utcMonth, utcDay, utcHour, minute));
    // Return full ISO string with 'Z' to ensure it's always parsed as UTC
    return utcDate.toISOString();
  };

  // Notification handlers
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
    // Parse stored dates for the picker - these should show the correct time when opened
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

      // Format dates for API
      // The dates are already in UTC format (from convertLocalDateToISOForStorage)
      // But they may not have 'Z' suffix, so we need to ensure they're parsed as UTC
      let sendAt = null;
      if (notificationFormData.send_at) {
        const dateStr = notificationFormData.send_at;
        // If it doesn't have timezone info, append 'Z' to force UTC parsing
        const utcDateStr = dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)
          ? dateStr + 'Z'
          : dateStr;
        sendAt = new Date(utcDateStr).toISOString();
      }
      let expireAt = null;
      if (notificationFormData.expire_at) {
        const dateStr = notificationFormData.expire_at;
        // If it doesn't have timezone info, append 'Z' to force UTC parsing
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
        setConfirmation('Notification updated');
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
        setConfirmation('Notification created');
      }

      setShowNotificationForm(false);
      await loadNotifications();
    } catch (error) {
      console.error('[AdminPanel] Error saving notification:', error);
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
              setConfirmation('Notification deleted');
            } catch (error) {
              console.error('[AdminPanel] Error deleting notification:', error);
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
      setConfirmation(`Notification ${newStatus}`);
    } catch (error) {
      console.error('[AdminPanel] Error updating notification status:', error);
      Alert.alert('Error', 'Failed to update notification status. Please try again.');
    }
  };

  if (!isAdmin) {
    return null;
  }

  const adminSections = [
    {
      key: 'promoCodes',
      title: 'Manage Promo Codes',
      description: 'Create and manage promotional codes',
      icon: 'tag',
      onPress: () => {
        setActiveView('promoCodes');
      },
    },
    {
      key: 'shapes',
      title: 'Manage Shapes',
      description: 'Configure nail shapes and prices',
      icon: 'shape',
      onPress: () => {
        setActiveView('shapes');
      },
    },
    {
      key: 'deliveryMethods',
      title: 'Manage Delivery Methods',
      description: 'Configure delivery options and pricing',
      icon: 'truck',
      onPress: () => {
        setActiveView('deliveryMethods');
      },
    },
    {
      key: 'users',
      title: 'Manage Users',
      description: 'View and manage user accounts',
      icon: 'users',
      onPress: () => {
        console.log('[AdminPanel] Opening Manage Users view');
        // Show Manage Users view within the Admin Panel
        setActiveView('manageUsers');
      },
    },
    {
      key: 'workload',
      title: 'Manage Workload',
      description: 'Set weekly order capacity',
      icon: 'note', // Using note icon as calendar icon doesn't exist
      onPress: () => {
        setActiveView('workload');
      },
    },
    {
      key: 'notifications',
      title: 'Manage Notifications',
      description: 'Create and schedule global notifications',
      icon: 'bell',
      onPress: () => {
        setActiveView('notifications');
      },
    },
    {
      key: 'tips',
      title: 'Manage Tips',
      description: 'Configure tips displayed on home screen',
      icon: 'info',
      onPress: () => {
        setActiveView('tips');
      },
    },
    {
      key: 'theme',
      title: 'Theme Selector',
      description: 'Select the active app theme for all users',
      icon: 'palette',
      onPress: () => {
        setActiveView('theme');
      },
    },
    {
      key: 'feedback',
      title: 'Customer Feedback',
      description: 'View customer reviews and ratings',
      icon: 'star',
      onPress: () => {
        setActiveView('feedback');
      },
    },
  ];

  const primaryFont = colors.primaryFont || '#220707';
  const onSurface = colors.onSurface || primaryFont; // Use onSurface for text on surface backgrounds
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';
  const warningColor = colors.warning || '#FF9800';

  // Helper functions for notifications
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

  const getStatusColor = (status, accentColor, warningColor, secondaryFontColor) => {
    switch (status) {
      case 'published':
        return withOpacity(accentColor, 0.1);
      case 'scheduled':
        return withOpacity(warningColor, 0.1);
      case 'paused':
        return withOpacity(warningColor, 0.1);
      case 'archived':
        return withOpacity(secondaryFontColor, 0.1);
      default:
        return withOpacity(borderColor, 0.2);
    }
  };

  const getStatusTextColor = (status, accentColor, warningColor) => {
    switch (status) {
      case 'published':
        return accentColor;
      case 'scheduled':
      case 'paused':
        return warningColor;
      default:
        return secondaryFont;
    }
  };

  // If User Detail view is active, render it inline
  if (activeView === 'userDetail' && selectedUserId) {
    return (
      <UserDetailScreen
        route={{ params: { userId: selectedUserId } }}
        navigation={{
          ...navigation,
          goBack: () => {
            // Go back to Manage Users view
            setActiveView('manageUsers');
            // Keep selectedUserId so if user re-enters quickly it's still there
          },
        }}
      />
    );
  }

  // If a dedicated view is active, render it inline
  if (activeView === 'manageUsers') {
    return (
      <ManageUsersScreen
        navigation={{
          ...navigation,
          goBack: () => {
            // Go back to main Admin Panel
            setActiveView('main');
            setSelectedUserId(null); // Clear selected user when leaving Manage Users
          },
          navigate: (screen, params) => {
            // Override navigate to handle UserDetail inline
            if (screen === 'UserDetail' && params?.userId) {
              setSelectedUserId(params.userId);
              setActiveView('userDetail');
            } else {
              // For other screens, use normal navigation
              navigation.navigate(screen, params);
            }
          },
        }}
      />
    );
  }

  if (activeView === 'promoCodes') {
    return (
      <ManagePromoCodesScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  if (activeView === 'workload') {
    return (
      <ManageWorkloadScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  if (activeView === 'notifications') {
    return (
      <ManageNotificationsScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  if (activeView === 'tips') {
    return (
      <ManageTipsScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  if (activeView === 'theme') {
    return (
      <ManageThemeScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  if (activeView === 'shapes') {
    return (
      <ManageShapesScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  if (activeView === 'deliveryMethods') {
    return (
      <ManageDeliveryMethodsScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  if (activeView === 'feedback') {
    return (
      <ManageFeedbackScreen
        navigation={{
          ...navigation,
          goBack: () => {
            setActiveView('main');
          },
        }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronRight" color={primaryFont} size={20} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Admin Panel</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.listContainer}>
          {adminSections.map((item, index) => (
            <View key={item.key}>
              <TouchableOpacity
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                accessibilityHint={item.description}
                accessibilityState={item.expandable ? { expanded: Boolean(item.expanded) } : undefined}
                style={[styles.listRow, index === 0 && styles.listRowFirst]}
                activeOpacity={0.75}
              >
                <View style={[styles.rowIcon, { backgroundColor: withOpacity(accent, 0.08) }]}>
                  <Icon name={item.icon} color={accent} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowTitle, { color: primaryFont }]}>{item.title}</Text>
                  {item.description ? (
                    <Text style={[styles.rowDescription, { color: secondaryFont }]}>{item.description}</Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.rowAccessory,
                    item.expandable && item.expanded && styles.rowAccessoryExpanded,
                  ]}
                >
                  <Icon name="chevronRight" color={secondaryFont} />
                </View>
              </TouchableOpacity>

              {item.expandable && item.expanded ? (
                <View style={styles.rowExpansion}>
                  {item.key === 'promoCodes' ? (
                    <View style={styles.promoCodesSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: primaryFont }]}>Promo Codes</Text>
                        <TouchableOpacity
                          onPress={handleCreatePromo}
                          style={[styles.addButton, { backgroundColor: accent }]}
                        >
                          <Icon name="plus" color={colors.accentContrast || '#FFFFFF'} size={16} />
                          <Text style={[styles.addButtonText, { color: colors.accentContrast || '#FFFFFF' }]}>
                            Create
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {loading ? (
                        <ActivityIndicator size="large" color={accent} style={styles.loader} />
                      ) : promoCodes.length === 0 ? (
                        <Text style={[styles.emptyText, { color: secondaryFont }]}>
                          No promo codes yet. Create one to get started.
                        </Text>
                      ) : (
                        <View style={styles.promoList}>
                          {promoCodes.map((promo) => (
                            <View
                              key={promo.id}
                              style={[
                                styles.promoCard,
                                {
                                  backgroundColor: surface,
                                  borderColor: withOpacity(borderColor, 0.5),
                                },
                              ]}
                            >
                              <View style={styles.promoCardHeader}>
                                <View style={styles.promoCardTitleRow}>
                                  <Text style={[styles.promoCode, { color: accent }]}>{promo.code}</Text>
                                  <TouchableOpacity
                                    onPress={() => handleToggleActive(promo)}
                                    style={[
                                      styles.toggleButton,
                                      {
                                        backgroundColor: promo.active
                                          ? withOpacity(accent, 0.1)
                                          : withOpacity(borderColor, 0.2),
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.toggleText,
                                        {
                                          color: promo.active ? accent : secondaryFont,
                                        },
                                      ]}
                                    >
                                      {promo.active ? 'Active' : 'Inactive'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                                {promo.description && (
                                  <Text style={[styles.promoDescription, { color: secondaryFont }]}>
                                    {promo.description}
                                  </Text>
                                )}
                              </View>

                              <View style={styles.promoDetails}>
                                <Text style={[styles.promoDetail, { color: secondaryFont }]}>
                                  Type: {formatPromoType(promo.type)}
                                  {promo.value !== null && promo.value !== undefined && (
                                    <>
                                      {' • '}
                                      {promo.type === 'percentage'
                                        ? `${promo.value}%`
                                        : `$${Number(promo.value).toFixed(2)}`}
                                    </>
                                  )}
                                </Text>
                                {promo.uses_count !== undefined && (
                                  <Text style={[styles.promoDetail, { color: secondaryFont }]}>
                                    Uses: {promo.uses_count}
                                    {promo.max_uses ? ` / ${promo.max_uses}` : ''}
                                  </Text>
                                )}
                              </View>

                              <View style={styles.promoActions}>
                                <TouchableOpacity
                                  onPress={() => handleEditPromo(promo)}
                                  style={[styles.actionButton, { borderColor: withOpacity(borderColor, 0.5) }]}
                                >
                                  <Text style={[styles.actionButtonText, { color: primaryFont }]}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleDeletePromo(promo)}
                                  style={[styles.actionButton, { borderColor: withOpacity(colors.error || '#B33A3A', 0.5) }]}
                                >
                                  <Text style={[styles.actionButtonText, { color: colors.error || '#B33A3A' }]}>
                                    Delete
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : null}

                  {item.key === 'workload' ? (
                    <View style={styles.workloadSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: primaryFont }]}>Weekly Capacity</Text>
                      </View>

                      {workloadLoading ? (
                        <ActivityIndicator size="large" color={accent} style={styles.loader} />
                      ) : workloadInfo ? (
                        <View style={styles.workloadInfo}>
                          <View style={styles.workloadStatRow}>
                            <Text style={[styles.workloadLabel, { color: secondaryFont }]}>Current Weekly Capacity:</Text>
                            <Text style={[styles.workloadValue, { color: primaryFont }]}>
                              {workloadInfo.weeklyCapacity} orders
                            </Text>
                          </View>
                          <View style={styles.workloadStatRow}>
                            <Text style={[styles.workloadLabel, { color: secondaryFont }]}>Orders Submitted This Week:</Text>
                            <Text style={[styles.workloadValue, { color: primaryFont }]}>
                              {workloadInfo.ordersCount}
                            </Text>
                          </View>
                          <View style={styles.workloadStatRow}>
                            <Text style={[styles.workloadLabel, { color: secondaryFont }]}>Remaining Capacity:</Text>
                            <Text
                              style={[
                                styles.workloadValue,
                                {
                                  color:
                                    workloadInfo.remaining <= 3
                                      ? warningColor || '#FF9800'
                                      : workloadInfo.remaining <= 0
                                      ? colors.error || '#B33A3A'
                                      : accent,
                                  fontWeight: '700',
                                },
                              ]}
                            >
                              {workloadInfo.remaining} orders
                            </Text>
                          </View>
                          <View style={styles.workloadStatRow}>
                            <Text style={[styles.workloadLabel, { color: secondaryFont }]}>Current Week Start:</Text>
                            <Text style={[styles.workloadValue, { color: primaryFont }]}>
                              {workloadInfo.weekStart
                                ? new Date(workloadInfo.weekStart).toLocaleDateString() + ' at 9:00 AM PST'
                                : '—'}
                            </Text>
                          </View>
                          <View style={styles.workloadStatRow}>
                            <Text style={[styles.workloadLabel, { color: secondaryFont }]}>Next Week Opens:</Text>
                            <Text style={[styles.workloadValue, { color: primaryFont, fontWeight: '700' }]}>
                              {workloadInfo.nextWeekStart
                                ? formatNextWeekStartForAdmin(getNextWeekStartDateTime())
                                : '—'}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.workloadEditSection}>
                        <Text style={[styles.formLabel, { color: primaryFont }]}>Update Weekly Capacity</Text>
                        <View style={styles.capacityInputRow}>
                          <TextInput
                            style={[
                              styles.capacityInput,
                              {
                                borderColor: withOpacity(borderColor, 0.5),
                                color: primaryFont,
                              },
                            ]}
                            value={capacityInput}
                            onChangeText={setCapacityInput}
                            placeholder="50"
                            keyboardType="number-pad"
                          />
                          <PrimaryButton
                            label={savingCapacity ? 'Saving...' : 'Save'}
                            onPress={handleUpdateCapacity}
                            disabled={savingCapacity || !capacityInput.trim()}
                            style={styles.saveCapacityButton}
                          />
                        </View>
                        <Text style={[styles.helpText, { color: secondaryFont }]}>
                          Set how many orders can be accepted per week. Capacity resets automatically each Monday at 9:00 AM PST.
                        </Text>
                      </View>

                      {/* Testing/Admin Controls */}
                      <View style={styles.workloadTestingSection}>
                        <Text style={[styles.testingSectionTitle, { color: primaryFont }]}>
                          Testing Controls
                        </Text>
                        <Text style={[styles.helpText, { color: secondaryFont, marginBottom: 12 }]}>
                          Use these controls to test weekly reset behavior without waiting for Monday.
                        </Text>
                        <View style={styles.testingButtonsRow}>
                          <TouchableOpacity
                            onPress={handleResetWeekCount}
                            disabled={resettingWeek || workloadLoading}
                            style={[
                              styles.testingButton,
                              {
                                backgroundColor: withOpacity(warningColor, 0.1),
                                borderColor: withOpacity(warningColor, 0.3),
                              },
                            ]}
                          >
                            <Text style={[styles.testingButtonText, { color: warningColor }]}>
                              {resettingWeek ? 'Resetting...' : 'Reset Week Count'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleCreateNextWeek}
                            disabled={resettingWeek || workloadLoading}
                            style={[
                              styles.testingButton,
                              {
                                backgroundColor: withOpacity(accent, 0.1),
                                borderColor: withOpacity(accent, 0.3),
                              },
                            ]}
                          >
                            <Text style={[styles.testingButtonText, { color: accent }]}>
                              {resettingWeek ? 'Creating...' : 'Create Next Week'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.helpText, { color: secondaryFont, fontSize: 11, marginTop: 8 }]}>
                          Reset Week Count: Sets current week's order count to 0.{'\n'}
                          Create Next Week: Creates next week's capacity record (simulates Monday reset).
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {item.key === 'tips' ? (
                    <View style={styles.tipsSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: primaryFont }]}>Tips</Text>
                        <TouchableOpacity
                          onPress={handleCreateTip}
                          style={[styles.addButton, { backgroundColor: accent }]}
                        >
                          <Icon name="plus" color={colors.accentContrast || '#FFFFFF'} size={16} />
                          <Text style={[styles.addButtonText, { color: colors.accentContrast || '#FFFFFF' }]}>
                            Create
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {tipsLoading ? (
                        <ActivityIndicator size="large" color={accent} style={styles.loader} />
                      ) : tips.length === 0 ? (
                        <Text style={[styles.emptyText, { color: secondaryFont }]}>
                          No tips yet. Create one to get started.
                        </Text>
                      ) : (
                        <View style={styles.tipsList}>
                          {tips.map((tip) => (
                            <View
                              key={tip.id}
                              style={[
                                styles.tipCard,
                                {
                                  backgroundColor: surface,
                                  borderColor: withOpacity(borderColor, 0.5),
                                },
                              ]}
                            >
                              <View style={styles.tipCardHeader}>
                                <View style={styles.tipCardTitleRow}>
                                  <Text style={[styles.tipTitle, { color: primaryFont }]}>{tip.title}</Text>
                                  <TouchableOpacity
                                    onPress={() => handleToggleTipEnabled(tip)}
                                    style={[
                                      styles.toggleButton,
                                      {
                                        backgroundColor: tip.enabled
                                          ? withOpacity(accent, 0.1)
                                          : withOpacity(borderColor, 0.2),
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.toggleText,
                                        {
                                          color: tip.enabled ? accent : secondaryFont,
                                        },
                                      ]}
                                    >
                                      {tip.enabled ? 'Enabled' : 'Disabled'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                                {tip.description && (
                                  <Text style={[styles.tipDescription, { color: secondaryFont }]} numberOfLines={2}>
                                    {tip.description}
                                  </Text>
                                )}
                                {tip.image_url && (
                                  <View style={styles.tipImagePreview}>
                                    <Image
                                      source={{ uri: tip.image_url }}
                                      style={styles.tipImageThumbnail}
                                      resizeMode="cover"
                                    />
                                  </View>
                                )}
                                {tip.youtube_url && (
                                  <Text style={[styles.tipYoutube, { color: accent }]} numberOfLines={1}>
                                    Video: {tip.youtube_url}
                                  </Text>
                                )}
                              </View>

                              <View style={styles.tipActions}>
                                <TouchableOpacity
                                  onPress={() => handleEditTip(tip)}
                                  style={[styles.actionButton, { borderColor: withOpacity(borderColor, 0.5) }]}
                                >
                                  <Text style={[styles.actionButtonText, { color: primaryFont }]}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleDeleteTip(tip)}
                                  style={[styles.actionButton, { borderColor: withOpacity(colors.error || '#B33A3A', 0.5) }]}
                                >
                                  <Text style={[styles.actionButtonText, { color: colors.error || '#B33A3A' }]}>
                                    Delete
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : null}

                  {item.key === 'notifications' ? (
                    <View style={styles.notificationsSection}>
                      <View style={styles.sectionHeaderRow}>
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

                      {notificationsLoading ? (
                        <ActivityIndicator size="large" color={accent} style={styles.loader} />
                      ) : notifications.length === 0 ? (
                        <Text style={[styles.emptyText, { color: secondaryFont }]}>
                          No notifications yet. Create one to get started.
                        </Text>
                      ) : (
                        <View style={styles.notificationsList}>
                          {notifications.map((notification) => (
                            <View
                              key={notification.id}
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
                                  <View style={styles.notificationStatusRow}>
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
                                          backgroundColor: getStatusColor(notification.status, accent, warningColor, secondaryFont),
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.statusButtonText,
                                          {
                                            color: getStatusTextColor(notification.status, accent, warningColor),
                                          },
                                        ]}
                                      >
                                        {formatStatus(notification.status)}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
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
                          ))}
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      {confirmation ? (
        <View style={[styles.toast, { backgroundColor: withOpacity(accent, 0.92) }]}>
          <Text style={[styles.toastText, { color: colors.accentContrast || '#FFFFFF' }]}>{confirmation}</Text>
        </View>
      ) : null}

      {/* Promo Code Form Modal */}
      <Modal visible={showPromoForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryFont }]}>
                {editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}
              </Text>
              <TouchableOpacity onPress={() => setShowPromoForm(false)}>
                <Icon name="close" color={primaryFont} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContent}>
              <Text style={[styles.formLabel, { color: primaryFont }]}>Code *</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={formData.code}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, code: text }))}
                placeholder="WELCOME10"
                autoCapitalize="characters"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Description</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={formData.description}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
                placeholder="10% off order"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Type *</Text>
              <View style={styles.typeButtons}>
                {['percentage', 'fixed_amount', 'free_shipping', 'free_order'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setFormData((prev) => ({ ...prev, type }))}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor:
                          formData.type === type
                            ? withOpacity(accent, 0.1)
                            : withOpacity(borderColor, 0.2),
                        borderColor:
                          formData.type === type ? accent : withOpacity(borderColor, 0.5),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        {
                          color: formData.type === type ? accent : primaryFont,
                        },
                      ]}
                    >
                      {formatPromoType(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {(formData.type === 'percentage' || formData.type === 'fixed_amount' || formData.type === 'fixed_price_item') && (
                <>
                  <Text style={[styles.formLabel, { color: primaryFont }]}>
                    Value {formData.type === 'percentage' ? '(0-100)' : '($)'} *
                  </Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                    value={formData.value}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, value: text }))}
                    placeholder={formData.type === 'percentage' ? '10' : '5.00'}
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={[styles.formLabel, { color: primaryFont }]}>Min Order Amount ($)</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={formData.min_order_amount}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, min_order_amount: text }))}
                placeholder="25.00"
                keyboardType="numeric"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Start Date</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={formData.start_date}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, start_date: text }))}
                placeholder="YYYY-MM-DD"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>End Date</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={formData.end_date}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, end_date: text }))}
                placeholder="YYYY-MM-DD"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Max Uses</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={formData.max_uses}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, max_uses: text }))}
                placeholder="100"
                keyboardType="numeric"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Per User Limit</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={formData.per_user_limit}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, per_user_limit: text }))}
                placeholder="1"
                keyboardType="numeric"
              />

              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() => setFormData((prev) => ({ ...prev, combinable: !prev.combinable }))}
                  style={styles.checkboxContainer}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: formData.combinable ? accent : 'transparent',
                        borderColor: withOpacity(borderColor, 0.5),
                      },
                    ]}
                  >
                    {formData.combinable && <Icon name="check" color={colors.accentContrast || '#FFFFFF'} size={14} />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: primaryFont }]}>Combinable</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() => setFormData((prev) => ({ ...prev, active: !prev.active }))}
                  style={styles.checkboxContainer}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: formData.active ? accent : 'transparent',
                        borderColor: withOpacity(borderColor, 0.5),
                      },
                    ]}
                  >
                    {formData.active && <Icon name="check" color={colors.accentContrast || '#FFFFFF'} size={14} />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: primaryFont }]}>Active</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowPromoForm(false)}
                style={[styles.cancelButton, { borderColor: withOpacity(borderColor, 0.5) }]}
              >
                <Text style={[styles.cancelButtonText, { color: primaryFont }]}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton
                label={editingPromo ? 'Update' : 'Create'}
                onPress={handleSavePromo}
                disabled={!formData.code.trim() || (formData.value && !formData.value.trim())}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Tip Form Modal */}
      <Modal visible={showTipForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryFont }]}>
                {editingTip ? 'Edit Tip' : 'Create Tip'}
              </Text>
              <TouchableOpacity onPress={() => setShowTipForm(false)}>
                <Icon name="close" color={primaryFont} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContent}>
              <Text style={[styles.formLabel, { color: primaryFont }]}>Title *</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={tipFormData.title}
                onChangeText={(text) => setTipFormData((prev) => ({ ...prev, title: text }))}
                placeholder="How to prep your nails"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Description *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={tipFormData.description}
                onChangeText={(text) => setTipFormData((prev) => ({ ...prev, description: text }))}
                placeholder="Cleanse with alcohol wipes before applying press-ons for longer wear."
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Photo</Text>
              {tipFormData.image_url ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: tipFormData.image_url }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setTipFormData((prev) => ({ ...prev, image_url: null, image_path: null }))}
                    style={styles.removeImageButton}
                  >
                    <Icon name="close" color={colors.accentContrast || '#FFFFFF'} size={16} />
                  </TouchableOpacity>
                </View>
              ) : null}
              <TouchableOpacity
                onPress={handleUploadTipImage}
                disabled={uploadingImage}
                style={[
                  styles.uploadButton,
                  {
                    backgroundColor: uploadingImage
                      ? withOpacity(borderColor, 0.2)
                      : withOpacity(accent, 0.1),
                    borderColor: withOpacity(borderColor, 0.5),
                  },
                ]}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={accent} />
                ) : (
                  <>
                    <Icon name="image" color={accent} size={18} />
                    <Text style={[styles.uploadButtonText, { color: accent }]}>
                      {tipFormData.image_url ? 'Change Photo' : 'Upload Photo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={[styles.formLabel, { color: primaryFont }]}>YouTube Video URL (Optional)</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={tipFormData.youtube_url}
                onChangeText={(text) => setTipFormData((prev) => ({ ...prev, youtube_url: text }))}
                placeholder="https://www.youtube.com/watch?v=example"
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Display Order</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={String(tipFormData.display_order)}
                onChangeText={(text) => {
                  const order = parseInt(text, 10);
                  setTipFormData((prev) => ({ ...prev, display_order: isNaN(order) ? 0 : order }));
                }}
                placeholder="0"
                keyboardType="numeric"
              />

              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  onPress={() => setTipFormData((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  style={styles.checkboxContainer}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: tipFormData.enabled ? accent : 'transparent',
                        borderColor: withOpacity(borderColor, 0.5),
                      },
                    ]}
                  >
                    {tipFormData.enabled && <Icon name="check" color={colors.accentContrast || '#FFFFFF'} size={14} />}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: primaryFont }]}>Enabled</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowTipForm(false)}
                style={[styles.cancelButton, { borderColor: withOpacity(borderColor, 0.5) }]}
              >
                <Text style={[styles.cancelButtonText, { color: primaryFont }]}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton
                label={editingTip ? 'Update' : 'Create'}
                onPress={handleSaveTip}
                disabled={!tipFormData.title.trim() || !tipFormData.description.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>

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
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={notificationFormData.title}
                onChangeText={(text) => setNotificationFormData((prev) => ({ ...prev, title: text }))}
                placeholder="New promotion available"
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Message *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={notificationFormData.message}
                onChangeText={(text) => setNotificationFormData((prev) => ({ ...prev, message: text }))}
                placeholder="Get 20% off your next order with code SAVE20"
                multiline
                numberOfLines={4}
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>YouTube URL (optional)</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5) }]}
                value={notificationFormData.youtube_url}
                onChangeText={(text) => setNotificationFormData((prev) => ({ ...prev, youtube_url: text }))}
                placeholder="https://www.youtube.com/watch?v=..."
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
                style={[styles.formInput, styles.datePickerButton, { borderColor: withOpacity(borderColor, 0.5) }]}
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
                <View style={styles.iosPickerContainer}>
                  <View style={[styles.iosPickerHeader, { backgroundColor: surface, borderColor: borderColor }]}>
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
                style={[styles.formInput, styles.datePickerButton, { borderColor: withOpacity(borderColor, 0.5) }]}
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
                <View style={styles.iosPickerContainer}>
                  <View style={[styles.iosPickerHeader, { backgroundColor: surface, borderColor: borderColor }]}>
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
                style={[styles.cancelButton, { borderColor: withOpacity(borderColor, 0.5) }]}
              >
                <Text style={[styles.cancelButtonText, { color: primaryFont }]}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton
                label={editingNotification ? 'Update' : 'Create'}
                onPress={handleSaveNotification}
                disabled={!notificationFormData.title.trim() || !notificationFormData.message.trim()}
              />
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
    content: {
      flex: 1,
    },
    listContainer: {
      paddingVertical: 8,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: borderColor,
      backgroundColor: surface,
    },
    listRowFirst: {
      borderTopWidth: 0,
    },
    rowIcon: {
      height: 32,
      width: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
    },
    rowDescription: {
      fontSize: 13,
      lineHeight: 18,
    },
    rowAccessory: {
      marginLeft: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowAccessoryExpanded: {
      transform: [{ rotate: '90deg' }],
    },
    rowExpansion: {
      backgroundColor: surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: borderColor,
    },
    promoCodesSection: {
      padding: 20,
      gap: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    loader: {
      marginVertical: 40,
    },
    emptyText: {
      textAlign: 'center',
      marginVertical: 40,
      fontSize: 14,
    },
    promoList: {
      gap: 12,
    },
    workloadSection: {
      gap: 18,
      padding: 16,
    },
    tipsSection: {
      padding: 20,
      gap: 16,
    },
    tipsList: {
      gap: 12,
    },
    tipCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 16,
      gap: 12,
    },
    tipCardHeader: {
      gap: 8,
    },
    tipCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    tipTitle: {
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
    },
    tipDescription: {
      fontSize: 14,
      lineHeight: 20,
    },
    tipImagePreview: {
      marginTop: 8,
      borderRadius: 8,
      overflow: 'hidden',
      width: '100%',
      height: 120,
    },
    tipImageThumbnail: {
      width: '100%',
      height: '100%',
    },
    tipYoutube: {
      fontSize: 12,
      marginTop: 4,
    },
    tipActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    imagePreviewContainer: {
      position: 'relative',
      marginBottom: 12,
      borderRadius: 8,
      overflow: 'hidden',
      width: '100%',
      height: 200,
    },
    imagePreview: {
      width: '100%',
      height: '100%',
    },
    removeImageButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 16,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      gap: 8,
      marginBottom: 8,
    },
    uploadButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    workloadInfo: {
      gap: 12,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: withOpacity(borderColor, 0.3),
      backgroundColor: surface,
    },
    workloadStatRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    workloadLabel: {
      fontSize: 14,
      flex: 1,
    },
    workloadValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    workloadEditSection: {
      gap: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(borderColor, 0.3),
    },
    capacityInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    capacityInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
    },
    saveCapacityButton: {
      minWidth: 100,
    },
    helpText: {
      fontSize: 12,
      lineHeight: 16,
      marginTop: 4,
    },
    workloadTestingSection: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(borderColor, 0.3),
      gap: 8,
    },
    testingSectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
    },
    testingButtonsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    testingButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    testingButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
    promoCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    promoCardHeader: {
      marginBottom: 12,
    },
    promoCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    promoCode: {
      fontSize: 18,
      fontWeight: '700',
    },
    toggleButton: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    toggleText: {
      fontSize: 12,
      fontWeight: '600',
    },
    promoDescription: {
      fontSize: 14,
      marginTop: 4,
    },
    promoDetails: {
      marginBottom: 12,
      gap: 4,
    },
    promoDetail: {
      fontSize: 12,
    },
    promoActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    toast: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 24,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 14,
      shadowColor: colors.shadow || '#000000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      alignItems: 'center',
    },
    toastText: {
      fontSize: 13,
      fontWeight: '600',
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
    },
    typeButtonText: {
      fontSize: 12,
      fontWeight: '600',
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
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
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
      backgroundColor: surface,
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
    notificationsSection: {
      padding: 20,
      gap: 16,
    },
    notificationsList: {
      gap: 12,
    },
    notificationCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    notificationCardHeader: {
      marginBottom: 12,
    },
    notificationCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 8,
    },
    notificationTitle: {
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
    },
    notificationStatusRow: {
      flexDirection: 'row',
      gap: 8,
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
      marginBottom: 8,
      lineHeight: 20,
    },
    notificationMeta: {
      gap: 4,
      marginTop: 8,
    },
    notificationMetaText: {
      fontSize: 12,
    },
    notificationActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
  });
}

export default AdminPanelScreen;
