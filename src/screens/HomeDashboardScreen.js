import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {Alert, Animated, FlatList, Image, Linking, Pressable, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import AppText from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import Icon from '../icons/Icon';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import { getEnabledTips } from '../services/tipsService';
import { getCarouselPhotos } from '../services/appSettingsService';
import { getShapeById } from '../utils/pricing';

const CTA_LABEL = 'Create Nail Set';

// Smooth continuous scrolling carousel component
function CarouselInfiniteScroll({ photos, cardWidth, cardHeight, surfaceColor, borderColor, onPhotoPress }) {
  const scrollViewRef = useRef(null);
  const animationFrame = useRef(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef(null);
  const shouldScroll = useRef(true);
  const currentScrollX = useRef(0);
  
  // Create extended array with duplicates for seamless looping: [...photos, ...photos, ...photos]
  const extendedPhotos = useMemo(() => {
    if (photos.length === 0) return [];
    if (photos.length === 1) return [photos[0]];
    // Triple the array for smooth looping
    return [...photos, ...photos, ...photos];
  }, [photos]);

  const itemWidth = cardWidth + 12;
  const SCROLL_SPEED = 0.5; // pixels per frame (adjust for speed: higher = faster)
  const PAUSE_ON_INTERACTION = 3000; // Pause 3 seconds after user interaction

  // Calculate total width of one full set
  const oneSetWidth = photos.length * itemWidth;
  
  // Start position in the middle set (second set)
  const startOffset = oneSetWidth;

  const animateScroll = useCallback(() => {
    if (!shouldScroll.current || isUserScrolling.current || !scrollViewRef.current) {
      return;
    }

    currentScrollX.current += SCROLL_SPEED;

    // If we've scrolled past the end of the second set, reset to start of second set
    if (currentScrollX.current >= oneSetWidth * 2) {
      currentScrollX.current = startOffset;
      scrollViewRef.current.scrollTo({ x: startOffset, animated: false });
    } else {
      scrollViewRef.current.scrollTo({ x: currentScrollX.current, animated: false });
    }

    animationFrame.current = requestAnimationFrame(animateScroll);
  }, [oneSetWidth, startOffset]);

  const startAutoScroll = useCallback(() => {
    shouldScroll.current = true;
    if (photos.length <= 1) return;
    
    // Reset to start position
    currentScrollX.current = startOffset;
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: startOffset, animated: false });
    }
    
    // Start animation loop
    animateScroll();
  }, [photos.length, startOffset, animateScroll]);

  const stopAutoScroll = useCallback(() => {
    shouldScroll.current = false;
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  }, []);

  const handleScroll = useCallback((event) => {
    if (isUserScrolling.current) {
      currentScrollX.current = event.nativeEvent.contentOffset.x;
    }
  }, []);

  const handleScrollEnd = useCallback(() => {
    // Resume auto-scroll after user finishes scrolling
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    scrollTimeout.current = setTimeout(() => {
      isUserScrolling.current = false;
      // Reset scroll position to middle set if needed
      if (currentScrollX.current < oneSetWidth) {
        currentScrollX.current = startOffset;
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ x: startOffset, animated: false });
        }
      } else if (currentScrollX.current >= oneSetWidth * 2) {
        currentScrollX.current = startOffset;
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ x: startOffset, animated: false });
        }
      }
      startAutoScroll();
    }, PAUSE_ON_INTERACTION);
  }, [oneSetWidth, startOffset, startAutoScroll]);

  const handleScrollBeginDrag = useCallback(() => {
    isUserScrolling.current = true;
    stopAutoScroll();
  }, [stopAutoScroll]);

  // Initialize scroll position and start auto-scroll
  useEffect(() => {
    if (photos.length > 0 && scrollViewRef.current) {
      // Set initial scroll position to middle set
      setTimeout(() => {
        currentScrollX.current = startOffset;
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ x: startOffset, animated: false });
        }
        // Start auto-scroll after initial positioning
        setTimeout(() => {
          startAutoScroll();
        }, 500);
      }, 100);
    }

    // Cleanup on unmount
    return () => {
      shouldScroll.current = false;
      stopAutoScroll();
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [photos.length, startOffset, startAutoScroll, stopAutoScroll]);

  if (photos.length === 0) return null;

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onMomentumScrollEnd={handleScrollEnd}
      onScrollBeginDrag={handleScrollBeginDrag}
      decelerationRate={0}
      scrollEnabled={true}
    >
      {extendedPhotos.map((photoUrl, index) => (
        <TouchableOpacity
          key={`carousel-${index}-${photoUrl}`}
          style={[
            {
              backgroundColor: surfaceColor,
              borderColor: borderColor,
              width: cardWidth,
              height: cardHeight,
              borderRadius: 18,
              borderWidth: StyleSheet.hairlineWidth,
              overflow: 'hidden',
              marginRight: index < extendedPhotos.length - 1 ? 12 : 0,
              shadowColor: '#000000',
              shadowOpacity: 0.1,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            },
          ]}
          activeOpacity={0.9}
          onPress={onPhotoPress}
        >
          <Image
            source={{ uri: photoUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function HomeDashboardScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, handleStartOrder } = useAppState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const colors = theme?.colors || {};
  const horizontalPadding = Math.max(16, Math.min(28, width * 0.06));
  const isCompact = width < 780;
  const cardWidth = Math.min(240, width * 0.65) * 0.75; // 3/4 of original size
  const carouselCardWidth = cardWidth;
  const carouselCardHeight = carouselCardWidth * 1.0;

  const accentColor = colors.accent || '#6F171F';
  const accentContrastColor = colors.accentContrast || '#FFFFFF';
  const onSurfaceColor = colors.onSurface || colors.primaryFont; // Use onSurface for text on surface backgrounds
  const warningColor = colors.warning || '#FF9800';
  const errorColor = colors.error || '#B33A3A';
  const successColor = colors.success || '#4CAF50';
  const secondaryBackgroundColor = colors.secondaryBackground || '#BF9B7A';
  const surfaceColor = colors.surface || '#FFFFFF';
  const surfaceMutedColor = colors.surfaceMuted || colors.secondaryBackground || '#F9F3ED';
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const borderColor = colors.border || '#D9C8A9';




  const [tips, setTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(true);
  const [carouselPhotos, setCarouselPhotos] = useState([]);
  const [carouselLoading, setCarouselLoading] = useState(true);
  const tipsFlatListRef = useRef(null);

  const loadTips = useCallback(async () => {
    try {
      setTipsLoading(true);
      const enabledTips = await getEnabledTips();
      setTips(enabledTips || []);
    } catch (error) {
      console.error('[HomeDashboard] Error loading tips:', error);
      // Fallback to empty array on error
      setTips([]);
    } finally {
      setTipsLoading(false);
    }
  }, []);

  const loadCarouselPhotos = useCallback(async () => {
    try {
      setCarouselLoading(true);
      const photos = await getCarouselPhotos();
      setCarouselPhotos(photos || []);
    } catch (error) {
      console.error('[HomeDashboard] Error loading carousel photos:', error);
      setCarouselPhotos([]);
    } finally {
      setCarouselLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTips();
    loadCarouselPhotos();
  }, [loadTips, loadCarouselPhotos]);

  // Reload carousel photos when screen comes into focus (e.g., after admin updates)
  useFocusEffect(
    useCallback(() => {
      loadCarouselPhotos();
    }, [loadCarouselPhotos])
  );

  // Calculate notification count for badge
  const notificationCount = useMemo(() => {
    // Return count of notifications (not the actual messages)
    return 2; // Shipment and care notifications
  }, []);

  // Use the EXACT same handler as the plus button in MainTabs (openCreateFlow)
  const handleCreatePress = useCallback(() => {
    const canProceed = handleStartOrder({ navigation });
    if (canProceed) {
      logEvent('tap_home_create');
      navigation.navigate('NewOrderFlow');
    }
  }, [handleStartOrder, navigation]);

  const handleOpenUrl = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.warn('[HomeDashboard] Cannot open URL:', url);
      }
    } catch (error) {
      console.error('[HomeDashboard] Error opening URL:', error);
    }
  };

  // Helper function to render tip description with optional YouTube link
  const renderTipDescription = (description, youtubeUrl) => {
    if (!youtubeUrl) {
      return <AppText style={[styles.tipCopy, { color: colors.secondaryFont }]}>{description}</AppText>;
    }

    return (
      <AppText style={[styles.tipCopy, { color: colors.secondaryFont }]}>
        {description}
        {' '}
        <AppText
          style={[styles.tipLink, { color: accentColor }]}
          onPress={() => handleOpenUrl(youtubeUrl)}
        >
          Watch this video
        </AppText>
      </AppText>
    );
  };

  const styles = useMemo(
    () =>
      createStyles({
        accentColor,
        primaryFontColor,
        secondaryFontColor,
        surfaceColor,
        borderColor,
        horizontalPadding,
        cardWidth,
        primaryBackgroundColor: colors.primaryBackground,
        surfaceMutedColor,
      }),
    [accentColor, primaryFontColor, secondaryFontColor, surfaceColor, borderColor, horizontalPadding, cardWidth, colors.primaryBackground, surfaceMutedColor]
  );

  return (
    <View style={{ flex: 1 }}>
      <GestureScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: 10 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        scrollEnabled={true}
        nestedScrollEnabled={true}
        scrollEventThrottle={16}
        directionalLockEnabled={false}
      >
      <View style={[styles.heroCard, { backgroundColor: withOpacity(colors.secondaryBackground || '#E7D8CA', 0.5) }]}>
        <AppText
          style={[
            styles.heroTitle,
            { color: primaryFontColor },
          ]}
        >
          Design your Perfect Nails
        </AppText>
        <AppText
          style={[
            styles.heroSubtitle,
            { color: secondaryFontColor },
          ]}
        >
          Pick your shape, design, and sizing in minutes
        </AppText>
        <Pressable
          style={({ pressed }) => [
            styles.heroButton,
            { 
              backgroundColor: accentColor,
              shadowColor: accentColor,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPressIn={handleCreatePress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Create new custom nail set"
          accessibilityRole="button"
        >
          <AppText style={[styles.heroButtonText, { color: accentContrastColor }]}>
            {CTA_LABEL}
          </AppText>
        </Pressable>
      </View>

      {carouselPhotos.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <AppText
              style={[
                styles.sectionTitle,
                { color: colors.primaryFont },
              ]}
            >
              Gallery
            </AppText>
            <Pressable
              onPressIn={() => navigation.navigate('Gallery')}
              style={({ pressed }) => [
                styles.viewAllButton,
                { opacity: pressed ? 0.7 : 1 }
              ]}
              accessibilityRole="button"
            >
              <AppText style={[styles.viewAllButtonText, { color: accentColor }]}>
                View All
              </AppText>
            </Pressable>
          </View>
          <CarouselInfiniteScroll
            photos={carouselPhotos}
            cardWidth={carouselCardWidth}
            cardHeight={carouselCardHeight}
            surfaceColor={surfaceColor}
            borderColor={borderColor}
            onPhotoPress={() => navigation.navigate('Gallery')}
          />
        </>
      )}

      <View style={styles.sectionHeader}>
        <AppText
          style={[
            styles.sectionTitle,
            { color: colors.primaryFont },
          ]}
        >
          Tips
        </AppText>
      </View>
      {tipsLoading ? (
        <View style={styles.tipsLoadingContainer}>
          <AppText style={[styles.tipsLoadingText, { color: colors.secondaryFont }]}>
            Loading tips...
          </AppText>
        </View>
      ) : tips.length === 0 ? (
        <View style={styles.tipsEmptyContainer}>
          <AppText style={[styles.tipsEmptyText, { color: colors.secondaryFont }]}>
            No tips available at the moment.
          </AppText>
        </View>
      ) : (
        <FlatList
          data={tips}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tipsCarousel}
          snapToInterval={cardWidth + 12} // card width + gap
          decelerationRate="fast"
          pagingEnabled={false}
          onScrollBeginDrag={() => {
            // Claim gesture priority for horizontal scrolling
          }}
          scrollEventThrottle={16}
          renderItem={({ item: tip }) => (
            <View
              style={[
                styles.tipCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  width: cardWidth,
                },
              ]}
            >
              {tip.image_url ? (
                <Image
                  source={{ uri: tip.image_url }}
                  style={styles.tipImage}
                  resizeMode="cover"
                />
              ) : null}
              <AppText
                style={[
                  styles.tipTitle,
                  { color: onSurfaceColor },
                ]}
                numberOfLines={1}
              >
                {tip.title}
              </AppText>
              {renderTipDescription(tip.description, tip.youtube_url)}
            </View>
          )}
        />
      )}
      </GestureScrollView>
    </View>
  );
}

const createStyles = ({
  accentColor,
  primaryFontColor,
  secondaryFontColor,
  surfaceColor,
  borderColor,
  horizontalPadding,
  cardWidth,
  primaryBackgroundColor,
  surfaceMutedColor,
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: primaryBackgroundColor || '#F4EBE3',
    },
    content: {
      gap: 18,
      paddingBottom: 40,
    },
    heroCard: {
      borderRadius: 0,
      paddingVertical: 24,
      paddingHorizontal: 20,
      minHeight: 150,
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    heroBackgroundImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    },
    heroOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)', // Dark overlay for text readability
    },
    heroTextGroup: {
      gap: 12,
      zIndex: 1,
      position: 'relative',
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
      lineHeight: 32,
    },
    heroSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      marginTop: 2,
    },
    heroButton: {
      marginTop: 8,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 28,
      alignSelf: 'flex-start',
      minHeight: 56,
      justifyContent: 'center',
      alignItems: 'center',
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 4,
      zIndex: 10,
    },
    heroButtonText: {
      fontWeight: '700',
      fontSize: 16,
      letterSpacing: 0.3,
      marginTop: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: horizontalPadding,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
    },
    viewAllButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    viewAllButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    carouselContainer: {
      paddingVertical: 4,
      gap: 12,
    },
    carouselCard: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      aspectRatio: 0.83, // Approximately 1.2:1 (width:height) for a slightly taller card
      shadowColor: '#000000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    carouselImage: {
      width: '100%',
      height: '100%',
    },
    tipsCarousel: {
      paddingVertical: 4,
      paddingLeft: horizontalPadding,
      gap: 12,
    },
    tipsLoadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    tipsLoadingText: {
      fontSize: 14,
    },
    tipsEmptyContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    tipsEmptyText: {
      fontSize: 14,
    },
    tipCard: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 0,
      gap: 0,
      marginRight: 12,
      overflow: 'hidden',
    },
    tipImage: {
      width: '100%',
      height: 120,
      backgroundColor: '#f0f0f0',
    },
    tipTitle: {
      fontSize: 16,
      fontWeight: '700',
      padding: 16,
      paddingBottom: 8,
    },
    tipCopy: {
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    tipLink: {
      fontSize: 13,
      lineHeight: 18,
      textDecorationLine: 'underline',
      fontWeight: '600',
    },
  });

export default HomeDashboardScreen;
