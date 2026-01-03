import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {FlatList, Image, Linking, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import AppText from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import Icon from '../icons/Icon';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import { getEnabledTips } from '../services/tipsService';
import { getShapeById } from '../utils/pricing';

const CTA_LABEL = 'Create Nail Set';

function HomeDashboardScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, handleStartOrder } = useAppState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const colors = theme?.colors || {};
  const horizontalPadding = Math.max(16, Math.min(28, width * 0.06));
  const isCompact = width < 780;
  const cardWidth = Math.min(240, width * 0.65);

  const accentColor = colors.accent || '#6F171F';
  const accentContrastColor = colors.accentContrast || '#FFFFFF';
  const onSurfaceColor = colors.onSurface || colors.primaryFont; // Use onSurface for text on surface backgrounds
  const warningColor = colors.warning || '#FF9800';
  const errorColor = colors.error || '#B33A3A';
  const successColor = colors.success || '#4CAF50';
  const secondaryBackgroundColor = colors.secondaryBackground || '#BF9B7A';
  const surfaceColor = colors.surface || '#FFFFFF';
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const borderColor = colors.border || '#D9C8A9';




  const [tips, setTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(true);

  useEffect(() => {
    loadTips();
  }, []);

  const loadTips = async () => {
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
  };

  // Calculate notification count for badge
  const notificationCount = useMemo(() => {
    // Return count of notifications (not the actual messages)
    return 2; // Shipment and care notifications
  }, []);

  const handleCreatePress = () => {
    const canProceed = handleStartOrder({ navigation });
    if (canProceed) {
      logEvent('tap_home_create');
      navigation.navigate('NewOrderFlow');
    }
  };

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


  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom + 24, 36),
          paddingHorizontal: horizontalPadding,
          backgroundColor: colors.primaryBackground,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
        <View
          style={[
            styles.heroCard,
            {
              // OPTION 1: Solid color (brown/beige)
              // backgroundColor: colors.secondaryBackground,
              
              // OPTION 2: Lighter gradient-like color (uncomment to try)
              // backgroundColor: withOpacity(colors.primaryBackground, 0.6),
              
              // OPTION 3: Accent color with low opacity
              // backgroundColor: withOpacity(accentColor, 0.1),
              
              // OPTION 3B: Light cream/beige tint (ACTIVE) - similar to Option 3 but different color
              backgroundColor: withOpacity(colors.secondaryBackground || '#E7D8CA', 0.5),//.3
              
              // OPTION 4: White/light surface (uncomment to try)
              // backgroundColor: colors.surface,
              
              // OPTION 5: Image Background - uncomment Image and overlay below
              // backgroundColor: 'transparent',
            },
          ]}
        >
          {/* OPTION 5: Image Background - uncomment to use */}
          {/* 
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80' }}
            style={styles.heroBackgroundImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          */}
          
          <View style={styles.heroTextGroup}>
            <AppText
              style={[
                styles.heroTitle,
                { color: colors.primaryFont },
              ]}
            >
              Design Your Perfect Nails
            </AppText>
            <AppText
              style={[
                styles.heroSubtitle,
                { color: colors.secondaryFont },
              ]}
            >
              Pick your shape, design, and sizing in minutes
            </AppText>
            <TouchableOpacity
              style={[
                styles.heroButton,
                { 
                  backgroundColor: accentColor,
                  shadowColor: accentColor,
                },
              ]}
              onPress={handleCreatePress}
              accessibilityLabel="Create new custom nail set"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.85}
            >
              <AppText style={[styles.heroButtonText, { color: accentContrastColor }]}>
                {CTA_LABEL}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

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
            <AppText style={[styles.tipsLoadingText, { color: colors.secondaryFont }]}>Loading tips...</AppText>
          </View>
        ) : tips.length === 0 ? (
          <View style={styles.tipsEmptyContainer}>
            <AppText style={[styles.tipsEmptyText, { color: colors.secondaryFont }]}>No tips available</AppText>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingTop: 10,
  },
  heroCard: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    minHeight: 180,
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
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipsCarousel: {
    paddingVertical: 4,
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

