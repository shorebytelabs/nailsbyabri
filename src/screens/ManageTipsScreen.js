/**
 * Manage Tips Screen
 * Admin-only screen for viewing and managing tips displayed on home screen
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import {
  getAllTips,
  createTip,
  updateTip,
  deleteTip,
  toggleTipEnabled,
} from '../services/tipsService';
import { supabase } from '../lib/supabaseClient';
import { SUPABASE_URL } from '../config/env';
import PrimaryButton from '../components/PrimaryButton';

function ManageTipsScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledFilter, setEnabledFilter] = useState(null); // null = all, true = enabled, false = disabled
  const [refreshing, setRefreshing] = useState(false);
  const [editingTip, setEditingTip] = useState(null);
  const [showTipForm, setShowTipForm] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [tipFormData, setTipFormData] = useState({
    title: '',
    description: '',
    image_url: null,
    image_path: null,
    youtube_url: '',
    enabled: true,
    display_order: 0,
  });

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadTips();
  }, [isAdmin, navigation]);

  const loadTips = useCallback(async () => {
    try {
      setLoading(true);
      const allTips = await getAllTips();
      setTips(allTips || []);
    } catch (error) {
      console.error('[ManageTips] Error loading tips:', error);
      Alert.alert('Error', 'Failed to load tips. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadTips();
  }, [loadTips]);

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
  }, []);

  const handleEnabledFilter = useCallback((enabled) => {
    setEnabledFilter(enabled === enabledFilter ? null : enabled);
  }, [enabledFilter]);

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
      console.error('[ManageTips] Error uploading tip image:', error);
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
        Alert.alert('Success', 'Tip updated');
      } else {
        await createTip(tipFormData, adminId);
        Alert.alert('Success', 'Tip created');
      }

      setShowTipForm(false);
      await loadTips();
    } catch (error) {
      console.error('[ManageTips] Error saving tip:', error);
      Alert.alert('Error', error.message || 'Failed to save tip. Please try again.');
    }
  };

  const handleToggleTipEnabled = async (tip) => {
    try {
      await toggleTipEnabled(tip.id, !tip.enabled);
      await loadTips();
    } catch (error) {
      console.error('[ManageTips] Error toggling tip:', error);
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
            } catch (error) {
              console.error('[ManageTips] Error deleting tip:', error);
              Alert.alert('Error', 'Failed to delete tip. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Filter tips based on search and enabled filter
  const filteredTips = useMemo(() => {
    let filtered = tips;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tip) =>
          tip.title?.toLowerCase().includes(query) ||
          tip.description?.toLowerCase().includes(query)
      );
    }

    // Apply enabled filter
    if (enabledFilter !== null) {
      filtered = filtered.filter((tip) => tip.enabled === enabledFilter);
    }

    return filtered;
  }, [tips, searchQuery, enabledFilter]);

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';

  const renderTipRow = ({ item: tip }) => (
    <View
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
          <AppText style={[styles.tipTitle, { color: primaryFont }]}>{tip.title}</AppText>
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
            <AppText
              style={[
                styles.toggleText,
                {
                  color: tip.enabled ? accent : secondaryFont,
                },
              ]}
            >
              {tip.enabled ? 'Active' : 'Inactive'}
            </AppText>
          </TouchableOpacity>
        </View>
        {tip.description && (
          <AppText style={[styles.tipDescription, { color: secondaryFont }]} numberOfLines={2}>
            {tip.description}
          </AppText>
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
          <AppText style={[styles.tipYoutube, { color: accent }]} numberOfLines={1}>
            Video: {tip.youtube_url}
          </AppText>
        )}
      </View>

      <View style={styles.tipActions}>
        <TouchableOpacity
          onPress={() => handleEditTip(tip)}
          style={[styles.actionButton, { borderColor: withOpacity(borderColor, 0.5) }]}
        >
          <AppText style={[styles.actionButtonText, { color: primaryFont }]}>Edit</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteTip(tip)}
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
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Manage Tips</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filtersContainer}>
        <View style={[styles.searchContainer, { borderColor: withOpacity(borderColor, 0.5) }]}>
          <Icon name="search" color={secondaryFont} size={18} />
          <TextInput
            style={[styles.searchInput, { color: primaryFont }]}
            placeholder="Search by title or description..."
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
            onPress={() => handleEnabledFilter(true)}
            style={[
              styles.filterChip,
              {
                backgroundColor: enabledFilter === true ? withOpacity(accent, 0.1) : surface,
                borderColor: enabledFilter === true ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: enabledFilter === true ? accent : primaryFont,
                },
              ]}
            >
              Active
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleEnabledFilter(false)}
            style={[
              styles.filterChip,
              {
                backgroundColor: enabledFilter === false ? withOpacity(accent, 0.1) : surface,
                borderColor: enabledFilter === false ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: enabledFilter === false ? accent : primaryFont,
                },
              ]}
            >
              Inactive
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleEnabledFilter(null)}
            style={[
              styles.filterChip,
              {
                backgroundColor: enabledFilter === null ? withOpacity(accent, 0.1) : surface,
                borderColor: enabledFilter === null ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: enabledFilter === null ? accent : primaryFont,
                },
              ]}
            >
              All
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.contentHeader}>
        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Tips</AppText>
        <TouchableOpacity
          onPress={handleCreateTip}
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
          <AppText style={[styles.loadingText, { color: secondaryFont }]}>Loading tips...</AppText>
        </View>
      ) : (
        <FlatList
          data={filteredTips}
          renderItem={renderTipRow}
          keyExtractor={(item) => item.id}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <AppText style={[styles.emptyText, { color: secondaryFont }]}>
                  {searchQuery || enabledFilter !== null
                    ? 'No tips match your filters'
                    : 'No tips yet. Create one to get started.'}
                </AppText>
              </View>
            ) : null
          }
        />
      )}

      {/* Tip Form Modal */}
      <Modal visible={showTipForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surface }]}>
            <View style={styles.modalHeader}>
              <AppText style={[styles.modalTitle, { color: primaryFont }]}>
                {editingTip ? 'Edit Tip' : 'Create Tip'}
              </AppText>
              <TouchableOpacity onPress={() => setShowTipForm(false)}>
                <Icon name="close" color={primaryFont} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContent}>
              <AppText style={[styles.formLabel, { color: primaryFont }]}>Title *</AppText>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={tipFormData.title}
                onChangeText={(text) => setTipFormData((prev) => ({ ...prev, title: text }))}
                placeholder="How to prep your nails"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
              />

              <AppText style={[styles.formLabel, { color: primaryFont }]}>Description *</AppText>
              <TextInput
                style={[styles.formInput, styles.formTextArea, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={tipFormData.description}
                onChangeText={(text) => setTipFormData((prev) => ({ ...prev, description: text }))}
                placeholder="Cleanse with alcohol wipes before applying press-ons for longer wear."
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                multiline
                numberOfLines={3}
              />

              <AppText style={[styles.formLabel, { color: primaryFont }]}>Photo</AppText>
              {tipFormData.image_url ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: tipFormData.image_url }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setTipFormData((prev) => ({ ...prev, image_url: null, image_path: null }))}
                    style={[styles.removeImageButton, { backgroundColor: colors.error || '#B33A3A' }]}
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
                    <AppText style={[styles.uploadButtonText, { color: accent }]}>
                      {tipFormData.image_url ? 'Change Photo' : 'Upload Photo'}
                    </AppText>
                  </>
                )}
              </TouchableOpacity>

              <AppText style={[styles.formLabel, { color: primaryFont }]}>YouTube Video URL (Optional)</AppText>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={tipFormData.youtube_url}
                onChangeText={(text) => setTipFormData((prev) => ({ ...prev, youtube_url: text }))}
                placeholder="https://www.youtube.com/watch?v=example"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                autoCapitalize="none"
                keyboardType="url"
              />

              <AppText style={[styles.formLabel, { color: primaryFont }]}>Display Order</AppText>
              <TextInput
                style={[styles.formInput, { borderColor: withOpacity(borderColor, 0.5), color: primaryFont, backgroundColor: surface }]}
                value={String(tipFormData.display_order)}
                onChangeText={(text) => {
                  const order = parseInt(text, 10);
                  setTipFormData((prev) => ({ ...prev, display_order: isNaN(order) ? 0 : order }));
                }}
                placeholder="0"
                placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                keyboardType="numeric"
              />

              {/* Active Toggle */}
              <View style={styles.switchRow}>
                <AppText style={[styles.formLabel, { color: primaryFont }]}>Active</AppText>
                <TouchableOpacity
                  onPress={() => setTipFormData((prev) => ({ ...prev, enabled: !prev.enabled }))}
                  style={[
                    styles.switch,
                    {
                      backgroundColor: tipFormData.enabled
                        ? accent
                        : withOpacity(borderColor, 0.3),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      {
                        transform: [{ translateX: tipFormData.enabled ? 20 : 0 }],
                      },
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowTipForm(false)}
                style={[styles.modalButton, { borderColor: withOpacity(borderColor, 0.5) }]}
              >
                <AppText style={[styles.modalButtonText, { color: primaryFont }]}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveTip}
                disabled={!tipFormData.title.trim() || !tipFormData.description.trim()}
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  {
                    backgroundColor: accent,
                    opacity: (!tipFormData.title.trim() || !tipFormData.description.trim()) ? 0.5 : 1,
                  },
                ]}
              >
                <AppText style={[styles.modalButtonText, styles.modalButtonPrimaryText, { color: colors.accentContrast || '#FFFFFF' }]}>
                  {editingTip ? 'Update' : 'Create'}
                </AppText>
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
    tipCard: {
      padding: 16,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
    },
    tipCardHeader: {
      gap: 8,
    },
    tipCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tipTitle: {
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
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
    tipDescription: {
      fontSize: 14,
      lineHeight: 20,
    },
    tipImagePreview: {
      marginTop: 8,
      borderRadius: 8,
      overflow: 'hidden',
      width: '100%',
      height: 150,
    },
    tipImageThumbnail: {
      width: '100%',
      height: '100%',
    },
    tipYoutube: {
      fontSize: 13,
      marginTop: 4,
    },
    tipActions: {
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
      width: 32,
      height: 32,
      borderRadius: 16,
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
  });
}

export default ManageTipsScreen;

