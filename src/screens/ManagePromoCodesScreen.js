/**
 * Manage Promo Codes Screen
 * Admin-only screen for viewing and managing promotional codes
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import PrimaryButton from '../components/PrimaryButton';
import FormField from '../components/FormField';

function ManagePromoCodesScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(null); // null = all, true = active, false = inactive
  const [refreshing, setRefreshing] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [showPromoForm, setShowPromoForm] = useState(false);
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
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadPromoCodes();
  }, [isAdmin, navigation]);

  const loadPromoCodes = useCallback(async () => {
    try {
      setLoading(true);
      const codes = await getAllPromoCodes();
      setPromoCodes(codes || []);
    } catch (error) {
      console.error('[ManagePromoCodes] Error loading promo codes:', error);
      Alert.alert('Error', 'Failed to load promo codes. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPromoCodes();
  }, [loadPromoCodes]);

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
  }, []);

  const handleActiveFilter = useCallback((active) => {
    setActiveFilter(active === activeFilter ? null : active);
  }, [activeFilter]);

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
      // Validate required fields
      if (!formData.code || !formData.code.trim()) {
        Alert.alert('Error', 'Code is required. Please enter a promo code.');
        return;
      }

      // Validate value for promo types that require it
      const needsValue = formData.type === 'percentage' || formData.type === 'fixed_amount' || formData.type === 'fixed_price_item';
      if (needsValue && (!formData.value || !formData.value.trim())) {
        const valueLabel = formData.type === 'percentage' ? 'percentage (0-100)' : 'amount';
        Alert.alert('Error', `Value is required for ${formData.type === 'percentage' ? 'percentage discount' : 'fixed amount discount'}. Please enter a ${valueLabel}.`);
        return;
      }

      // Validate percentage range if applicable
      if (formData.type === 'percentage' && formData.value) {
        const percentageValue = Number(formData.value);
        if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
          Alert.alert('Error', 'Percentage value must be between 0 and 100.');
          return;
        }
      }

      const adminId = state.currentUser?.id;
      if (!adminId) {
        Alert.alert('Error', 'Admin user ID not found');
        return;
      }

      // Only include value for promo types that need it
      const promoData = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || null,
        type: formData.type,
        value: needsValue && formData.value ? Number(formData.value) : null,
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
      } else {
        await createPromoCode(promoData, adminId);
      }

      setShowPromoForm(false);
      await loadPromoCodes();
    } catch (error) {
      console.error('[ManagePromoCodes] Error saving promo code:', error);
      Alert.alert('Error', error.message || 'Failed to save promo code. Please try again.');
    }
  };

  const handleToggleActive = async (promo) => {
    try {
      await togglePromoCode(promo.id, !promo.active);
      await loadPromoCodes();
    } catch (error) {
      console.error('[ManagePromoCodes] Error toggling promo code:', error);
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
            } catch (error) {
              console.error('[ManagePromoCodes] Error deleting promo code:', error);
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

  // Filter promo codes based on search and active filter
  const filteredPromoCodes = useMemo(() => {
    let filtered = promoCodes;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (promo) =>
          promo.code?.toLowerCase().includes(query) ||
          promo.description?.toLowerCase().includes(query)
      );
    }

    // Apply active filter
    if (activeFilter !== null) {
      filtered = filtered.filter((promo) => promo.active === activeFilter);
    }

    return filtered;
  }, [promoCodes, searchQuery, activeFilter]);

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';

  const renderPromoRow = ({ item: promo }) => (
    <View
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
          <AppText style={[styles.promoCode, { color: accent }]}>{promo.code}</AppText>
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
            <AppText
              style={[
                styles.toggleText,
                {
                  color: promo.active ? accent : secondaryFont,
                },
              ]}
            >
              {promo.active ? 'Active' : 'Inactive'}
            </AppText>
          </TouchableOpacity>
        </View>
        {promo.description && (
          <AppText style={[styles.promoDescription, { color: secondaryFont }]}>
            {promo.description}
          </AppText>
        )}
      </View>

      <View style={styles.promoDetails}>
        <AppText style={[styles.promoDetail, { color: secondaryFont }]}>
          Type: {formatPromoType(promo.type)}
          {promo.value !== null && promo.value !== undefined && (
            <>
              {' • '}
              {promo.type === 'percentage'
                ? `${promo.value}%`
                : `$${Number(promo.value).toFixed(2)}`}
            </>
          )}
        </AppText>
        {promo.uses_count !== undefined && (
          <AppText style={[styles.promoDetail, { color: secondaryFont }]}>
            Uses: {promo.uses_count}
            {promo.max_uses ? ` / ${promo.max_uses}` : ''}
          </AppText>
        )}
      </View>

      <View style={styles.promoActions}>
        <TouchableOpacity
          onPress={() => handleEditPromo(promo)}
          style={[styles.actionButton, { borderColor: withOpacity(borderColor, 0.5) }]}
        >
          <AppText style={[styles.actionButtonText, { color: primaryFont }]}>Edit</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeletePromo(promo)}
          style={[styles.actionButton, { borderColor: withOpacity(colors.error || '#B33A3A', 0.5) }]}
        >
          <AppText style={[styles.actionButtonText, { color: colors.error || '#B33A3A' }]}>
            Delete
          </AppText>
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
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Promo Codes</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filtersContainer}>
        <View style={[styles.searchContainer, { borderColor: withOpacity(borderColor, 0.5) }]}>
          <Icon name="search" color={secondaryFont} size={18} />
          <TextInput
            style={[styles.searchInput, { color: primaryFont }]}
            placeholder="Search by code or description..."
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
            onPress={() => handleActiveFilter(true)}
            style={[
              styles.filterChip,
              {
                backgroundColor: activeFilter === true ? withOpacity(accent, 0.1) : surface,
                borderColor: activeFilter === true ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: activeFilter === true ? accent : primaryFont,
                },
              ]}
            >
              Active
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleActiveFilter(false)}
            style={[
              styles.filterChip,
              {
                backgroundColor: activeFilter === false ? withOpacity(accent, 0.1) : surface,
                borderColor: activeFilter === false ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: activeFilter === false ? accent : primaryFont,
                },
              ]}
            >
              Inactive
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleActiveFilter(null)}
            style={[
              styles.filterChip,
              {
                backgroundColor: activeFilter === null ? withOpacity(accent, 0.1) : surface,
                borderColor: activeFilter === null ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: activeFilter === null ? accent : primaryFont,
                },
              ]}
            >
              All
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.contentHeader}>
        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Promo Codes</AppText>
        <TouchableOpacity
          onPress={handleCreatePromo}
          style={[styles.addButton, { backgroundColor: accent }]}
        >
          <Icon name="plus" color={colors.accentContrast || '#FFFFFF'} size={16} />
          <AppText style={[styles.addButtonText, { color: colors.accentContrast || '#FFFFFF' }]}>
            Create
          </AppText>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={accent} />
          <AppText style={[styles.loadingText, { color: secondaryFont }]}>Loading promo codes...</AppText>
        </View>
      ) : (
        <FlatList
          data={filteredPromoCodes}
          renderItem={renderPromoRow}
          keyExtractor={(item) => item.id}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <AppText style={[styles.emptyText, { color: secondaryFont }]}>
                  {searchQuery || activeFilter !== null
                    ? 'No promo codes match your filters'
                    : 'No promo codes yet. Create one to get started.'}
                </AppText>
              </View>
            ) : null
          }
        />
      )}

      {/* Promo Form Modal */}
      {showPromoForm && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surface }]}>
            <View style={styles.modalHeader}>
              <AppText style={[styles.modalTitle, { color: primaryFont }]}>
                {editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}
              </AppText>
              <TouchableOpacity onPress={() => setShowPromoForm(false)}>
                <Icon name="close" color={secondaryFont} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <FormField
                label="Code *"
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text })}
                placeholder="WELCOME10"
                autoCapitalize="characters"
              />
              <FormField
                label="Description"
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Welcome discount"
              />
              <AppText style={[styles.formLabel, { color: primaryFont }]}>Type *</AppText>
              <View style={styles.typeButtons}>
                {[
                  { value: 'percentage', label: 'Percentage Discount' },
                  { value: 'fixed_amount', label: 'Fixed Amount Discount' },
                  { value: 'free_shipping', label: 'Free Shipping' },
                  { value: 'free_order', label: 'Free Order' },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    onPress={() => {
                      // Clear value when switching to a type that doesn't need it
                      const needsValue = type.value === 'percentage' || type.value === 'fixed_amount' || type.value === 'fixed_price_item';
                      setFormData({ 
                        ...formData, 
                        type: type.value,
                        value: needsValue ? formData.value : ''
                      });
                    }}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor:
                          formData.type === type.value
                            ? withOpacity(accent, 0.1)
                            : withOpacity(borderColor, 0.2),
                        borderColor:
                          formData.type === type.value ? accent : withOpacity(borderColor, 0.5),
                      },
                    ]}
                  >
                    <AppText
                      style={[
                        styles.typeButtonText,
                        {
                          color: formData.type === type.value ? accent : primaryFont,
                        },
                      ]}
                    >
                      {type.label}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Only show Value field for promo types that need it */}
              {(formData.type === 'percentage' || formData.type === 'fixed_amount' || formData.type === 'fixed_price_item') && (
                <FormField
                  label="Value *"
                  value={formData.value}
                  onChangeText={(text) => setFormData({ ...formData, value: text })}
                  placeholder={formData.type === 'percentage' ? '10 (0-100)' : '10.00'}
                  keyboardType="numeric"
                />
              )}
              <FormField
                label="Min Order Amount"
                value={formData.min_order_amount}
                onChangeText={(text) => setFormData({ ...formData, min_order_amount: text })}
                placeholder="25"
                keyboardType="numeric"
              />
              <FormField
                label="Start Date"
                value={formData.start_date}
                onChangeText={(text) => setFormData({ ...formData, start_date: text })}
                placeholder="YYYY-MM-DD"
              />
              <FormField
                label="End Date"
                value={formData.end_date}
                onChangeText={(text) => setFormData({ ...formData, end_date: text })}
                placeholder="YYYY-MM-DD"
              />
              <FormField
                label="Max Uses"
                value={formData.max_uses}
                onChangeText={(text) => setFormData({ ...formData, max_uses: text })}
                placeholder="100"
                keyboardType="numeric"
              />
              <FormField
                label="Per User Limit"
                value={formData.per_user_limit}
                onChangeText={(text) => setFormData({ ...formData, per_user_limit: text })}
                placeholder="1"
                keyboardType="numeric"
              />
              
              {/* Active Toggle */}
              <View style={styles.switchRow}>
                <AppText style={[styles.formLabel, { color: primaryFont }]}>Active</AppText>
                <TouchableOpacity
                  onPress={() => setFormData({ ...formData, active: !formData.active })}
                  style={[
                    styles.switch,
                    {
                      backgroundColor: formData.active
                        ? accent
                        : withOpacity(borderColor, 0.3),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      {
                        transform: [{ translateX: formData.active ? 20 : 0 }],
                      },
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowPromoForm(false)}
                style={[styles.modalButton, { borderColor: withOpacity(borderColor, 0.5) }]}
              >
                <AppText style={[styles.modalButtonText, { color: primaryFont }]}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSavePromo}
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: accent }]}
              >
                <AppText style={[styles.modalButtonText, styles.modalButtonPrimaryText, { color: colors.accentContrast || '#FFFFFF' }]}>Save</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    promoCard: {
      padding: 16,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
    },
    promoCardHeader: {
      gap: 8,
    },
    promoCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    promoCode: {
      fontSize: 18,
      fontWeight: '700',
    },
    toggleButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    toggleText: {
      fontSize: 12,
      fontWeight: '600',
    },
    promoDescription: {
      fontSize: 14,
    },
    promoDetails: {
      gap: 4,
    },
    promoDetail: {
      fontSize: 13,
    },
    promoActions: {
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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '90%',
      maxHeight: '80%',
      borderRadius: 12,
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    modalBody: {
      maxHeight: 400,
    },
    modalFooter: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
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
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 12,
    },
    typeButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    typeButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      minWidth: '47%',
    },
    typeButtonText: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      marginBottom: 8,
    },
    switch: {
      width: 50,
      height: 30,
      borderRadius: 15,
      padding: 2,
      justifyContent: 'center',
    },
    switchThumb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
  });
}

export default ManagePromoCodesScreen;

