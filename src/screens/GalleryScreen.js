import React, { useMemo } from 'react';
import {
  FlatList,
  ImageBackground,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

const SAMPLE_POSTS = [
  {
    id: 'post_1',
    image:
      'https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=800&q=80',
    title: 'Summer Pastels',
    review: 'Loved the soft gradient and subtle shimmer!',
    likes: 128,
    comments: 14,
  },
  {
    id: 'post_2',
    image:
      'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=800&q=80',
    title: 'Midnight Sparkle',
    review: 'Perfect for my birthday weekend. Stayed flawless!',
    likes: 214,
    comments: 26,
  },
  {
    id: 'post_3',
    image:
      'https://images.unsplash.com/photo-1525182008055-f88b95ff7980?auto=format&fit=crop&w=800&q=80',
    title: 'Glossy Neutrals',
    review: 'A chic everyday set. Already planning my next one.',
    likes: 95,
    comments: 8,
  },
  {
    id: 'post_4',
    image:
      'https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=800&q=80',
    title: 'Rose Quartz Chrome',
    review: 'Could not stop staring at these all week!',
    likes: 176,
    comments: 19,
  },
];

const { width } = Dimensions.get('window');
const CARD_GUTTER = 16;
const CARD_WIDTH = Math.floor((width - CARD_GUTTER * 3) / 2);

function GalleryCard({ item, colors }) {
  const {
    surface,
    primaryFont,
    secondaryFont,
    border,
    shadow,
    accent,
  } = colors;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: surface,
          borderColor: border,
          shadowColor: withOpacity(shadow, 0.1),
        },
      ]}
    >
      <ImageBackground
        source={{ uri: item.image }}
        style={styles.cardImage}
        imageStyle={styles.cardImageRadius}
      >
        <View
          style={[
            styles.cardOverlay,
            { backgroundColor: withOpacity(surface, 0.1) },
          ]}
        />
      </ImageBackground>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: primaryFont }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.cardReview, { color: secondaryFont }]} numberOfLines={2}>
          {item.review}
        </Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={[styles.cardMeta, { color: secondaryFont }]}>
          ❤️ {item.likes}
        </Text>
        <Text style={[styles.cardMeta, { color: secondaryFont }]}>
          💬 {item.comments}
        </Text>
        <Text style={[styles.cardMetaLink, { color: accent }]}>View story</Text>
      </View>
    </View>
  );
}

function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme?.colors || {};

  const shadowColor = colors.shadow || '#000000';

  const paddingBottom = useMemo(
    () => Math.max(insets.bottom + 24, 32),
    [insets.bottom],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primaryBackground,
          paddingTop: 16,
          //paddingBottom,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.primaryFont }]}>Gallery</Text>
        <Text style={[styles.headerSubtitle, { color: colors.secondaryFont }]}>
          Browse sets loved by our community. Tap a card to see more soon.
        </Text>
      </View>
      <FlatList
        data={SAMPLE_POSTS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <GalleryCard item={item} colors={colors} />}
        ListFooterComponent={
          <View
            style={[
              styles.footerNote,
              {
                borderColor: withOpacity(shadowColor, 0.08),
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Text style={[styles.footerText, { color: colors.secondaryFont }]}>
              Want to share your own set? Soon you’ll be able to submit photos,
              leave reviews, and cheer on other artists.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: CARD_GUTTER,
  },
  header: {
    gap: 6,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 32,
    rowGap: CARD_GUTTER,
  },
  columnWrapper: {
    columnGap: CARD_GUTTER,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  cardImage: {
    height: CARD_WIDTH,
    width: '100%',
    justifyContent: 'flex-end',
  },
  cardImageRadius: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  cardOverlay: {
    height: '100%',
    width: '100%',
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardReview: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardMetaLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerNote: {
    marginTop: 20,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  footerText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

export default GalleryScreen;


