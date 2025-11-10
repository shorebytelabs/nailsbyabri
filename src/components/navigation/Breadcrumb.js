import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { withOpacity } from '../../utils/color';

function Breadcrumb({ segments = [], style }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const baseColor = colors.secondaryFont || '#5C5F5D';
  const accentColor = colors.accent || '#6F171F';

  if (!segments.length) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const segmentColor = isLast ? accentColor : withOpacity(baseColor, 0.75);
        return (
          <View key={`${segment.label}-${index}`} style={styles.segment}>
            <Text
              style={[
                styles.label,
                {
                  color: segmentColor,
                  fontWeight: isLast ? '700' : '500',
                },
              ]}
            >
              {segment.label}
            </Text>
            {!isLast ? (
              <Text
                style={[
                  styles.separator,
                  { color: withOpacity(baseColor, 0.45) },
                ]}
              >
                /
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  separator: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});

export default Breadcrumb;

