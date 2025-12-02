/**
 * Manage Shapes Screen
 * Admin-only screen for viewing and managing nail shapes
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import {
  getAllShapes,
  createShape,
  updateShape,
  deleteShape,
} from '../services/shapesService';
import { uploadShapeImage } from '../services/imageStorageService';
import { clearShapesCache } from '../utils/pricing';
import PrimaryButton from '../components/PrimaryButton';

function ManageShapesScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  const [shapes, setShapes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingShape, setEditingShape] = useState(null);
  const [showShapeForm, setShowShapeForm] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [shapeFormData, setShapeFormData] = useState({
    name: '',
    display_name: '',
    image_url: null,
    base_price: '10',
    price_adjustment: '0',
    is_visible: true,
    display_order: 0,
  });

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadShapes();
  }, [isAdmin, navigation]);

  const loadShapes = useCallback(async () => {
    try {
      setLoading(true);
      const allShapes = await getAllShapes();
      setShapes(allShapes || []);
    } catch (error) {
      console.error('[ManageShapes] Error loading shapes:', error);
      Alert.alert('Error', 'Failed to load shapes. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadShapes();
  }, [loadShapes]);

  const handleCreateShape = () => {
    setEditingShape(null);
    setShapeFormData({
      name: '',
      display_name: '',
      image_url: null,
      base_price: '10',
      price_adjustment: '0',
      is_visible: true,
      display_order: shapes.length,
    });
    setShowShapeForm(true);
  };

  const handleEditShape = (shape) => {
    setEditingShape(shape);
    setShapeFormData({
      name: shape.name || '',
      display_name: shape.display_name || '',
      image_url: shape.image_url || null,
      base_price: String(shape.base_price || 10),
      price_adjustment: String(shape.price_adjustment || 0),
      is_visible: shape.is_visible !== false,
      display_order: shape.display_order || 0,
    });
    setShowShapeForm(true);
  };

  const handleUploadShapeImage = async () => {
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
        Alert.alert('Error', 'No image selected');
        setUploadingImage(false);
        return;
      }

      // Upload to Supabase Storage - use 'order-images' bucket (same as tips)
      const imageUrl = await uploadShapeImage(asset.uri, 'order-images');

      setShapeFormData((prev) => ({
        ...prev,
        image_url: imageUrl,
      }));
    } catch (error) {
      console.error('[ManageShapes] Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveShape = async () => {
    try {
      if (!shapeFormData.name.trim()) {
        Alert.alert('Error', 'Shape name is required.');
        return;
      }
      if (!shapeFormData.display_name.trim()) {
        Alert.alert('Error', 'Display name is required.');
        return;
      }

      if (editingShape) {
        await updateShape(editingShape.name, {
          display_name: shapeFormData.display_name.trim(),
          image_url: shapeFormData.image_url,
          base_price: Number(shapeFormData.base_price),
          price_adjustment: Number(shapeFormData.price_adjustment),
          is_visible: shapeFormData.is_visible,
          display_order: Number(shapeFormData.display_order),
        });
        Alert.alert('Success', 'Shape updated successfully.');
      } else {
        await createShape({
          name: shapeFormData.name.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: shapeFormData.display_name.trim(),
          image_url: shapeFormData.image_url,
          base_price: Number(shapeFormData.base_price),
          price_adjustment: Number(shapeFormData.price_adjustment),
          is_visible: shapeFormData.is_visible,
          display_order: Number(shapeFormData.display_order),
        });
        Alert.alert('Success', 'Shape created successfully.');
      }

      setShowShapeForm(false);
      clearShapesCache(); // Clear cache so customers see updates
      await loadShapes();
    } catch (error) {
      console.error('[ManageShapes] Error saving shape:', error);
      Alert.alert('Error', error.message || 'Failed to save shape. Please try again.');
    }
  };

  const handleDeleteShape = (shape) => {
    Alert.alert(
      'Delete Shape',
      `Are you sure you want to delete "${shape.display_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteShape(shape.name);
              Alert.alert('Success', 'Shape deleted successfully.');
              clearShapesCache(); // Clear cache so customers see updates
              await loadShapes();
            } catch (error) {
              console.error('[ManageShapes] Error deleting shape:', error);
              Alert.alert('Error', 'Failed to delete shape. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleToggleVisible = async (shape) => {
    try {
      await updateShape(shape.name, {
        is_visible: !shape.is_visible,
      });
      clearShapesCache(); // Clear cache so customers see updates
      await loadShapes();
    } catch (error) {
      console.error('[ManageShapes] Error toggling visibility:', error);
      Alert.alert('Error', 'Failed to update shape. Please try again.');
    }
  };

  const renderShapeItem = ({ item: shape }) => {
    const finalPrice = Number(shape.base_price) + Number(shape.price_adjustment || 0);
    return (
      <View style={[styles.shapeItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.shapeItemContent}>
          {shape.image_url ? (
            <Image source={{ uri: shape.image_url }} style={styles.shapeImage} />
          ) : (
            <View style={[styles.shapeImagePlaceholder, { backgroundColor: colors.secondaryBackground }]}>
              <Icon name="image" color={colors.secondaryFont} size={24} />
            </View>
          )}
          <View style={styles.shapeInfo}>
            <Text style={[styles.shapeName, { color: colors.primaryFont }]}>{shape.display_name}</Text>
            <Text style={[styles.shapeDetails, { color: colors.secondaryFont }]}>
              ID: {shape.name} • ${finalPrice.toFixed(2)}
            </Text>
            <Text style={[styles.shapeDetails, { color: colors.secondaryFont }]}>
              Order: {shape.display_order} • {shape.is_visible ? 'Visible' : 'Hidden'}
            </Text>
          </View>
          <View style={styles.shapeActions}>
            <Switch
              value={shape.is_visible}
              onValueChange={() => handleToggleVisible(shape)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
            <TouchableOpacity
              onPress={() => handleEditShape(shape)}
              style={[styles.actionButton, { backgroundColor: withOpacity(colors.accent, 0.1) }]}
            >
              <Icon name="edit" color={colors.accent} size={18} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteShape(shape)}
              style={[styles.actionButton, { backgroundColor: withOpacity(colors.error, 0.1) }]}
            >
              <Icon name="trash" color={colors.error} size={18} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading && shapes.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevronLeft" color={colors.primaryFont} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.primaryFont }]}>Manage Shapes</Text>
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
        <Text style={[styles.headerTitle, { color: colors.primaryFont }]}>Manage Shapes</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.contentHeader}>
        <Text style={[styles.sectionTitle, { color: colors.primaryFont }]}>Shapes</Text>
        <TouchableOpacity
          onPress={handleCreateShape}
          style={[styles.addButton, { backgroundColor: colors.accent }]}
        >
          <Icon name="plus" color={colors.accentContrast || '#FFFFFF'} size={16} />
          <Text style={[styles.addButtonText, { color: colors.accentContrast || '#FFFFFF' }]}>
            Create
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={shapes}
        renderItem={renderShapeItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.secondaryFont }]}>No shapes found</Text>
          </View>
        }
      />

      {/* Shape Form Modal */}
      <Modal
        visible={showShapeForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShapeForm(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.primaryBackground }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowShapeForm(false)} style={styles.modalCloseButton}>
              <Icon name="close" color={colors.primaryFont} size={24} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.primaryFont }]}>
              {editingShape ? 'Edit Shape' : 'Create Shape'}
            </Text>
            <View style={styles.modalSpacer} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <Text style={[styles.label, { color: colors.primaryFont }]}>Name (Internal ID)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={shapeFormData.name}
              onChangeText={(text) => setShapeFormData((prev) => ({ ...prev, name: text }))}
              placeholder="e.g., almond, square"
              placeholderTextColor={colors.secondaryFont}
              editable={!editingShape} // Can't change name when editing
            />
            {editingShape && (
              <Text style={[styles.hint, { color: colors.secondaryFont }]}>
                Name cannot be changed after creation
              </Text>
            )}

            <Text style={[styles.label, { color: colors.primaryFont }]}>Display Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={shapeFormData.display_name}
              onChangeText={(text) => setShapeFormData((prev) => ({ ...prev, display_name: text }))}
              placeholder="e.g., Almond, Square"
              placeholderTextColor={colors.secondaryFont}
            />

            <Text style={[styles.label, { color: colors.primaryFont }]}>Image URL</Text>
            <View style={styles.imageSection}>
              {shapeFormData.image_url ? (
                <Image source={{ uri: shapeFormData.image_url }} style={styles.previewImage} />
              ) : null}
              <TouchableOpacity
                onPress={handleUploadShapeImage}
                style={[styles.uploadButton, { backgroundColor: colors.accent }]}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator color={colors.accentContrast} />
                ) : (
                  <Text style={[styles.uploadButtonText, { color: colors.accentContrast }]}>
                    {shapeFormData.image_url ? 'Change Image' : 'Upload Image'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.primaryFont }]}>Base Price ($)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={shapeFormData.base_price}
              onChangeText={(text) => setShapeFormData((prev) => ({ ...prev, base_price: text }))}
              placeholder="10"
              placeholderTextColor={colors.secondaryFont}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: colors.primaryFont }]}>Price Adjustment ($)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={shapeFormData.price_adjustment}
              onChangeText={(text) => setShapeFormData((prev) => ({ ...prev, price_adjustment: text }))}
              placeholder="0"
              placeholderTextColor={colors.secondaryFont}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.hint, { color: colors.secondaryFont }]}>
              Final price = Base Price + Adjustment (can be negative)
            </Text>

            <Text style={[styles.label, { color: colors.primaryFont }]}>Display Order</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.primaryFont, borderColor: colors.border }]}
              value={String(shapeFormData.display_order)}
              onChangeText={(text) => setShapeFormData((prev) => ({ ...prev, display_order: Number(text) || 0 }))}
              placeholder="0"
              placeholderTextColor={colors.secondaryFont}
              keyboardType="number-pad"
            />

            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: colors.primaryFont }]}>Visible to Customers</Text>
              <Switch
                value={shapeFormData.is_visible}
                onValueChange={(value) => setShapeFormData((prev) => ({ ...prev, is_visible: value }))}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setShowShapeForm(false)}
              style={[styles.cancelButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelButtonText, { color: colors.secondaryFont }]}>Cancel</Text>
            </TouchableOpacity>
            <PrimaryButton
              label={editingShape ? 'Update Shape' : 'Create Shape'}
              onPress={handleSaveShape}
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
    contentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
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
    listContent: {
      padding: 16,
    },
    shapeItem: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: 12,
      padding: 16,
    },
    shapeItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    shapeImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 12,
    },
    shapeImagePlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shapeInfo: {
      flex: 1,
    },
    shapeName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    shapeDetails: {
      fontSize: 12,
      marginBottom: 2,
    },
    shapeActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 8,
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
    hint: {
      fontSize: 12,
      marginTop: 4,
    },
    imageSection: {
      marginBottom: 16,
    },
    previewImage: {
      width: 200,
      height: 200,
      borderRadius: 8,
      marginBottom: 12,
    },
    uploadButton: {
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    uploadButtonText: {
      fontSize: 16,
      fontWeight: '600',
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

export default ManageShapesScreen;

