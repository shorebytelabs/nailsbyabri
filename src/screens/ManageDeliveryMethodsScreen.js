/**
 * Manage Delivery Methods Screen
 * Admin-only screen for viewing and managing delivery methods and tiers
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
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
  getAllDeliveryMethods,
  createDeliveryMethod,
  updateDeliveryMethod,
  deleteDeliveryMethod,
  createDeliveryTier,
  updateDeliveryTier,
  deleteDeliveryTier,
} from '../services/deliveryService';
import { clearDeliveryMethodsCache } from '../utils/pricing';
import PrimaryButton from '../components/PrimaryButton';

function ManageDeliveryMethodsScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMethods, setExpandedMethods] = useState(new Set());
  const [editingMethod, setEditingMethod] = useState(null);
  const [editingTier, setEditingTier] = useState(null);
  const [showMethodForm, setShowMethodForm] = useState(false);
  const [showTierForm, setShowTierForm] = useState(false);
  const [methodFormData, setMethodFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    is_visible: true,
    display_order: 0,
  });
  const [tierFormData, setTierFormData] = useState({
    delivery_method_name: '',
    name: '',
    display_name: '',
    description: '',
    tagline: '',
    price: '0',
    days: '14',
    is_visible: true,
    is_default: false,
    display_order: 0,
  });

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadMethods();
  }, [isAdmin, navigation]);

  const loadMethods = useCallback(async () => {
    try {
      setLoading(true);
      const allMethods = await getAllDeliveryMethods();
      setMethods(allMethods || []);
    } catch (error) {
      console.error('[ManageDeliveryMethods] Error loading methods:', error);
      Alert.alert('Error', 'Failed to load delivery methods. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadMethods();
  }, [loadMethods]);

  const toggleMethodExpanded = (methodId) => {
    setExpandedMethods((prev) => {
      const next = new Set(prev);
      if (next.has(methodId)) {
        next.delete(methodId);
      } else {
        next.add(methodId);
      }
      return next;
    });
  };

  const handleCreateMethod = () => {
    setEditingMethod(null);
    setMethodFormData({
      name: '',
      display_name: '',
      description: '',
      is_visible: true,
      display_order: methods.length,
    });
    setShowMethodForm(true);
  };

  const handleEditMethod = (method) => {
    setEditingMethod(method);
    setMethodFormData({
      name: method.name || '',
      display_name: method.display_name || '',
      description: method.description || '',
      is_visible: method.is_visible !== false,
      display_order: method.display_order || 0,
    });
    setShowMethodForm(true);
  };

  const handleCreateTier = (method) => {
    setEditingTier(null);
    setTierFormData({
      delivery_method_name: method.name,
      name: '',
      display_name: '',
      description: '',
      tagline: '',
      price: '0',
      days: '14',
      is_visible: true,
      is_default: false,
      display_order: (method.tiers || []).length,
    });
    setShowTierForm(true);
  };

  const handleEditTier = (tier, method) => {
    setEditingTier(tier);
    setTierFormData({
      delivery_method_name: method.name,
      name: tier.name || '',
      display_name: tier.display_name || '',
      description: tier.description || '',
      tagline: tier.tagline || '',
      price: String(tier.price || 0),
      days: String(tier.days || 14),
      is_visible: tier.is_visible !== false,
      is_default: tier.is_default || false,
      display_order: tier.display_order || 0,
    });
    setShowTierForm(true);
  };

  const handleSaveMethod = async () => {
    try {
      if (!methodFormData.name.trim()) {
        Alert.alert('Error', 'Method name is required.');
        return;
      }
      if (!methodFormData.display_name.trim()) {
        Alert.alert('Error', 'Display name is required.');
        return;
      }

      if (editingMethod) {
        await updateDeliveryMethod(editingMethod.name, {
          display_name: methodFormData.display_name.trim(),
          description: methodFormData.description.trim() || null,
          is_visible: methodFormData.is_visible,
          display_order: Number(methodFormData.display_order),
        });
        Alert.alert('Success', 'Delivery method updated successfully.');
      } else {
        await createDeliveryMethod({
          name: methodFormData.name.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: methodFormData.display_name.trim(),
          description: methodFormData.description.trim() || null,
          is_visible: methodFormData.is_visible,
          display_order: Number(methodFormData.display_order),
        });
        Alert.alert('Success', 'Delivery method created successfully.');
      }

      setShowMethodForm(false);
      clearDeliveryMethodsCache(); // Clear cache so customers see updates
      await loadMethods();
    } catch (error) {
      console.error('[ManageDeliveryMethods] Error saving method:', error);
      Alert.alert('Error', error.message || 'Failed to save delivery method. Please try again.');
    }
  };

  const handleSaveTier = async () => {
    try {
      if (!tierFormData.name.trim()) {
        Alert.alert('Error', 'Tier name is required.');
        return;
      }
      if (!tierFormData.display_name.trim()) {
        Alert.alert('Error', 'Display name is required.');
        return;
      }

      if (editingTier) {
        await updateDeliveryTier(editingTier.id, {
          display_name: tierFormData.display_name.trim(),
          description: tierFormData.description.trim() || null,
          tagline: tierFormData.tagline.trim() || null,
          price: Number(tierFormData.price),
          days: Number(tierFormData.days),
          is_visible: tierFormData.is_visible,
          is_default: tierFormData.is_default,
          display_order: Number(tierFormData.display_order),
        });
        Alert.alert('Success', 'Delivery tier updated successfully.');
      } else {
        await createDeliveryTier({
          delivery_method_name: tierFormData.delivery_method_name,
          name: tierFormData.name.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: tierFormData.display_name.trim(),
          description: tierFormData.description.trim() || null,
          tagline: tierFormData.tagline.trim() || null,
          price: Number(tierFormData.price),
          days: Number(tierFormData.days),
          is_visible: tierFormData.is_visible,
          is_default: tierFormData.is_default,
          display_order: Number(tierFormData.display_order),
        });
        Alert.alert('Success', 'Delivery tier created successfully.');
      }

      setShowTierForm(false);
      clearDeliveryMethodsCache(); // Clear cache so customers see updates
      await loadMethods();
    } catch (error) {
      console.error('[ManageDeliveryMethods] Error saving tier:', error);
      Alert.alert('Error', error.message || 'Failed to save delivery tier. Please try again.');
    }
  };

  const handleDeleteMethod = (method) => {
    Alert.alert(
      'Delete Delivery Method',
      `Are you sure you want to delete "${method.display_name}"? This will also delete all its tiers. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDeliveryMethod(method.name);
              Alert.alert('Success', 'Delivery method deleted successfully.');
              clearDeliveryMethodsCache();
              await loadMethods();
            } catch (error) {
              console.error('[ManageDeliveryMethods] Error deleting method:', error);
              Alert.alert('Error', 'Failed to delete delivery method. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteTier = (tier) => {
    Alert.alert(
      'Delete Delivery Tier',
      `Are you sure you want to delete "${tier.display_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDeliveryTier(tier.id);
              Alert.alert('Success', 'Delivery tier deleted successfully.');
              clearDeliveryMethodsCache();
              await loadMethods();
            } catch (error) {
              console.error('[ManageDeliveryMethods] Error deleting tier:', error);
              Alert.alert('Error', 'Failed to delete delivery tier. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleToggleMethodVisible = async (method) => {
    try {
      await updateDeliveryMethod(method.name, {
        is_visible: !method.is_visible,
      });
      clearDeliveryMethodsCache();
      await loadMethods();
    } catch (error) {
      console.error('[ManageDeliveryMethods] Error toggling visibility:', error);
      Alert.alert('Error', 'Failed to update method. Please try again.');
    }
  };

  const handleToggleTierVisible = async (tier) => {
    try {
      await updateDeliveryTier(tier.id, {
        is_visible: !tier.is_visible,
      });
      clearDeliveryMethodsCache();
      await loadMethods();
    } catch (error) {
      console.error('[ManageDeliveryMethods] Error toggling tier visibility:', error);
      Alert.alert('Error', 'Failed to update tier. Please try again.');
    }
  };

  const renderTierItem = (tier, method) => {
    return (
      <View key={tier.id} style={[styles.tierItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.tierContent}>
          <View style={styles.tierInfo}>
            <Text style={[styles.tierName, { color: colors.primaryFont }]}>{tier.display_name}</Text>
            {tier.description && (
              <Text style={[styles.tierDescription, { color: colors.secondaryFont }]}>{tier.description}</Text>
            )}
            <View style={styles.tierDetailsRow}>
              <Text style={[styles.tierDetailLabel, { color: colors.secondaryFont }]}>Price:</Text>
              <Text style={[styles.tierDetailValue, { color: colors.primaryFont }]}>${Number(tier.price).toFixed(2)}</Text>
            </View>
            <View style={styles.tierDetailsRow}>
              <Text style={[styles.tierDetailLabel, { color: colors.secondaryFont }]}>Days:</Text>
              <Text style={[styles.tierDetailValue, { color: colors.primaryFont }]}>{tier.days}</Text>
            </View>
            <View style={styles.tierDetailsRow}>
              <Text style={[styles.tierDetailLabel, { color: colors.secondaryFont }]}>Display Order:</Text>
              <Text style={[styles.tierDetailValue, { color: colors.primaryFont }]}>{tier.display_order}</Text>
            </View>
            <View style={styles.tierMetaRow}>
              <Text style={[styles.tierMeta, { color: colors.secondaryFont }]}>
                {tier.is_visible ? 'Visible' : 'Hidden'} • {tier.is_default ? 'Default' : 'Not default'}
              </Text>
            </View>
          </View>
          <View style={styles.tierActions}>
            <Switch
              value={tier.is_visible}
              onValueChange={() => handleToggleTierVisible(tier)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
            <TouchableOpacity
              onPress={() => handleEditTier(tier, method)}
              style={[styles.tierActionButton, { backgroundColor: withOpacity(colors.accent, 0.1) }]}
            >
              <Icon name="edit" color={colors.accent} size={16} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteTier(tier)}
              style={[styles.tierActionButton, { backgroundColor: withOpacity(colors.error, 0.1) }]}
            >
              <Icon name="trash" color={colors.error} size={16} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderMethodItem = ({ item: method }) => {
    const isExpanded = expandedMethods.has(method.id);
    const visibleTiers = (method.tiers || []).filter((t) => t.is_visible);
    const allTiers = method.tiers || [];

    return (
      <View style={[styles.methodItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => toggleMethodExpanded(method.id)}
          style={styles.methodHeader}
          activeOpacity={0.7}
        >
          <View style={styles.methodHeaderContent}>
            <View style={styles.methodInfo}>
              <Text style={[styles.methodName, { color: colors.primaryFont }]}>{method.display_name}</Text>
              <Text style={[styles.methodDetails, { color: colors.secondaryFont }]}>
                {allTiers.length} tier{allTiers.length !== 1 ? 's' : ''} • {method.is_visible ? 'Visible' : 'Hidden'}
              </Text>
              {allTiers.length > 0 && (
                <View style={styles.tierNamesRow}>
                  {allTiers.map((tier) => (
                    <View key={tier.id} style={styles.tierNameChip}>
                      <Text style={[styles.tierNameChipText, { color: colors.primaryFont }]}>
                        {tier.display_name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.methodHeaderActions}>
              <Switch
                value={method.is_visible}
                onValueChange={() => handleToggleMethodVisible(method)}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
                onPress={(e) => e.stopPropagation()}
              />
              <Icon
                name={isExpanded ? 'chevronUp' : 'chevronDown'}
                color={colors.secondaryFont}
                size={20}
              />
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.methodTiers}>
            <View style={styles.tiersHeader}>
              <Text style={[styles.tiersTitle, { color: colors.primaryFont }]}>Delivery Tiers</Text>
              <TouchableOpacity
                onPress={() => handleCreateTier(method)}
                style={[styles.addTierButton, { backgroundColor: withOpacity(colors.accent, 0.1) }]}
              >
                <Icon name="add" color={colors.accent} size={18} />
                <Text style={[styles.addTierText, { color: colors.accent }]}>Add Tier</Text>
              </TouchableOpacity>
            </View>
            {allTiers.length === 0 ? (
              <Text style={[styles.emptyTiers, { color: colors.secondaryFont }]}>No tiers yet</Text>
            ) : (
              allTiers.map((tier) => renderTierItem(tier, method))
            )}
            <View style={styles.methodActions}>
              <TouchableOpacity
                onPress={() => handleEditMethod(method)}
                style={[styles.actionButton, { backgroundColor: withOpacity(colors.accent, 0.1) }]}
              >
                <Icon name="edit" color={colors.accent} size={18} />
                <Text style={[styles.actionButtonText, { color: colors.accent }]}>Edit Method</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteMethod(method)}
                style={[styles.actionButton, { backgroundColor: withOpacity(colors.error, 0.1) }]}
              >
                <Icon name="trash" color={colors.error} size={18} />
                <Text style={[styles.actionButtonText, { color: colors.error }]}>Delete Method</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading && methods.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevronRight" color={colors.primaryFont} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.primaryFont }]}>Manage Delivery Methods</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronLeft" color={colors.primaryFont} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.primaryFont }]}>Manage Delivery Methods</Text>
        <TouchableOpacity onPress={handleCreateMethod} style={styles.addButton}>
          <Icon name="add" color={colors.accent} size={24} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={methods}
        renderItem={renderMethodItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.secondaryFont }]}>No delivery methods found</Text>
          </View>
        }
      />

      {/* Method Form Modal */}
      <Modal
        visible={showMethodForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMethodForm(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.primaryBackground }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMethodForm(false)} style={styles.modalCloseButton}>
              <Icon name="close" color={colors.primaryFont} size={24} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.primaryFont }]}>
              {editingMethod ? 'Edit Method' : 'Create Method'}
            </Text>
            <View style={styles.modalSpacer} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <Text style={[styles.label, { color: colors.primaryFont }]}>Name (Internal ID)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={methodFormData.name}
              onChangeText={(text) => setMethodFormData((prev) => ({ ...prev, name: text }))}
              placeholder="e.g., pickup, delivery, shipping"
              placeholderTextColor={colors.secondaryFont}
              editable={!editingMethod}
            />
            {editingMethod && (
              <Text style={[styles.hint, { color: colors.secondaryFont }]}>Name cannot be changed after creation</Text>
            )}

            <Text style={[styles.label, { color: colors.primaryFont }]}>Display Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={methodFormData.display_name}
              onChangeText={(text) => setMethodFormData((prev) => ({ ...prev, display_name: text }))}
              placeholder="e.g., Pick Up, Local Delivery, Shipping"
              placeholderTextColor={colors.secondaryFont}
            />

            <Text style={[styles.label, { color: colors.primaryFont }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={methodFormData.description}
              onChangeText={(text) => setMethodFormData((prev) => ({ ...prev, description: text }))}
              placeholder="e.g., Ready in 10 to 14 days in 92127"
              placeholderTextColor={colors.secondaryFont}
              multiline
              numberOfLines={2}
            />

            <Text style={[styles.label, { color: colors.primaryFont }]}>Display Order</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={String(methodFormData.display_order)}
              onChangeText={(text) => setMethodFormData((prev) => ({ ...prev, display_order: Number(text) || 0 }))}
              placeholder="0"
              placeholderTextColor={colors.secondaryFont}
              keyboardType="number-pad"
            />

            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: colors.primaryFont }]}>Visible to Customers</Text>
              <Switch
                value={methodFormData.is_visible}
                onValueChange={(value) => setMethodFormData((prev) => ({ ...prev, is_visible: value }))}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setShowMethodForm(false)}
              style={[styles.cancelButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelButtonText, { color: colors.secondaryFont }]}>Cancel</Text>
            </TouchableOpacity>
            <PrimaryButton
              label={editingMethod ? 'Update Method' : 'Create Method'}
              onPress={handleSaveMethod}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Tier Form Modal */}
      <Modal
        visible={showTierForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTierForm(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.primaryBackground }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTierForm(false)} style={styles.modalCloseButton}>
              <Icon name="close" color={colors.primaryFont} size={24} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.primaryFont }]}>
              {editingTier ? 'Edit Tier' : 'Create Tier'}
            </Text>
            <View style={styles.modalSpacer} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <Text style={[styles.label, { color: colors.primaryFont }]}>Name (Internal ID)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={tierFormData.name}
              onChangeText={(text) => setTierFormData((prev) => ({ ...prev, name: text }))}
              placeholder="e.g., standard, priority, rush"
              placeholderTextColor={colors.secondaryFont}
              editable={!editingTier}
            />
            {editingTier && (
              <Text style={[styles.hint, { color: colors.secondaryFont }]}>Name cannot be changed after creation</Text>
            )}

            <Text style={[styles.label, { color: colors.primaryFont }]}>Display Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={tierFormData.display_name}
              onChangeText={(text) => setTierFormData((prev) => ({ ...prev, display_name: text }))}
              placeholder="e.g., Standard, Priority, Rush"
              placeholderTextColor={colors.secondaryFont}
            />

            <Text style={[styles.label, { color: colors.primaryFont }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={tierFormData.description}
              onChangeText={(text) => setTierFormData((prev) => ({ ...prev, description: text }))}
              placeholder="e.g., 10 to 14 days"
              placeholderTextColor={colors.secondaryFont}
              multiline
              numberOfLines={2}
            />

            <Text style={[styles.label, { color: colors.primaryFont }]}>Tagline</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={tierFormData.tagline}
              onChangeText={(text) => setTierFormData((prev) => ({ ...prev, tagline: text }))}
              placeholder="e.g., Included, Get your nails faster!"
              placeholderTextColor={colors.secondaryFont}
            />

            <Text style={[styles.label, { color: colors.primaryFont }]}>Price ($)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={tierFormData.price}
              onChangeText={(text) => setTierFormData((prev) => ({ ...prev, price: text }))}
              placeholder="0"
              placeholderTextColor={colors.secondaryFont}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: colors.primaryFont }]}>Days</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={tierFormData.days}
              onChangeText={(text) => setTierFormData((prev) => ({ ...prev, days: text }))}
              placeholder="14"
              placeholderTextColor={colors.secondaryFont}
              keyboardType="number-pad"
            />

            <Text style={[styles.label, { color: colors.primaryFont }]}>Display Order</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={String(tierFormData.display_order)}
              onChangeText={(text) => setTierFormData((prev) => ({ ...prev, display_order: Number(text) || 0 }))}
              placeholder="0"
              placeholderTextColor={colors.secondaryFont}
              keyboardType="number-pad"
            />

            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: colors.primaryFont }]}>Visible to Customers</Text>
              <Switch
                value={tierFormData.is_visible}
                onValueChange={(value) => setTierFormData((prev) => ({ ...prev, is_visible: value }))}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: colors.primaryFont }]}>Default Tier</Text>
              <Switch
                value={tierFormData.is_default}
                onValueChange={(value) => setTierFormData((prev) => ({ ...prev, is_default: value }))}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>
            <Text style={[styles.hint, { color: colors.secondaryFont }]}>
              Only one tier per method can be the default
            </Text>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setShowTierForm(false)}
              style={[styles.cancelButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelButtonText, { color: colors.secondaryFont }]}>Cancel</Text>
            </TouchableOpacity>
            <PrimaryButton
              label={editingTier ? 'Update Tier' : 'Create Tier'}
              onPress={handleSaveTier}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
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
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    headerSpacer: {
      width: 40,
    },
    addButton: {
      padding: 8,
    },
    listContent: {
      padding: 16,
    },
    methodItem: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: 12,
      overflow: 'hidden',
    },
    methodHeader: {
      padding: 16,
    },
    methodHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    methodInfo: {
      flex: 1,
    },
    methodName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    methodDetails: {
      fontSize: 12,
    },
    methodHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    methodTiers: {
      padding: 16,
      paddingTop: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    tiersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    tiersTitle: {
      fontSize: 14,
      fontWeight: '600',
    },
    addTierButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
      gap: 4,
    },
    addTierText: {
      fontSize: 14,
      fontWeight: '600',
    },
    tierItem: {
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: 8,
      padding: 12,
    },
    tierContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tierInfo: {
      flex: 1,
    },
    tierName: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 8,
    },
    tierDescription: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    tierDetailsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    tierDetailLabel: {
      fontSize: 13,
      fontWeight: '600',
      marginRight: 8,
      minWidth: 100,
    },
    tierDetailValue: {
      fontSize: 13,
      fontWeight: '500',
    },
    tierMetaRow: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    tierMeta: {
      fontSize: 12,
    },
    tierActions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      paddingTop: 4,
    },
    tierActionButton: {
      padding: 8,
      borderRadius: 6,
      minWidth: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierNamesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    tierNameChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    tierNameChipText: {
      fontSize: 11,
      fontWeight: '600',
    },
    methodActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      gap: 6,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    emptyTiers: {
      fontSize: 12,
      fontStyle: 'italic',
      textAlign: 'center',
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
    },
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalCloseButton: {
      padding: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    modalSpacer: {
      width: 40,
    },
    modalContent: {
      flex: 1,
    },
    modalScrollContent: {
      padding: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    hint: {
      fontSize: 12,
      marginTop: 4,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    modalFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default ManageDeliveryMethodsScreen;

