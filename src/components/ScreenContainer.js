import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

function ScreenContainer({ children, style, scroll = true }) {
  if (!scroll) {
    return <View style={[styles.view, style]}>{children}</View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollView}>
      <View style={[styles.inner, style]}>{children}</View>
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
    backgroundColor: '#f7f7fb',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
});

export default ScreenContainer;

