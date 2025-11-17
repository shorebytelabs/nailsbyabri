import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import { launchImageLibrary } from 'react-native-image-picker';

function OrdersScreen({ route }) {
  const initialTabFromRoute = route?.params?.initialTab;
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, setState, loadOrdersForUser, updateOrderAdmin } = useAppState();
  const currentUserId = state.currentUser?.id;
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

  const isAdmin = Boolean(state.currentUser?.isAdmin);
  const [hasRequestedOrders, setHasRequestedOrders] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('[OrdersScreen] Orders check:', {
        hasRequestedOrders,
        ordersLoaded: state.ordersLoaded,
        ordersLoading: state.ordersLoading,
        ordersCount: state.orders?.length || 0,
        currentUser: state.currentUser?.email,
        isAdmin,
      });
    }

    if (!hasRequestedOrders || (!state.ordersLoaded && !state.ordersLoading)) {
      if (!state.currentUser) {
        if (__DEV__) {
          console.log('[OrdersScreen] ⚠️  No current user, cannot load orders');
        }
        return;
      }
      if (__DEV__) {
        console.log('[OrdersScreen] 📥 Requesting orders for user:', state.currentUser.email, isAdmin ? '(admin)' : '(regular)');
      }
      setHasRequestedOrders(true);
      loadOrdersForUser(state.currentUser);
    }
  }, [isAdmin, loadOrdersForUser, state.ordersLoaded, state.ordersLoading, hasRequestedOrders, currentUserId, state.currentUser, state.orders]);

  const baseOrders = useMemo(() => {
    const map = new Map();

    // For all users (admin and regular), include orders from state.orders
    (state.orders || []).forEach((order) => {
      if (order && order.id && !map.has(order.id)) {
        map.set(order.id, order);
      }
    });

    // Also include locally cached orders (activeOrder, lastCompletedOrder) for all users
    const localOrders = [state.activeOrder, state.lastCompletedOrder];
    localOrders.forEach((order) => {
      if (order && order.id && !map.has(order.id)) {
        map.set(order.id, order);
      }
    });

    const items = Array.from(map.values());
    return items.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [state.activeOrder, state.lastCompletedOrder, state.orders]);

  const categorizedOrders = useMemo(() => {
    const drafts = [];
    const submitted = [];
    const completed = [];

    baseOrders.forEach((order) => {
      const status = (order.status || '').toLowerCase();
      if (status === 'draft') {
        drafts.push(order);
      } else if (status === 'completed' || status === 'delivered') {
        completed.push(order);
      } else {
        submitted.push(order);
      }
    });

    return {
      drafts,
      submitted,
      completed,
      all: baseOrders,
    };
  }, [baseOrders]);

  const [activeTab, setActiveTab] = useState(
    ['drafts', 'submitted', 'completed', 'all'].includes(initialTabFromRoute)
      ? initialTabFromRoute
      : 'drafts',
  );

  const tabs = useMemo(
    () => [
      { key: 'drafts', label: 'Cart', count: categorizedOrders.drafts.length },
      { key: 'submitted', label: 'Submitted', count: categorizedOrders.submitted.length },
      { key: 'completed', label: 'Delivered', count: categorizedOrders.completed.length },
      { key: 'all', label: 'All', count: categorizedOrders.all.length },
    ],
    [categorizedOrders],
  );

  const STATUS_FILTERS = useMemo(
    () => [
      { key: 'all', label: 'All statuses' },
      { key: 'draft', label: 'Draft' },
      { key: 'pending', label: 'Pending' },
      { key: 'in_progress', label: 'In progress' },
      { key: 'submitted', label: 'Submitted' },
      { key: 'completed', label: 'Completed' },
      { key: 'cancelled', label: 'Cancelled' },
    ],
    [],
  );

  const [selectedUserFilter, setSelectedUserFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [showAdminControls, setShowAdminControls] = useState(false);
  const [expandedAdminOrders, setExpandedAdminOrders] = useState({});
  const [adminDrafts, setAdminDrafts] = useState({});

  const userOptions = useMemo(() => {
    if (!isAdmin) {
      return [];
    }

    const map = new Map();
    baseOrders.forEach((order) => {
      const email = (order.user?.email || order.userEmail || '').toLowerCase();
      if (!email || map.has(email)) {
        return;
      }
      const name = order.user?.name || order.userName || order.customerName || email;
      map.set(email, { email, name });
    });

    return [{ email: 'all', name: 'All users' }, ...Array.from(map.values())];
  }, [baseOrders, isAdmin]);

  const filteredOrders = useMemo(() => {
    let results = categorizedOrders[activeTab] || categorizedOrders.drafts;

    if (isAdmin) {
      if (selectedStatusFilter !== 'all') {
        results = results.filter((order) => (order.status || '').toLowerCase() === selectedStatusFilter);
      }

      if (selectedUserFilter !== 'all') {
        results = results.filter((order) => {
          const email = (order.user?.email || order.userEmail || '').toLowerCase();
          return email === selectedUserFilter;
        });
      }
    }

    return results;
  }, [activeTab, categorizedOrders, isAdmin, selectedStatusFilter, selectedUserFilter]);

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

  const getOrderUserLabel = useCallback((order) => {
    if (!isAdmin) {
      return null;
    }
    const name = order.user?.name || order.userName || order.customerName;
    const email = order.user?.email || order.userEmail;
    if (name && email) {
      return `${name} • ${email}`;
    }
    return name || email || 'Unknown customer';
  }, [isAdmin]);

  const getAdminDraft = useCallback(
    (order) => {
      const existing = adminDrafts[order.id];
      if (existing) {
        return existing;
      }

      const storedImages = Array.isArray(order.adminImages)
        ? order.adminImages
            .filter(Boolean)
            .map((uri, index) => ({ id: `${order.id}_admin_${index}`, uri }))
        : [];

      const defaultDraft = {
        notes: order.adminNotes || '',
        images: storedImages,
        discount: order.discount !== undefined && order.discount !== null ? String(order.discount) : '',
        trackingNumber: order.trackingNumber || '',
        status: order.status || 'pending',
      };

      return defaultDraft;
    },
    [adminDrafts],
  );

  const handleAdminDraftChange = useCallback((orderId, field, value) => {
    setAdminDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [field]: value,
      },
    }));
  }, []);

  const handleAdminImageUpload = useCallback(
    async (order) => {
      try {
        const response = await launchImageLibrary({
          mediaType: 'photo',
          selectionLimit: 0,
          includeBase64: false,
        });

        if (response.didCancel || !Array.isArray(response.assets)) {
          return;
        }

        const newEntries = response.assets
          .filter((asset) => asset?.uri)
          .map((asset, index) => ({
            id:
              asset.assetId ||
              asset.fileName ||
              `${order.id}_upload_${Date.now()}_${index}`,
            uri: asset.uri,
          }));

        if (!newEntries.length) {
          return;
        }

        const baseDraft = getAdminDraft(order);

        setAdminDrafts((prev) => {
          const existingImages = (prev[order.id]?.images || baseDraft.images || []).filter(
            Boolean,
          );
          return {
            ...prev,
            [order.id]: {
              ...(prev[order.id] || baseDraft || {}),
              images: [...existingImages, ...newEntries],
            },
          };
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          statusMessage: 'Unable to add images. Please try again.',
        }));
      }
    },
    [getAdminDraft, setState],
  );

  const handleAdminImageRemove = useCallback((orderId, imageId) => {
    setAdminDrafts((prev) => {
      const draft = prev[orderId];
      if (!draft || !Array.isArray(draft.images)) {
        return prev;
      }
      return {
        ...prev,
        [orderId]: {
          ...draft,
          images: draft.images.filter((image) => image?.id !== imageId),
        },
      };
    });
  }, []);

  const handleAdminStatusSelect = useCallback(
    async (order, nextStatus) => {
      if (!nextStatus) {
        return;
      }

      const previousStatus = getAdminDraft(order).status;
      if ((previousStatus || '').toLowerCase() === nextStatus.toLowerCase()) {
        return;
      }
      handleAdminDraftChange(order.id, 'status', nextStatus);

      try {
        await updateOrderAdmin(order.id, { status: nextStatus });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          statusMessage: error?.message || 'Unable to update status.',
        }));
        handleAdminDraftChange(order.id, 'status', previousStatus);
      }
    },
    [getAdminDraft, handleAdminDraftChange, updateOrderAdmin, setState],
  );

  const toggleAdminSection = useCallback((orderId) => {
    setExpandedAdminOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  }, []);

  const handleAdminSave = useCallback(
    async (order) => {
      const draft = getAdminDraft(order);
      try {
        const payload = {
          status: draft.status,
          adminNotes: draft.notes,
          adminImages: Array.isArray(draft.images)
            ? draft.images.map((image) => image?.uri).filter(Boolean)
            : [],
          trackingNumber: draft.trackingNumber || undefined,
        };

        if (draft.discount?.length) {
          payload.discount = Number(draft.discount);
        }

        const updated = await updateOrderAdmin(order.id, payload);
        setAdminDrafts((prev) => ({
          ...prev,
          [order.id]: {
            notes: updated.adminNotes || '',
            images:
              Array.isArray(updated.adminImages)
                ? updated.adminImages
                    .filter(Boolean)
                    .map((uri, index) => ({ id: `${order.id}_admin_${index}`, uri }))
                : [],
            discount:
              updated.discount !== undefined && updated.discount !== null
                ? String(updated.discount)
                : '',
            trackingNumber: updated.trackingNumber || '',
            status: updated.status || draft.status,
          },
        }));
      } catch (error) {
        // errors handled via context status message
      }
    },
    [getAdminDraft, updateOrderAdmin],
  );

  const renderOrderCard = (order) => {
    const primarySet = order.nailSets?.[0];
    const needsFollowUp = order.nailSets?.some((set) => set.requiresFollowUp);
    const status = (order.status || '').toLowerCase();
    const adminDraft = getAdminDraft(order);
    const adminImages = Array.isArray(adminDraft.images) ? adminDraft.images : [];
    let statusLabel = 'Submitted';
    let statusBackground = withOpacity(accentColor, 0.12);
    let statusTextColor = accentColor;

    switch (status) {
      case 'draft':
        statusLabel = 'Draft';
        statusBackground = withOpacity(secondaryBackgroundColor, 0.2);
        break;
      case 'pending':
        statusLabel = 'Pending';
        statusBackground = withOpacity(accentColor, 0.1);
        break;
      case 'in_progress':
        statusLabel = 'In progress';
        statusBackground = withOpacity(accentColor, 0.12);
        break;
      case 'completed':
      case 'delivered':
        statusLabel = 'Completed';
        statusBackground = withOpacity(accentColor, 0.18);
        break;
      case 'cancelled':
        statusLabel = 'Cancelled';
        statusBackground = withOpacity('#B33A3A', 0.12);
        statusTextColor = '#B33A3A';
        break;
      default:
        break;
    }

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
                { color: statusTextColor },
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
        {isAdmin ? (
          <Text
            style={[
              styles.cardMetaSecondary,
              { color: secondaryFontColor },
            ]}
          >
            {getOrderUserLabel(order)}
          </Text>
        ) : null}
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
        {isAdmin && showAdminControls ? (
          <View style={styles.adminSection}>
            <TouchableOpacity
              onPress={() => toggleAdminSection(order.id)}
              style={[
                styles.adminSectionToggle,
                {
                  borderColor: withOpacity(borderColor, 0.6),
                  backgroundColor: withOpacity(surfaceColor, 0.8),
                },
              ]}
            >
              <Text style={[styles.adminSectionToggleText, { color: accentColor }]}>
                {expandedAdminOrders[order.id] ? 'Hide admin controls' : 'Show admin controls'}
              </Text>
            </TouchableOpacity>
            {expandedAdminOrders[order.id] ? (
              <View style={styles.adminForm}>
                <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Notes</Text>
                <TextInput
                  value={adminDraft.notes}
                  onChangeText={(value) => handleAdminDraftChange(order.id, 'notes', value)}
                  placeholder="Add internal comments"
                  placeholderTextColor={withOpacity(secondaryFontColor, 0.5)}
                  style={[
                    styles.adminInput,
                    {
                      borderColor: withOpacity(borderColor, 0.6),
                      color: primaryFontColor,
                    },
                  ]}
                  multiline
                />

                <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Upload images</Text>
                <View style={styles.adminUploadsRow}>
                  {adminImages.length ? (
                    adminImages.map((image) => (
                      <View
                        key={image.id}
                        style={[
                          styles.adminImageWrapper,
                          {
                            borderColor: withOpacity(borderColor, 0.6),
                            backgroundColor: withOpacity(surfaceColor, 0.6),
                          },
                        ]}
                      >
                        <Image source={{ uri: image.uri }} style={styles.adminImage} />
                        <TouchableOpacity
                          onPress={() => handleAdminImageRemove(order.id, image.id)}
                          style={[
                            styles.adminImageRemove,
                            {
                              backgroundColor: withOpacity(primaryBackgroundColor, 0.9),
                            },
                          ]}
                        >
                          <Text style={[styles.adminImageRemoveText, { color: accentColor }]}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  ) : (
                    <View
                      style={[
                        styles.adminEmptyUpload,
                        {
                          borderColor: withOpacity(borderColor, 0.6),
                          backgroundColor: withOpacity(surfaceColor, 0.6),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.adminEmptyUploadText,
                          { color: secondaryFontColor },
                        ]}
                      >
                        No images uploaded yet
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => handleAdminImageUpload(order)}
                    style={[
                      styles.adminImageAddButton,
                      {
                        borderColor: withOpacity(accentColor, 0.5),
                        backgroundColor: withOpacity(accentColor, 0.1),
                      },
                    ]}
                  >
                    <Text style={[styles.adminImageAddText, { color: accentColor }]}>+ Add images</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.adminField}>
                  <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Discount</Text>
                  <TextInput
                    value={adminDraft.discount}
                    onChangeText={(value) => handleAdminDraftChange(order.id, 'discount', value)}
                    placeholder="0.00"
                    placeholderTextColor={withOpacity(secondaryFontColor, 0.5)}
                    keyboardType="decimal-pad"
                    style={[
                      styles.adminInput,
                      {
                        borderColor: withOpacity(borderColor, 0.6),
                        color: primaryFontColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.adminField}>
                  <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Tracking number</Text>
                  <TextInput
                    value={adminDraft.trackingNumber}
                    onChangeText={(value) => handleAdminDraftChange(order.id, 'trackingNumber', value)}
                    placeholder="Enter tracking number"
                    placeholderTextColor={withOpacity(secondaryFontColor, 0.5)}
                    style={[
                      styles.adminInput,
                      {
                        borderColor: withOpacity(borderColor, 0.6),
                        color: primaryFontColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.adminStatusRow}>
                  <Text style={[styles.adminLabel, { color: primaryFontColor }]}>Status</Text>
                  <View style={styles.adminStatusChips}>
                    {STATUS_FILTERS.filter((filter) => filter.key !== 'all').map((filter) => {
                      const isSelected = adminDraft.status?.toLowerCase() === filter.key;
                      return (
                        <TouchableOpacity
                          key={filter.key}
                          onPress={() => handleAdminStatusSelect(order, filter.key)}
                          style={[
                            styles.adminStatusChip,
                            {
                              borderColor: isSelected
                                ? accentColor
                                : withOpacity(borderColor, 0.6),
                              backgroundColor: isSelected
                                ? withOpacity(accentColor, 0.12)
                                : surfaceColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.adminStatusChipLabel,
                              { color: isSelected ? accentColor : secondaryFontColor },
                            ]}
                          >
                            {filter.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.adminActionsRow}>
                  <TouchableOpacity
                    onPress={() => handleAdminSave(order)}
                    style={[
                      styles.adminSaveButton,
                      {
                        backgroundColor: accentColor,
                      },
                    ]}
                  >
                    <Text style={[styles.adminSaveButtonText, { color: surfaceColor }]}>Save changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
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
        !isAdmin
          ? (
              <RefreshControl
                tintColor={accentColor}
                refreshing={false}
                onRefresh={() => {
                  // Consent flow removed - no refresh needed
                }}
              />
            )
          : undefined
      }
      bounces={!isAdmin}
      alwaysBounceVertical={!isAdmin}
      overScrollMode={isAdmin ? 'never' : 'auto'}
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

      {isAdmin ? (
        <View
          style={[
            styles.adminToolbar,
            {
              borderColor: withOpacity(borderColor, 0.4),
              backgroundColor: withOpacity(surfaceColor, 0.9),
            },
          ]}
        >
          <View style={styles.adminToggleRow}>
            <Text style={[styles.adminToggleLabel, { color: primaryFontColor }]}>Show admin controls</Text>
            <Switch
              value={showAdminControls}
              onValueChange={setShowAdminControls}
              trackColor={{ false: withOpacity(borderColor, 0.6), true: withOpacity(accentColor, 0.4) }}
              thumbColor={showAdminControls ? accentColor : surfaceColor}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminFilterRow}>
            {STATUS_FILTERS.map((filter) => {
              const isSelected = selectedStatusFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setSelectedStatusFilter(filter.key)}
                  style={[
                    styles.adminFilterChip,
                    {
                      borderColor: isSelected ? accentColor : withOpacity(borderColor, 0.6),
                      backgroundColor: isSelected ? withOpacity(accentColor, 0.14) : surfaceColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.adminFilterChipLabel,
                      { color: isSelected ? accentColor : secondaryFontColor },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminFilterRow}>
            {userOptions.map((option) => {
              const isSelected = selectedUserFilter === option.email;
              return (
                <TouchableOpacity
                  key={option.email}
                  onPress={() => setSelectedUserFilter(option.email)}
                  style={[
                    styles.adminFilterChip,
                    {
                      borderColor: isSelected ? accentColor : withOpacity(borderColor, 0.6),
                      backgroundColor: isSelected ? withOpacity(accentColor, 0.14) : surfaceColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.adminFilterChipLabel,
                      { color: isSelected ? accentColor : secondaryFontColor },
                    ]}
                  >
                    {option.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.sectionContent}>
        {state.ordersError ? (
          <View
            style={[
              styles.placeholder,
              {
                borderColor: accentColor,
                backgroundColor: withOpacity(accentColor, 0.1),
              },
            ]}
          >
            <Text
              style={[
                styles.placeholderTitle,
                { color: accentColor },
              ]}
            >
              Error loading orders
            </Text>
            <Text
              style={[
                styles.placeholderSubtitle,
                { color: secondaryFontColor },
              ]}
            >
              {state.ordersError}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (state.currentUser) {
                  loadOrdersForUser(state.currentUser);
                }
              }}
              style={[
                styles.retryButton,
                { borderColor: accentColor },
              ]}
            >
              <Text style={[styles.retryButtonText, { color: accentColor }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : state.ordersLoading ? (
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
              Loading orders...
            </Text>
          </View>
        ) : filteredOrders.length ? (
          filteredOrders.map(renderOrderCard)
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
                : isAdmin
                ? 'No orders found. Create a test order to verify the system is working.'
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
  cardMetaSecondary: {
    fontSize: 12,
    marginTop: 4,
  },
  cardFooter: {
    marginTop: 12,
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
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  adminToolbar: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    gap: 10,
    marginHorizontal: 20,
  },
  adminToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  adminFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  adminFilterChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  adminFilterChipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  adminSection: {
    marginTop: 16,
    gap: 12,
  },
  adminSectionToggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  adminSectionToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  adminForm: {
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  adminUploadsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  adminImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  adminImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  adminImageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminImageRemoveText: {
    fontSize: 14,
    fontWeight: '700',
  },
  adminEmptyUpload: {
    minWidth: 160,
    minHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  adminEmptyUploadText: {
    fontSize: 12,
    textAlign: 'center',
  },
  adminImageAddButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  adminImageAddText: {
    fontSize: 12,
    fontWeight: '700',
  },
  adminLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  adminInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  adminField: {
    gap: 6,
  },
  adminStatusRow: {
    gap: 8,
  },
  adminStatusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminStatusChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adminStatusChipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  adminActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  adminSaveButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  adminSaveButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default OrdersScreen;

