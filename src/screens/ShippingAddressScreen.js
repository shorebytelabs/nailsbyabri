import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Alert, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import { getSavedAddresses, addSavedAddress, updateSavedAddress, deleteSavedAddress, setDefaultAddress } from '../services/addressService';

function ShippingAddressScreen({ navigation }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingAddress, setEditingAddress] = useState(null); // null = new, object = editing
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    name: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    isDefault: false,
  });

  const primaryFont = colors.primaryFont || '#220707';
  const accent = colors.accent || '#6F171F';
  const errorColor = colors.error || '#B33A3A';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);
  const surfaceMuted = colors.surfaceMuted || '#F6EFE8';

  // Load saved addresses
  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      setError(null);
      const saved = await getSavedAddresses();
      setAddresses(saved);
    } catch (err) {
      console.error('[ShippingAddressScreen] Error loading addresses:', err);
      setError(err.message || 'Failed to load saved addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingAddress(null);
    setAddressForm({
      label: 'Home',
      name: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      isDefault: addresses.length === 0, // Make first address default
    });
    setShowAddressForm(true);
    setError(null);
  };

  const handleEdit = (address) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label || 'Home',
      name: address.name || '',
      line1: address.line1 || '',
      line2: address.line2 || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode || '',
      isDefault: address.isDefault || false,
    });
    setShowAddressForm(true);
    setError(null);
  };

  const handleDelete = (addressId) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(addressId);
              await deleteSavedAddress(addressId);
              await loadAddresses();
            } catch (err) {
              console.error('[ShippingAddressScreen] Error deleting address:', err);
              Alert.alert('Error', err.message || 'Failed to delete address');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (addressId) => {
    try {
      await setDefaultAddress(addressId);
      await loadAddresses();
    } catch (err) {
      console.error('[ShippingAddressScreen] Error setting default address:', err);
      Alert.alert('Error', err.message || 'Failed to set default address');
    }
  };

  const handleSaveAddress = async () => {
    setError(null);

    // Validation
    if (!addressForm.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!addressForm.line1.trim()) {
      setError('Address line 1 is required');
      return;
    }
    if (!addressForm.city.trim()) {
      setError('City is required');
      return;
    }
    if (!addressForm.state.trim()) {
      setError('State is required');
      return;
    }
    if (!addressForm.postalCode.trim()) {
      setError('Postal code is required');
      return;
    }

    try {
      setSaving(true);
      if (editingAddress) {
        await updateSavedAddress(editingAddress.id, addressForm);
      } else {
        await addSavedAddress(addressForm);
      }
      await loadAddresses();
      setShowAddressForm(false);
      setEditingAddress(null);
    } catch (err) {
      console.error('[ShippingAddressScreen] Error saving address:', err);
      setError(err.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
    setError(null);
    setAddressForm({
      label: 'Home',
      name: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      isDefault: false,
    });
  };

  return (
    <ScreenContainer scroll={false} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back to Profile"
        >
          <Icon name="chevronRight" color={primaryFont} style={styles.backIcon} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Shipping Addresses</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.headerSection}>
          <Text style={[styles.subtitle, { color: secondaryFont }]}>
            Manage your saved shipping addresses for faster checkout.
          </Text>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: secondaryFont }]}>Loading addresses...</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="mapPin" color={withOpacity(secondaryFont, 0.4)} size={48} />
            <Text style={[styles.emptyTitle, { color: primaryFont }]}>No saved addresses</Text>
            <Text style={[styles.emptyText, { color: secondaryFont }]}>
              Add an address to use during checkout
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.addButtonBottomContainer}>
              <TouchableOpacity
                onPress={handleAddNew}
                style={[
                  styles.addButtonTop,
                  {
                    borderColor: withOpacity(accent, 0.35),
                    backgroundColor: withOpacity(accent, 0.08),
                  },
                ]}
              >
                <Icon name="plus" color={accent} size={16} />
                <Text style={[styles.addButtonTopText, { color: accent }]}>Add New Address</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.addressList}>
              {addresses.map((address) => (
              <View
                key={address.id}
                style={[
                  styles.addressCard,
                  {
                    borderColor: address.isDefault ? accent : borderColor,
                    backgroundColor: address.isDefault ? withOpacity(accent, 0.05) : surface,
                  },
                ]}
              >
                <View style={styles.addressCardHeader}>
                  <View style={styles.addressCardHeaderLeft}>
                    <Text style={[styles.addressLabel, { color: accent }]}>
                      {address.label || 'Home'}
                    </Text>
                    {address.isDefault && (
                      <View style={[styles.defaultBadge, { backgroundColor: accent }]}>
                        <Text style={[styles.defaultBadgeText, { color: surface }]}>Default</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.addressCardActions}>
                    <TouchableOpacity
                      onPress={() => handleEdit(address)}
                      style={styles.actionButton}
                      accessibilityLabel="Edit address"
                    >
                      <Icon name="edit" color={accent} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(address.id)}
                      style={styles.actionButton}
                      disabled={deletingId === address.id}
                      accessibilityLabel="Delete address"
                    >
                      <Icon name="trash" color={errorColor} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.addressCardBody}>
                  <Text style={[styles.addressName, { color: primaryFont }]}>
                    {address.name}
                  </Text>
                  <Text style={[styles.addressLine, { color: secondaryFont }]}>
                    {address.line1}
                  </Text>
                  {address.line2 ? (
                    <Text style={[styles.addressLine, { color: secondaryFont }]}>
                      {address.line2}
                    </Text>
                  ) : null}
                  <Text style={[styles.addressLine, { color: secondaryFont }]}>
                    {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
                  </Text>
                </View>
                {!address.isDefault && (
                  <TouchableOpacity
                    onPress={() => handleSetDefault(address.id)}
                    style={styles.setDefaultButton}
                  >
                    <Text style={[styles.setDefaultText, { color: accent }]}>
                      Set as default
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            </View>
          </>
        )}

        {error && !showAddressForm ? (
          <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
        ) : null}
      </ScrollView>

      {/* Address Form Modal */}
      <Modal
        visible={showAddressForm}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surface }]} collapsable={false}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryFont }]}>
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </Text>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.modalCloseButton}
                accessibilityLabel="Close"
              >
                <Icon name="close" color={primaryFont} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.formLabel, { color: primaryFont }]}>Label (e.g., Home, Work)</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={addressForm.label}
                onChangeText={(value) => {
                  setAddressForm((prev) => ({ ...prev, label: value }));
                  if (error) setError(null);
                }}
                placeholder="Home"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Full Name *</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={addressForm.name}
                onChangeText={(value) => {
                  setAddressForm((prev) => ({ ...prev, name: value }));
                  if (error) setError(null);
                }}
                placeholder="John Doe"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Address Line 1 *</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={addressForm.line1}
                onChangeText={(value) => {
                  setAddressForm((prev) => ({ ...prev, line1: value }));
                  if (error) setError(null);
                }}
                placeholder="123 Main St"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
              />

              <Text style={[styles.formLabel, { color: primaryFont }]}>Address Line 2 (Optional)</Text>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={addressForm.line2}
                onChangeText={(value) => {
                  setAddressForm((prev) => ({ ...prev, line2: value }));
                  if (error) setError(null);
                }}
                placeholder="Apt 4B"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
              />

              <View style={styles.formRow}>
                <View style={styles.formRowThird}>
                  <Text style={[styles.formLabel, { color: primaryFont }]}>City *</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                    value={addressForm.city}
                    onChangeText={(value) => {
                      setAddressForm((prev) => ({ ...prev, city: value }));
                      if (error) setError(null);
                    }}
                    placeholder="Los Angeles"
                    placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                  />
                </View>
                <View style={styles.formRowThird}>
                  <Text style={[styles.formLabel, { color: primaryFont }]}>State *</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                    value={addressForm.state}
                    onChangeText={(value) => {
                      setAddressForm((prev) => ({ ...prev, state: value.toUpperCase().slice(0, 2) }));
                      if (error) setError(null);
                    }}
                    placeholder="CA"
                    placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
                <View style={styles.formRowThird}>
                  <Text style={[styles.formLabel, { color: primaryFont }]}>Postal Code *</Text>
                  <TextInput
                    style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                    value={addressForm.postalCode}
                    onChangeText={(value) => {
                      setAddressForm((prev) => ({ ...prev, postalCode: value }));
                      if (error) setError(null);
                    }}
                    placeholder="90001"
                    placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.defaultAddressRow}>
                <View style={styles.defaultAddressLabel}>
                  <Text style={[styles.defaultAddressLabelText, { color: primaryFont }]}>
                    Set as default address
                  </Text>
                </View>
                <Switch
                  value={addressForm.isDefault}
                  onValueChange={(value) => {
                    setAddressForm((prev) => ({ ...prev, isDefault: value }));
                  }}
                  trackColor={{
                    false: withOpacity(borderColor, 0.6),
                    true: withOpacity(accent, 0.4),
                  }}
                  thumbColor={addressForm.isDefault ? accent : surface}
                  ios_backgroundColor={withOpacity(borderColor, 0.6)}
                />
              </View>

              {error ? (
                <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
              ) : null}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={handleCancel}
                  style={[styles.modalButton, { borderColor: withOpacity(borderColor, 0.5) }]}
                >
                  <Text style={[styles.modalButtonText, { color: primaryFont }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveAddress}
                  disabled={saving || !addressForm.name.trim() || !addressForm.line1.trim() || !addressForm.city.trim() || !addressForm.state.trim() || !addressForm.postalCode.trim()}
                  style={[
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    {
                      backgroundColor: accent,
                      opacity: (saving || !addressForm.name.trim() || !addressForm.line1.trim() || !addressForm.city.trim() || !addressForm.state.trim() || !addressForm.postalCode.trim()) ? 0.5 : 1,
                    },
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.accentContrast || '#FFFFFF'} />
                  ) : (
                    <Text style={[styles.modalButtonText, styles.modalButtonPrimaryText, { color: colors.accentContrast || '#FFFFFF' }]}>
                      {editingAddress ? 'Update Address' : 'Save Address'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const createStyles = (colors) => StyleSheet.create({
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
    borderBottomColor: withOpacity(colors.border || '#000000', 0.08),
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerSection: {
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  addButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  addButtonBottomContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  addressList: {
    gap: 12,
    marginBottom: 24,
  },
  addressCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addressCardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  addressCardBody: {
    gap: 4,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  setDefaultButton: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withOpacity(colors.border || '#000000', 0.08),
  },
  setDefaultText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonTopText: {
    fontSize: 13,
    fontWeight: '700',
  },
  formRowThird: {
    flex: 1,
  },
  errorText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    width: '100%',
    flexDirection: 'column',
    backgroundColor: colors.surface || '#FFFFFF',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withOpacity(colors.border || '#000000', 0.08),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 16,
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
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formRowHalf: {
    flex: 1,
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
  defaultAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  defaultAddressLabel: {
    flex: 1,
    marginRight: 12,
  },
  defaultAddressLabelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ShippingAddressScreen;

