import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import Icon from '../../icons/Icon';
import { withOpacity } from '../../utils/color';

function FloatingCreateButton({
  onPress,
  disabled = false,
  bottomInset = 0,
  labelVariant = 'Create Set',
}) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const [showLabel, setShowLabel] = useState(false);
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(400),
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 0,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bounceAnim]);

  const handleLongPress = () => {
    setShowLabel(true);
  };

  const handlePressOut = () => {
    setShowLabel(false);
  };

  const translateY = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const variants = useMemo(
    () => ['Create Set', 'Design', 'Make Magic'],
    [],
  );

  const computedLabel = variants.includes(labelVariant) ? labelVariant : variants[0];

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY }],
          bottom: Math.max(bottomInset + 16, 28),
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create new custom nail set"
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: disabled
              ? withOpacity(colors.accent, 0.2)
              : colors.accent,
            shadowColor: colors.shadow,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={onPress}
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
      >
        <Icon
          name="plus"
          color={disabled ? withOpacity(colors.accentContrast, 0.55) : colors.accentContrast}
        />
      </Pressable>
      {showLabel ? (
        <View
          style={[
            styles.labelBubble,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.labelText,
              {
                color: colors.primaryFont,
              },
            ]}
          >
            {computedLabel}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  button: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
  labelBubble: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default FloatingCreateButton;

