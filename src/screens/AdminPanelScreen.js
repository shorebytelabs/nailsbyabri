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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

function AdminPanelScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoCodesExpanded, setPromoCodesExpanded] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

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
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    if (promoCodesExpanded) {
      loadPromoCodes();
    }
  }, [isAdmin, navigation, promoCodesExpanded]);

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

  if (!isAdmin) {
    return null;
  }

  const adminSections = [
    {
      key: 'promoCodes',
      title: 'Promo Codes',
      description: 'Create and manage promotional codes',
      icon: 'tag',
      expandable: true,
      expanded: promoCodesExpanded,
      onPress: () => {
        setPromoCodesExpanded((prev) => !prev);
        if (!promoCodesExpanded) {
          loadPromoCodes();
        }
      },
    },
    // Future sections can be added here:
    // {
    //   key: 'users',
    //   title: 'Manage Users',
    //   description: 'View and manage user accounts',
    //   icon: 'users',
    //   onPress: () => navigation.navigate('AdminUsers'),
    // },
    // {
    //   key: 'workloads',
    //   title: 'Manage Workloads',
    //   description: 'Track and manage production workloads',
    //   icon: 'calendar',
    //   onPress: () => navigation.navigate('AdminWorkloads'),
    // },
  ];

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';

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
  });
}

export default AdminPanelScreen;
