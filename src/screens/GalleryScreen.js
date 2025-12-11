import React, { useState, useEffect, useMemo } from 'react';
import {View, StyleSheet, FlatList, Image, TouchableOpacity, Modal, Dimensions, ActivityIndicator, Alert, ScrollView, useWindowDimensions} from 'react-native';
import AppText from '../components/AppText';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import Icon from '../icons/Icon';
import { supabase } from '../lib/supabaseClient';
import { logEvent } from '../utils/analytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SPACING = 6; // 6px spacing between items
const GRID_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

function GalleryScreen() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = Boolean(state.currentUser?.isAdmin);

  const [galleryImages, setGalleryImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewScrollRef = React.useRef(null);

  // Calculate item size based on current width, accounting for padding
  // scrollContent has paddingHorizontal: 20, so we need to subtract 40 (20 on each side)
  const itemSize = useMemo(() => {
    const paddingHorizontal = 20; // Match scrollContent paddingHorizontal
    const availableWidth = width - (paddingHorizontal * 2);
    return (availableWidth - GRID_SPACING * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  }, [width]);

  // Load gallery images from Supabase
  useEffect(() => {
    loadGalleryImages();
  }, []);

  const loadGalleryImages = async () => {
    try {
      setLoading(true);
      
      // Fetch from gallery_images table
      // OPTIMIZATION: Only select needed fields to reduce cached egress
      // Images are stored in Storage, so we only need URLs and metadata
      const { data, error } = await supabase
        .from('gallery_images')
        .select('id, image_url, file_name, created_at, uploaded_by')
        .order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist, show empty state
        if (error.code === 'PGRST205') {
          console.log('[Gallery] gallery_images table not found, showing empty state');
          setGalleryImages([]);
          return;
        }
        throw error;
      }

      setGalleryImages(data || []);
    } catch (error) {
      console.error('[Gallery] Error loading images:', error);
      Alert.alert('Error', 'Failed to load gallery images. Please try again.');
      setGalleryImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false, // Use file URI instead of base64
        quality: 0.85,
        maxWidth: 1500,
        selectionLimit: 10, // Allow multiple image selection
      });

      if (response.didCancel || !response.assets?.length) {
        return;
      }

      setUploading(true);

      const uploadPromises = response.assets.map(async (asset, index) => {
        try {
          // Use file URI directly (React Native compatible)
          if (!asset.uri) {
            throw new Error('No file URI available');
          }

          // Generate unique filename
          const fileExt = asset.fileName?.split('.').pop() || asset.type?.split('/')[1] || 'jpg';
          const fileName = `${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `gallery/${fileName}`;

          // Upload using file URI directly with FormData (React Native compatible)
          const fileUri = asset.uri;
          
          // Create FormData for React Native
          const formData = new FormData();
          formData.append('file', {
            uri: fileUri,
            type: asset.type || 'image/jpeg',
            name: fileName,
          });

          // Get session for authentication
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('Not authenticated');
          }

          // Upload using Supabase Storage REST API directly
          const { SUPABASE_URL } = require('../config/env');
          const uploadUrl = `${SUPABASE_URL}/storage/v1/object/gallery/${filePath}`;

          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              // Don't set Content-Type - let FormData set it with boundary
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
            throw new Error(
              errorMessage ||
              'Failed to upload to storage. Please ensure the gallery bucket exists and you have permission to upload.',
            );
          }

          // Get public URL from storage
          const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(filePath);

          if (!urlData?.publicUrl) {
            throw new Error('Failed to get image URL from storage.');
          }

          const imageUrl = urlData.publicUrl;

          // Insert record into gallery_images table
          const { error: insertError } = await supabase.from('gallery_images').insert({
            image_url: imageUrl,
            uploaded_by: state.currentUser?.id,
            file_name: fileName,
          });

          if (insertError) {
            // If database insert fails, try to delete the uploaded file from storage
            console.error('[Gallery] Database insert failed, cleaning up storage:', insertError);
            await supabase.storage.from('gallery').remove([filePath]);
            throw insertError;
          }

          return { success: true, fileName };
        } catch (error) {
          console.error('[Gallery] Error uploading individual image:', error);
          return { success: false, error: error.message };
        }
      });

      const results = await Promise.all(uploadPromises);
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      // Reload gallery
      await loadGalleryImages();

      // Show success/error message
      if (successful > 0 && failed === 0) {
        logEvent('gallery_images_uploaded', { count: successful, method: 'storage' });
        if (successful > 1) {
          Alert.alert('Success', `Successfully uploaded ${successful} images.`);
        }
      } else if (successful > 0 && failed > 0) {
        Alert.alert(
          'Partial Success',
          `Uploaded ${successful} image(s), but ${failed} failed. Please try again.`,
        );
      } else {
        throw new Error('All uploads failed. Please try again.');
      }
    } catch (error) {
      console.error('[Gallery] Error uploading images:', error);
      Alert.alert(
        'Upload Error',
        error.message || 'Failed to upload images to storage. Please try again or contact support if the issue persists.',
      );
    } finally {
      setUploading(false);
    }
  };

  const openPreview = (index) => {
    setPreviewIndex(index);
    setPreviewVisible(true);
    logEvent('gallery_image_viewed', { index });
    // Scroll to selected image after modal opens
    setTimeout(() => {
      if (previewScrollRef.current) {
        previewScrollRef.current.scrollTo({ x: index * width, animated: false });
      }
    }, 100);
  };

  const closePreview = () => {
    setPreviewVisible(false);
  };

  const handleDeleteImage = async (item, index) => {
    // Confirm deletion
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Extract file path from storage URL
              // URL format: https://[project].supabase.co/storage/v1/object/public/gallery/[filename]
              let filePath = null;
              if (item.image_url) {
                const urlParts = item.image_url.split('/gallery/');
                if (urlParts.length > 1) {
                  filePath = `gallery/${urlParts[1]}`;
                }
              }

              // Delete from storage if we have the path
              if (filePath) {
                const { error: storageError } = await supabase.storage
                  .from('gallery')
                  .remove([filePath]);

                if (storageError) {
                  console.warn('[Gallery] Error deleting from storage:', storageError);
                  // Continue with database deletion even if storage deletion fails
                }
              }

              // Delete from database
              const { error: deleteError } = await supabase
                .from('gallery_images')
                .delete()
                .eq('id', item.id);

              if (deleteError) {
                throw deleteError;
              }

              // Reload gallery to reflect changes
              await loadGalleryImages();
              logEvent('gallery_image_deleted', { imageId: item.id });
            } catch (error) {
              console.error('[Gallery] Error deleting image:', error);
              Alert.alert('Delete Error', error.message || 'Failed to delete image. Please try again.');
            }
          },
        },
      ],
    );
  };

  const getImageSource = (item) => {
    // Only use Supabase Storage URLs (no base64/data URI support)
    if (item.image_url && !item.image_url.startsWith('data:')) {
      return { uri: item.image_url };
    }
    // If image_url is missing or is a data URI, skip it
    console.warn('[Gallery] Skipping image with invalid or missing storage URL:', item.id);
    return null;
  };

  const renderGalleryItem = ({ item, index }) => {
    const imageSource = getImageSource(item);
    
    if (!imageSource) {
      return null;
    }

    return (
      <View
        key={item.id || index}
        style={[
          styles.galleryItem,
          {
            width: itemSize,
            height: itemSize,
            marginHorizontal: GRID_SPACING / 2,
            marginBottom: GRID_SPACING,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => openPreview(index)}
          activeOpacity={0.8}
          style={styles.galleryImageContainer}
        >
          <Image
            source={imageSource}
            style={styles.galleryImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => handleDeleteImage(item, index)}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Delete image"
          >
            <View style={styles.deleteButtonInner}>
              <Icon name="close" color="#FFFFFF" size={14} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="gallery" color={colors.secondaryFont || '#5C5F5D'} size={48} />
      <AppText style={[styles.emptyText, { color: colors.secondaryFont || '#5C5F5D' }]}>
        No images in gallery yet
      </AppText>
      {isAdmin && (
        <AppText style={[styles.emptySubtext, { color: colors.secondaryFont || '#5C5F5D' }]}>
          Tap the upload button to add photos
        </AppText>
      )}
    </View>
  );

  const {
    primaryBackground,
    secondaryBackground,
    surface,
    primaryFont,
    secondaryFont,
    border,
  } = colors || {};

  const styles = useMemo(
    () =>
      createStyles({
        primaryBackground,
        secondaryBackground,
        surface,
        primaryFont,
        secondaryFont,
        border,
        itemSize,
        width,
      }),
    [primaryBackground, secondaryBackground, surface, primaryFont, secondaryFont, border, itemSize, width],
  );

  return (
    <View style={[styles.container, { backgroundColor: primaryBackground || '#F4EBE3' }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { backgroundColor: primaryBackground || '#F4EBE3' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText style={[styles.headerTitle, { color: primaryFont || '#220707' }]}>Gallery</AppText>
            <AppText style={[styles.headerSubtitle, { color: secondaryFont || '#5C5F5D' }]}>
              Inspiration from our latest designs
            </AppText>
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={handleUploadImage}
              disabled={uploading}
              style={[
                styles.uploadButton,
                {
                  borderColor: withOpacity(colors.accent || '#6F171F', 0.35),
                  backgroundColor: withOpacity(colors.accent || '#6F171F', 0.08),
                  opacity: uploading ? 0.6 : 1,
                },
              ]}
            >
              {uploading ? (
                <ActivityIndicator color={colors.accent || '#6F171F'} size="small" />
              ) : (
                <>
                  <Icon name="plus" color={colors.accent || '#6F171F'} size={16} />
                  <AppText style={[styles.uploadButtonLabel, { color: colors.accent || '#6F171F' }]}>
                    Add image
                  </AppText>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Gallery Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent || '#6F171F'} />
          </View>
        ) : galleryImages.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.galleryGridContainer}>
            <View style={styles.galleryGrid}>
              {galleryImages.map((item, index) => renderGalleryItem({ item, index }))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Full-Screen Preview Modal */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewContainer}>
          <TouchableOpacity
            style={styles.previewCloseButton}
            onPress={closePreview}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <View style={styles.previewCloseButtonInner}>
              <Icon name="close" color="#FFFFFF" size={24} />
            </View>
          </TouchableOpacity>

          <ScrollView
            ref={previewScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
              setPreviewIndex(newIndex);
            }}
            style={styles.previewScrollView}
            contentContainerStyle={styles.previewScrollContent}
          >
            {galleryImages.map((item, index) => {
              const imageSource = getImageSource(item);
              if (!imageSource) return null;

              return (
                <View key={item.id || index} style={[styles.previewImageContainer, { width }]}>
                  <Image
                    source={imageSource}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </View>
              );
            })}
          </ScrollView>

          {/* Preview Indicator */}
          {galleryImages.length > 1 && (
            <View style={styles.previewIndicator}>
              <AppText style={styles.previewIndicatorText}>
                {previewIndex + 1} / {galleryImages.length}
              </AppText>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function createStyles({ primaryBackground, surface, primaryFont, secondaryFont, border, itemSize, width }) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      gap: 18,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
      gap: 6,
    },
    headerText: {
      flex: 1,
      gap: 6,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
    },
    headerSubtitle: {
      fontSize: 14,
      lineHeight: 20,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    uploadButtonLabel: {
      fontSize: 13,
      fontWeight: '700',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },
    galleryGridContainer: {
      marginTop: 8,
    },
    galleryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -GRID_SPACING / 2,
    },
    galleryItem: {
      marginHorizontal: GRID_SPACING / 2,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: surface || '#FFFFFF',
      shadowColor: '#000000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      position: 'relative',
    },
    galleryImageContainer: {
      width: '100%',
      height: '100%',
    },
    galleryImage: {
      width: '100%',
      height: '100%',
    },
    deleteButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      zIndex: 10,
    },
    deleteButtonInner: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
    },
    previewCloseButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
    },
    previewCloseButtonInner: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewScrollView: {
      flex: 1,
    },
    previewScrollContent: {
      flexDirection: 'row',
    },
    previewImageContainer: {
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    previewIndicator: {
      position: 'absolute',
      bottom: 40,
      alignSelf: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    previewIndicatorText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
  });
}

export default GalleryScreen;

