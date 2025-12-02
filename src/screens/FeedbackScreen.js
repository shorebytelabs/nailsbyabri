/**
 * Feedback Screen
 * Allows customers to submit feedback/reviews for completed orders
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import { submitFeedback, getFeedbackByOrderId, uploadFeedbackImages } from '../services/feedbackService';
import PrimaryButton from '../components/PrimaryButton';

// Rating labels and colors
const RATING_INFO = {
  1: { label: 'Poor', emoji: '😞', color: '#D84A5A' },
  2: { label: 'Fair', emoji: '😐', color: '#E89A5B' },
  3: { label: 'Good', emoji: '🙂', color: '#E8C95B' },
  4: { label: 'Great', emoji: '😊', color: '#6BB0D6' },
  5: { label: 'Excellent', emoji: '😍', color: '#4BB88A' },
};

function FeedbackScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { state, setState } = useAppState();
  const colors = theme?.colors || {};
  const orderId = route?.params?.orderId;
  const viewOnly = route?.params?.viewOnly || false; // Read-only mode for viewing existing feedback

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]); // Array of { id, uri, url, uploading, error }
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingFeedback, setExistingFeedback] = useState(null);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!orderId) {
      Alert.alert('Error', 'No order ID provided');
      navigation.goBack();
      return;
    }

    // Check if feedback already exists
    const loadExistingFeedback = async () => {
      try {
        const feedback = await getFeedbackByOrderId(orderId);
        if (feedback) {
          setExistingFeedback(feedback);
          setRating(feedback.rating);
          setComment(feedback.comment || '');
          setSubmitted(true);
          
          // Load existing images
          if (feedback.image_urls && Array.isArray(feedback.image_urls) && feedback.image_urls.length > 0) {
            const existingImages = feedback.image_urls.map((url, index) => ({
              id: `existing_${index}`,
              uri: url,
              url: url,
              uploading: false,
              error: null,
            }));
            setImages(existingImages);
          }
        }
      } catch (error) {
        console.error('[FeedbackScreen] Error loading existing feedback:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExistingFeedback();
  }, [orderId, navigation]);

  const handleAddImages = useCallback(async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false,
        quality: 0.85,
        maxWidth: 1500,
        selectionLimit: 0, // Allow multiple
      });

      if (response.didCancel) {
        return;
      }

      if (response.errorCode || response.errorMessage) {
        Alert.alert('Upload error', response.errorMessage || 'Unable to select images.');
        return;
      }

      const assets = Array.isArray(response.assets) ? response.assets : [];
      if (!assets.length) {
        return;
      }

      // Add images to state with temporary IDs
      const newImages = assets.map((asset, index) => ({
        id: `temp_${Date.now()}_${index}`,
        uri: asset.uri,
        url: null,
        uploading: false,
        error: null,
        fileName: asset.fileName || `feedback-${Date.now()}-${index}.jpg`,
        type: asset.type || 'image/jpeg',
      }));

      setImages((prev) => [...prev, ...newImages]);
    } catch (error) {
      console.error('[FeedbackScreen] Error selecting images:', error);
      Alert.alert('Error', 'Failed to select images. Please try again.');
    }
  }, []);

  const handleRemoveImage = useCallback((imageId) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    if (comment.length > 500) {
      Alert.alert('Comment Too Long', 'Comments must be 500 characters or less.');
      return;
    }

    try {
      setSubmitting(true);

      // Get user ID
      const userId = state.currentUser?.id || state.currentUser?.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Upload images first
      const imagesToUpload = images.filter((img) => !img.url && img.uri); // Only upload new images
      let uploadedImageUrls = [];

      if (imagesToUpload.length > 0) {
        // Mark images as uploading
        setImages((prev) =>
          prev.map((img) =>
            imagesToUpload.some((uploadImg) => uploadImg.id === img.id)
              ? { ...img, uploading: true }
              : img,
          ),
        );

        try {
          uploadedImageUrls = await uploadFeedbackImages(imagesToUpload, userId, orderId);
          
          // Update images with uploaded URLs
          setImages((prev) =>
            prev.map((img) => {
              const uploadedIndex = imagesToUpload.findIndex((uploadImg) => uploadImg.id === img.id);
              if (uploadedIndex >= 0 && uploadedIndex < uploadedImageUrls.length) {
                return {
                  ...img,
                  url: uploadedImageUrls[uploadedIndex],
                  uploading: false,
                };
              }
              return img;
            }),
          );
        } catch (uploadError) {
          console.error('[FeedbackScreen] Error uploading images:', uploadError);
          // Mark upload errors
          setImages((prev) =>
            prev.map((img) =>
              imagesToUpload.some((uploadImg) => uploadImg.id === img.id)
                ? { ...img, uploading: false, error: uploadError.message }
                : img,
            ),
          );
          Alert.alert('Upload Error', 'Some images failed to upload. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      // Collect all image URLs (existing + newly uploaded)
      const allImageUrls = images
        .map((img) => img.url || img.uri)
        .filter((url) => url);

      // Submit feedback with image URLs
      await submitFeedback(orderId, rating, comment || null, allImageUrls);
      setSubmitted(true);

      // Refresh orders to update status
      if (setState) {
        setState((prev) => ({
          ...prev,
          refreshOrders: true,
        }));
      }

      // Show success message
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error) {
      console.error('[FeedbackScreen] Error submitting feedback:', error);
      Alert.alert('Error', error.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [rating, comment, images, orderId, navigation, setState, state.currentUser]);

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isSelected = star <= rating;
          const ratingInfo = RATING_INFO[star];
          const starColor = isSelected ? ratingInfo.color : colors.border;
          
          return (
            <TouchableOpacity
              key={star}
              onPress={() => !submitted && !viewOnly && setRating(star)}
              disabled={submitted || viewOnly}
              style={styles.starButton}
              accessibilityRole="button"
              accessibilityLabel={`Rate ${star} star${star !== 1 ? 's' : ''} - ${ratingInfo.label}`}
            >
              <View style={styles.starWrapper}>
                <Icon
                  name={isSelected ? 'star' : 'starOutline'}
                  color={starColor}
                  size={40}
                />
                {isSelected && rating === star && (
                  <View style={[styles.ratingLabel, { backgroundColor: withOpacity(ratingInfo.color, 0.15) }]}>
                    <Text style={[styles.ratingLabelText, { color: ratingInfo.color }]}>
                      {ratingInfo.emoji} {ratingInfo.label}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderImageThumbnail = ({ item: image }) => {
    return (
      <View style={styles.imageThumbnailContainer}>
        <Image source={{ uri: image.url || image.uri }} style={styles.imageThumbnail} />
        {!submitted && !viewOnly && (
          <TouchableOpacity
            style={styles.removeImageButton}
            onPress={() => handleRemoveImage(image.id)}
            accessibilityLabel="Remove image"
          >
            <Icon name="close" color="#FFFFFF" size={16} />
          </TouchableOpacity>
        )}
        {image.uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}
        {image.error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>Error</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevronLeft" color={colors.primaryFont} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.primaryFont }]}>Review Your Order</Text>
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
        <Text style={[styles.headerTitle, { color: colors.primaryFont }]}>
          {viewOnly || submitted ? 'Your Feedback' : 'Review Your Order'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {viewOnly || submitted ? (
          <View style={styles.submittedContainer}>
            <View style={styles.successHeader}>
              <Icon name="checkCircle" color={colors.success || '#4B7A57'} size={64} />
              <Text style={[styles.successTitle, { color: colors.primaryFont }]}>
                Thank You! 💅
              </Text>
              <Text style={[styles.successMessage, { color: colors.secondaryFont }]}>
                Your feedback has been submitted. We appreciate your input!
              </Text>
            </View>

            <View style={styles.feedbackDisplay}>
              <View style={styles.ratingDisplay}>
                <Text style={[styles.ratingDisplayLabel, { color: colors.secondaryFont }]}>Your Rating:</Text>
                <View style={styles.ratingStarsDisplay}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Icon
                      key={star}
                      name={star <= rating ? 'star' : 'starOutline'}
                      color={star <= rating ? RATING_INFO[rating].color : colors.border}
                      size={24}
                    />
                  ))}
                  <Text style={[styles.ratingText, { color: colors.primaryFont }]}>
                    {RATING_INFO[rating].emoji} {RATING_INFO[rating].label}
                  </Text>
                </View>
              </View>

              {comment ? (
                <View style={styles.commentDisplay}>
                  <Text style={[styles.commentDisplayLabel, { color: colors.secondaryFont }]}>Your Comment:</Text>
                  <Text style={[styles.commentDisplayText, { color: colors.primaryFont }]}>{comment}</Text>
                </View>
              ) : null}

              {images.length > 0 ? (
                <View style={styles.imagesDisplay}>
                  <Text style={[styles.imagesDisplayLabel, { color: colors.secondaryFont }]}>Your Photos:</Text>
                  <FlatList
                    data={images}
                    renderItem={renderImageThumbnail}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.imagesList}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.primaryFont }]}>
                Tell us what you think of your new look!
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.secondaryFont }]}>
                Rate your order from 1 to 5 stars
              </Text>
              {renderStars()}
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.primaryFont }]}>
                Comments (Optional)
              </Text>
              <TextInput
                style={[
                  styles.commentInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.primaryFont,
                    borderColor: colors.border,
                  },
                ]}
                value={comment}
                onChangeText={setComment}
                placeholder="Your review matters! Share your thoughts..."
                placeholderTextColor={colors.secondaryFont}
                multiline
                numberOfLines={6}
                maxLength={500}
                editable={!submitted && !viewOnly}
              />
              <Text style={[styles.charCount, { color: colors.secondaryFont }]}>
                {comment.length}/500 characters
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.primaryFont }]}>
                Photos (Optional)
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.secondaryFont, marginBottom: 12 }]}>
                Upload your finished look
              </Text>
              
              {images.length > 0 && (
                <FlatList
                  data={images}
                  renderItem={renderImageThumbnail}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imagesList}
                  style={styles.imagesListContainer}
                />
              )}

              <TouchableOpacity
                style={[
                  styles.addImageButton,
                  {
                    backgroundColor: withOpacity(colors.accent, 0.1),
                    borderColor: colors.accent,
                  },
                ]}
                onPress={handleAddImages}
                disabled={submitted || viewOnly}
              >
                <Icon name="image" color={colors.accent} size={20} />
                <Text style={[styles.addImageButtonText, { color: colors.accent }]}>
                  {images.length > 0 ? 'Add More Photos' : 'Add Photos'}
                </Text>
              </TouchableOpacity>
            </View>

            {!viewOnly && (
              <View style={styles.buttonContainer}>
                <PrimaryButton
                  label={submitting ? 'Submitting...' : 'Submit Feedback'}
                  onPress={handleSubmit}
                  disabled={submitting || rating === 0}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      gap: 24,
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
    },
    sectionSubtitle: {
      fontSize: 14,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingVertical: 16,
      flexWrap: 'wrap',
      gap: 8,
    },
    starButton: {
      padding: 4,
      alignItems: 'center',
    },
    starWrapper: {
      alignItems: 'center',
      gap: 8,
    },
    ratingLabel: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginTop: 4,
    },
    ratingLabelText: {
      fontSize: 12,
      fontWeight: '600',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    commentInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: 12,
      textAlign: 'right',
      marginTop: 4,
    },
    imagesListContainer: {
      marginBottom: 12,
    },
    imagesList: {
      gap: 12,
      paddingRight: 20,
    },
    imageThumbnailContainer: {
      position: 'relative',
      width: 100,
      height: 100,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    imageThumbnail: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    removeImageButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(211, 47, 47, 0.8)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    addImageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
    },
    addImageButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    buttonContainer: {
      marginTop: 8,
    },
    submittedContainer: {
      gap: 24,
    },
    successHeader: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      gap: 16,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: '700',
    },
    successMessage: {
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 24,
    },
    feedbackDisplay: {
      gap: 20,
    },
    ratingDisplay: {
      gap: 8,
    },
    ratingDisplayLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    ratingStarsDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ratingText: {
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    commentDisplay: {
      gap: 8,
    },
    commentDisplayLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    commentDisplayText: {
      fontSize: 16,
      lineHeight: 24,
      padding: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    imagesDisplay: {
      gap: 8,
    },
    imagesDisplayLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
}

export default FeedbackScreen;
