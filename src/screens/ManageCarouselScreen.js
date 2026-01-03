/**
 * Manage Carousel Screen
 * Admin-only screen for managing home screen carousel photos
 * Allows selecting photos from gallery or uploading new ones
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import { launchImageLibrary } from 'react-native-image-picker';
import { supabase } from '../lib/supabaseClient';
import { SUPABASE_URL } from '../config/env';
import { 
  getCarouselPhotos, 
  setCarouselPhotos 
} from '../services/appSettingsService';

const MAX_PHOTOS = 5;

function ManageCarouselScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const { width } = useWindowDimensions();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;
  const currentUserId = state.currentUser?.id;

  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState([]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const styles = useMemo(() => createStyles(colors, width), [colors, width]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadCarouselPhotos();
  }, [isAdmin, navigation]);

  const loadCarouselPhotos = useCallback(async () => {
    try {
      setLoading(true);
      const photoUrls = await getCarouselPhotos();
      setSelectedPhotoUrls(photoUrls);
    } catch (error) {
      console.error('[ManageCarousel] Error loading carousel photos:', error);
      Alert.alert('Error', 'Failed to load carousel photos. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGalleryImages = useCallback(async () => {
    try {
      setLoadingGallery(true);
      const { data, error } = await supabase
        .from('gallery_images')
        .select('id, image_url, file_name, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205') {
          setGalleryImages([]);
          return;
        }
        throw error;
      }

      setGalleryImages(data || []);
    } catch (error) {
      console.error('[ManageCarousel] Error loading gallery images:', error);
      Alert.alert('Error', 'Failed to load gallery images. Please try again.');
      setGalleryImages([]);
    } finally {
      setLoadingGallery(false);
    }
  }, []);

  const saveCarouselPhotos = useCallback(async (photoUrls) => {
    if (!currentUserId) {
      Alert.alert('Error', 'Admin user ID not found');
      return;
    }

    try {
      setSaving(true);
      await setCarouselPhotos(photoUrls, currentUserId);
    } catch (error) {
      console.error('[ManageCarousel] Error saving carousel photos:', error);
      Alert.alert('Error', error.message || 'Failed to save photos. Please try again.');
      await loadCarouselPhotos();
    } finally {
      setSaving(false);
    }
  }, [currentUserId, loadCarouselPhotos]);

  const handleSelectFromGallery = useCallback(async () => {
    if (selectedPhotoUrls.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can only have up to ${MAX_PHOTOS} photos in the carousel.`);
      return;
    }

    setShowGalleryModal(true);
    if (galleryImages.length === 0) {
      await loadGalleryImages();
    }
  }, [selectedPhotoUrls.length, galleryImages.length, loadGalleryImages]);

  const handleSelectGalleryPhoto = useCallback((imageUrl) => {
    if (selectedPhotoUrls.includes(imageUrl)) {
      // Already selected, remove it
      const newPhotos = selectedPhotoUrls.filter(url => url !== imageUrl);
      setSelectedPhotoUrls(newPhotos);
      saveCarouselPhotos(newPhotos);
    } else {
      // Add it if under limit
      if (selectedPhotoUrls.length >= MAX_PHOTOS) {
        Alert.alert('Limit Reached', `You can only have up to ${MAX_PHOTOS} photos in the carousel.`);
        return;
      }
      const newPhotos = [...selectedPhotoUrls, imageUrl].slice(0, MAX_PHOTOS);
      setSelectedPhotoUrls(newPhotos);
      saveCarouselPhotos(newPhotos);
    }
  }, [selectedPhotoUrls, saveCarouselPhotos]);

  const handleUploadNewPhoto = useCallback(async () => {
    if (selectedPhotoUrls.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can only have up to ${MAX_PHOTOS} photos in the carousel.`);
      return;
    }

    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false,
        quality: 0.85,
        maxWidth: 1500,
        selectionLimit: MAX_PHOTOS - selectedPhotoUrls.length,
      });

      if (response.didCancel || !response.assets?.length) {
        return;
      }

      setUploading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const uploadedUrls = [];

      for (const asset of response.assets) {
        if (!asset.uri) {
          continue;
        }

        const fileExt = asset.fileName?.split('.').pop() || asset.type?.split('/')[1] || 'jpg';
        const fileName = `carousel_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `gallery/${fileName}`;

        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: fileName,
        });

        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/gallery/${filePath}`;
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(errorText || 'Upload failed');
        }

        const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
          
          // Also insert into gallery_images table so it appears in gallery
          await supabase.from('gallery_images').insert({
            image_url: urlData.publicUrl,
            uploaded_by: currentUserId,
            file_name: fileName,
          });
        }
      }

      const newPhotos = [...selectedPhotoUrls, ...uploadedUrls].slice(0, MAX_PHOTOS);
      setSelectedPhotoUrls(newPhotos);
      await saveCarouselPhotos(newPhotos);
      
      // Reload gallery to include newly uploaded photos
      await loadGalleryImages();
    } catch (error) {
      console.error('[ManageCarousel] Error uploading photos:', error);
      Alert.alert('Upload Error', error.message || 'Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [selectedPhotoUrls, currentUserId, loadGalleryImages, saveCarouselPhotos]);

  const handleRemovePhoto = useCallback(async (photoUrl) => {
    const newPhotos = selectedPhotoUrls.filter(url => url !== photoUrl);
    setSelectedPhotoUrls(newPhotos);
    await saveCarouselPhotos(newPhotos);
  }, [selectedPhotoUrls, saveCarouselPhotos]);

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const accent = colors.accent || '#6F171F';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevronLeft" color={primaryFont} size={20} />
          </TouchableOpacity>
          <AppText style={[styles.headerTitle, { color: primaryFont }]}>Home Carousel</AppText>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  const cardWidth = Math.min(150, (width - 60) / 3);
  const cardHeight = cardWidth * 1.2;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronLeft" color={primaryFont} size={20} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Home Carousel</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: primaryFont }]}>Carousel Photos</AppText>
          <AppText style={[styles.sectionDescription, { color: secondaryFont }]}>
            Select up to {MAX_PHOTOS} photos from your gallery to display in the home screen carousel. These photos are shown to all users.
          </AppText>

          {/* Selected Photos */}
          {selectedPhotoUrls.length > 0 && (
            <View style={styles.selectedSection}>
              <AppText style={[styles.subsectionTitle, { color: primaryFont }]}>
                Selected Photos ({selectedPhotoUrls.length}/{MAX_PHOTOS})
              </AppText>
              <View style={styles.photosGrid}>
                {selectedPhotoUrls.map((photoUrl, index) => (
                  <View key={index} style={[styles.photoCard, { backgroundColor: surface, borderColor: accent, borderWidth: 2 }]}>
                    <Image source={{ uri: photoUrl }} style={styles.photoImage} resizeMode="cover" />
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: withOpacity(accent, 0.9) }]}
                      onPress={() => handleRemovePhoto(photoUrl)}
                      disabled={saving}
                    >
                      <Icon name="x" color="#FFFFFF" size={16} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          {selectedPhotoUrls.length < MAX_PHOTOS && (
            <View style={styles.actionsSection}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: accent }]}
                onPress={handleSelectFromGallery}
                disabled={saving || uploading}
              >
                <Icon name="gallery" color="#FFFFFF" size={20} />
                <AppText style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                  Select from Gallery
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary, { backgroundColor: surface, borderColor: borderColor }]}
                onPress={handleUploadNewPhoto}
                disabled={saving || uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={accent} />
                ) : (
                  <>
                    <Icon name="plus" color={accent} size={20} />
                    <AppText style={[styles.actionButtonText, { color: accent }]}>
                      Upload New Photo
                    </AppText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {selectedPhotoUrls.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: withOpacity(accent, 0.08) }]}>
              <Icon name="gallery" color={accent} size={48} />
              <AppText style={[styles.emptyText, { color: secondaryFont }]}>
                No photos selected yet. Select up to {MAX_PHOTOS} photos from your gallery to display in the carousel.
              </AppText>
            </View>
          )}

          <View style={[styles.infoBox, { backgroundColor: withOpacity(accent, 0.08) }]}>
            <Icon name="info" color={accent} size={18} />
            <AppText style={[styles.infoText, { color: secondaryFont }]}>
              Photos are displayed in the order they were selected. You can remove photos to replace them with new ones. Up to {MAX_PHOTOS} photos can be shown in the carousel.
            </AppText>
          </View>
        </View>
      </ScrollView>

      {/* Gallery Selection Modal */}
      <Modal
        visible={showGalleryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGalleryModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowGalleryModal(false)} style={styles.modalCloseButton}>
              <Icon name="x" color={primaryFont} size={24} />
            </TouchableOpacity>
            <AppText style={[styles.modalTitle, { color: primaryFont }]}>Select from Gallery</AppText>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            {loadingGallery ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={accent} />
              </View>
            ) : galleryImages.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Icon name="gallery" color={secondaryFont} size={48} />
                <AppText style={[styles.modalEmptyText, { color: secondaryFont }]}>
                  No photos in gallery yet. Upload photos to the gallery first.
                </AppText>
              </View>
            ) : (
              <View style={styles.galleryGrid}>
                {galleryImages.map((item) => {
                  const isSelected = selectedPhotoUrls.includes(item.image_url);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.galleryImageCard,
                        {
                          backgroundColor: surface,
                          borderColor: isSelected ? accent : borderColor,
                          borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                        },
                      ]}
                      onPress={() => handleSelectGalleryPhoto(item.image_url)}
                    >
                      <Image source={{ uri: item.image_url }} style={styles.galleryImage} resizeMode="cover" />
                      {isSelected && (
                        <View style={[styles.selectedBadge, { backgroundColor: accent }]}>
                          <Icon name="check" color="#FFFFFF" size={16} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors, screenWidth) => {
  const cardWidth = Math.min(150, (screenWidth - 60) / 3);
  const cardHeight = cardWidth * 1.2;

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withOpacity(colors.border || '#D9C8A9', 0.3),
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      flex: 1,
      textAlign: 'center',
      marginRight: -36,
    },
    headerSpacer: {
      width: 36,
    },
    content: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    section: {
      padding: 20,
      gap: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 4,
    },
    sectionDescription: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 8,
    },
    selectedSection: {
      gap: 12,
    },
    subsectionTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    photosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    photoCard: {
      width: cardWidth,
      height: cardHeight,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    removeButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionsSection: {
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    actionButtonSecondary: {
      borderWidth: StyleSheet.hairlineWidth,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    emptyState: {
      padding: 32,
      borderRadius: 16,
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    emptyText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withOpacity(colors.border || '#D9C8A9', 0.3),
    },
    modalCloseButton: {
      padding: 8,
      marginLeft: -8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      flex: 1,
      textAlign: 'center',
      marginRight: -36,
    },
    modalHeaderSpacer: {
      width: 36,
    },
    modalContent: {
      flex: 1,
    },
    modalLoading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    modalEmpty: {
      padding: 40,
      alignItems: 'center',
      gap: 12,
    },
    modalEmptyText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    galleryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 12,
      gap: 8,
    },
    galleryImageCard: {
      width: (screenWidth - 48) / 3,
      aspectRatio: 1,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    galleryImage: {
      width: '100%',
      height: '100%',
    },
    selectedBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
};

export default ManageCarouselScreen;
