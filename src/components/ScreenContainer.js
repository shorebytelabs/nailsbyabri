import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

function ScreenContainer({ children, style, scroll = true }) {
  const { theme } = useTheme();
  const backgroundColor = theme?.colors?.primaryBackground || styles.view.backgroundColor;
  const contentStyle = [
    styles.inner,
    { backgroundColor },
    style,
  ];

  if (!scroll) {
    return <View style={[styles.view, { backgroundColor }, style]}>{children}</View>;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      style={[styles.scrollView, { backgroundColor }]}
    >
      <View style={contentStyle}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f7f7fb',
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  view: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
});

export default ScreenContainer;

