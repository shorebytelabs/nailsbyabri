/**
 * Falling Leaves Background Component
 * Displays autumn-themed falling leaves animation
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LEAF_COUNT = 35;
const LEAF_COLORS = ['#D2691E', '#CD853F', '#DA8709', '#B8860B', '#8B4513', '#A0522D', '#DEB887'];

function FallingLeaves({ visible }) {
  const leaves = useMemo(
    () => {
      if (__DEV__) {
        console.log('[FallingLeaves] Generating leaves, visible:', visible);
      }
      return Array.from({ length: LEAF_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        size: Math.random() * 12 + 6, // 6-18px
        duration: Math.random() * 18000 + 12000, // 12-30 seconds (slow fall)
        initialDelay: Math.random() * 3000,
        opacity: Math.random() * 0.5 + 0.5, // 0.5-1.0
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 3, // -1.5 to 1.5 degrees per frame
        horizontalSpeed: (Math.random() - 0.5) * 2, // -1 to 1 pixels per frame
        fallSpeed: Math.random() * 2 + 1, // 1-3 pixels per frame
        color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
        sway: Math.random() * 20 + 10, // 10-30 pixels side-to-side sway
        swaySpeed: Math.random() * 1000 + 500, // 0.5-1.5 seconds per sway cycle
      }));
    },
    [],
  );

  const animations = useRef(
    leaves.map((leaf) => ({
      translateY: new Animated.Value(-leaf.size * 2),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(leaf.rotation),
      opacity: new Animated.Value(leaf.opacity),
    })),
  );

  const animationLoops = useRef([]);
  const swayLoops = useRef([]);
  const timeouts = useRef([]);
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('[FallingLeaves] useEffect triggered, visible:', visible);
    }

    if (!visible) {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      swayLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      swayLoops.current = [];
      timeouts.current = [];
      animations.current.forEach((anim) => {
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
        anim.rotate.setValue(0);
      });
      return;
    }

    isActiveRef.current = true;
    if (__DEV__) {
      console.log('[FallingLeaves] Starting falling leaves animation');
    }

    leaves.forEach((leaf, index) => {
      const anim = animations.current[index];

      // Swaying motion (side-to-side while falling)
      const startSway = () => {
        if (!isActiveRef.current) return;

        const swayAnimation = Animated.sequence([
          Animated.timing(anim.translateX, {
            toValue: leaf.sway,
            duration: leaf.swaySpeed,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: -leaf.sway,
            duration: leaf.swaySpeed * 2,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: 0,
            duration: leaf.swaySpeed,
            useNativeDriver: true,
          }),
        ]);

        swayAnimation.start((finished) => {
          if (finished && isActiveRef.current) {
            startSway();
          }
        });

        swayLoops.current[index] = swayAnimation;
      };

      // Falling animation
      const runAnimation = () => {
        if (!isActiveRef.current) return;

        anim.translateY.setValue(-leaf.size * 2);
        anim.translateX.setValue(0);
        anim.rotate.setValue(leaf.rotation);

        const verticalDistance = SCREEN_HEIGHT + leaf.size * 2;
        const baseHorizontalDistance = leaf.horizontalSpeed * leaf.duration;
        const rotationDistance = leaf.rotationSpeed * 360;

        const animation = Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: verticalDistance,
            duration: leaf.duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotate, {
            toValue: leaf.rotation + rotationDistance,
            duration: leaf.duration,
            useNativeDriver: true,
          }),
        ]);

        animation.start((finished) => {
          if (finished && isActiveRef.current) {
            runAnimation();
          }
        });

        animationLoops.current[index] = animation;
      };

      const timeoutId = setTimeout(() => {
        if (isActiveRef.current) {
          startSway();
          runAnimation();
        }
      }, leaf.initialDelay);

      timeouts.current[index] = timeoutId;
    });

    return () => {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      swayLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      swayLoops.current = [];
      timeouts.current = [];
    };
  }, [visible, leaves]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {leaves.map((leaf, index) => {
        const anim = animations.current[index];
        const rotateInterpolation = anim.rotate.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        });

        return (
          <Animated.View
            key={`leaf-${leaf.id}`}
            style={[
              styles.leaf,
              {
                left: leaf.x,
                width: leaf.size,
                height: leaf.size * 0.8, // Slightly oblong
                backgroundColor: leaf.color,
                opacity: anim.opacity,
                transform: [
                  { translateY: anim.translateY },
                  { translateX: anim.translateX },
                  { rotate: rotateInterpolation },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    elevation: 1,
  },
  leaf: {
    position: 'absolute',
    borderRadius: 20,
  },
});

export default FallingLeaves;

