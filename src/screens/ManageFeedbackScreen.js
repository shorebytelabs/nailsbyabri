/**
 * Manage Feedback Screen
 * Admin-only screen for viewing customer feedback/reviews
 */
import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity, View, Image, ScrollView, Modal, Dimensions, useWindowDimensions} from 'react-native';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import { getAllFeedback } from '../services/feedbackService';

function ManageFeedbackScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewImages, setPreviewImages] = useState(null); // { images: [], currentIndex: 0 }

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadFeedback();
  }, [isAdmin, navigation]);

  const loadFeedback = useCallback(async () => {
    try {
      setLoading(true);
      const allFeedback = await getAllFeedback();
      setFeedback(allFeedback || []);
    } catch (error) {
      console.error('[ManageFeedback] Error loading feedback:', error);
      Alert.alert('Error', 'Failed to load feedback. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeedback();
  }, [loadFeedback]);

  const renderStars = (rating) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon
            key={star}
            name={star <= rating ? 'star' : 'starOutline'}
            color={star <= rating ? colors.accent : colors.border}
            size={16}
          />
        ))}
      </View>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const renderFeedbackItem = ({ item }) => {
    // Order number is derived from order ID (first 8 characters, uppercased)
    const orderId = item.order_id || item.orders?.id || '';
    const orderNumber = orderId ? orderId.substring(0, 8).toUpperCase() : 'N/A';
    const customerName = item.profiles?.name || item.profiles?.full_name || 'Unknown';
    const customerEmail = item.profiles?.email || '';

    return (
      <View style={[styles.feedbackItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.feedbackHeader}>
          <View style={styles.feedbackHeaderLeft}>
            <AppText style={[styles.orderNumber, { color: colors.primaryFont }]}>
              Order #{orderNumber}
            </AppText>
            <AppText style={[styles.customerName, { color: colors.secondaryFont }]}>
              {customerName}
              {customerEmail ? ` • ${customerEmail}` : ''}
            </AppText>
          </View>
          <AppText style={[styles.timestamp, { color: colors.secondaryFont }]}>
            {formatDate(item.created_at)}
          </AppText>
        </View>
        <View style={styles.ratingContainer}>
          {renderStars(item.rating)}
          <AppText style={[styles.ratingText, { color: colors.primaryFont }]}>
            {item.rating}/5
          </AppText>
        </View>
        {item.comment && (
          <View style={styles.commentContainer}>
            <AppText style={[styles.commentLabel, { color: colors.secondaryFont }]}>Comment:</AppText>
            <AppText style={[styles.commentText, { color: colors.primaryFont }]}>
              {item.comment}
            </AppText>
          </View>
        )}
        {item.image_urls && Array.isArray(item.image_urls) && item.image_urls.length > 0 && (
          <View style={styles.imagesContainer}>
            <AppText style={[styles.imagesLabel, { color: colors.secondaryFont }]}>Photos:</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {item.image_urls.map((imageUrl, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setPreviewImages({ images: item.image_urls, currentIndex: index })}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: imageUrl }}
                    style={[styles.feedbackImage, { borderColor: colors.border }]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  if (loading && feedback.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevronLeft" color={colors.primaryFont} size={24} />
          </TouchableOpacity>
          <AppText style={[styles.headerTitle, { color: colors.primaryFont }]}>Customer Feedback</AppText>
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
        <AppText style={[styles.headerTitle, { color: colors.primaryFont }]}>Customer Feedback</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={feedback}
        renderItem={renderFeedbackItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppText style={[styles.emptyText, { color: colors.secondaryFont }]}>
              No feedback submitted yet
            </AppText>
          </View>
        }
      />

      {/* Image Preview Modal */}
      {previewImages && (
        <ImagePreviewModal
          images={previewImages.images}
          initialIndex={previewImages.currentIndex}
          onClose={() => setPreviewImages(null)}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

// Image Preview Modal Component with swipe navigation
function ImagePreviewModal({ images, initialIndex = 0, onClose, colors }) {
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef(null);

  const navButtonTop = height / 2 - 22; // Center vertically (half height minus half button height)
  const styles = useMemo(() => createModalStyles(colors, width, height, navButtonTop), [colors, width, height, navButtonTop]);

  useEffect(() => {
    // Scroll to initial index when modal opens
    if (flatListRef.current && initialIndex >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [initialIndex]);

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    if (index >= 0 && index < images.length && index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const handleScrollToIndexFailed = (info) => {
    // Fallback: scroll to offset if scrollToIndex fails
    const wait = new Promise(resolve => setTimeout(resolve, 500));
    wait.then(() => {
      flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
    });
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

  const renderImage = ({ item, index }) => {
    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item }}
          style={styles.previewImage}
          resizeMode="contain"
        />
      </View>
    );
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" color="#FFFFFF" size={28} />
        </TouchableOpacity>

        {/* Image carousel */}
        <FlatList
          ref={flatListRef}
          data={images}
          renderItem={renderImage}
          keyExtractor={(item, index) => `image-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          getItemLayout={(data, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          initialScrollIndex={initialIndex >= 0 && initialIndex < images.length ? initialIndex : 0}
          onScrollToIndexFailed={handleScrollToIndexFailed}
        />

        {/* Navigation buttons */}
        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={goToPrevious}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="chevronLeft" color="#FFFFFF" size={32} />
              </TouchableOpacity>
            )}
            {currentIndex < images.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonRight]}
                onPress={goToNext}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="chevronRight" color="#FFFFFF" size={32} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Image counter */}
        {images.length > 1 && (
          <View style={styles.counterContainer}>
            <AppText style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </AppText>
          </View>
        )}
      </View>
    </Modal>
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
    listContent: {
      padding: 16,
    },
    feedbackItem: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: 12,
      padding: 16,
    },
    feedbackHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    feedbackHeaderLeft: {
      flex: 1,
    },
    orderNumber: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    customerName: {
      fontSize: 13,
    },
    timestamp: {
      fontSize: 12,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 4,
    },
    ratingText: {
      fontSize: 14,
      fontWeight: '600',
    },
    commentContainer: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    commentLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 6,
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
    },
    imagesContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    imagesLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8,
    },
    imagesScroll: {
      marginHorizontal: -16,
      paddingHorizontal: 16,
    },
    feedbackImage: {
      width: 120,
      height: 120,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      marginRight: 12,
    },
    emptyContainer: {
      paddingVertical: 60,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      fontStyle: 'italic',
    },
  });
}

function createModalStyles(colors, screenWidth, screenHeight, navButtonTop) {
  return StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    carouselContainer: {
      flex: 1,
      width: screenWidth,
    },
    imageContainer: {
      width: screenWidth,
      height: screenHeight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewImage: {
      width: screenWidth,
      height: screenHeight,
    },
    closeButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButton: {
      position: 'absolute',
      top: navButtonTop,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    navButtonLeft: {
      left: 20,
    },
    navButtonRight: {
      right: 20,
    },
    counterContainer: {
      position: 'absolute',
      bottom: 50,
      alignSelf: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    counterText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
  });
}

export default ManageFeedbackScreen;

