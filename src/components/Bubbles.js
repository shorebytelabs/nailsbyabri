/**
 * Bubbles / Floating Orbs Background Component
 * Displays subtle floating bubbles animation
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BUBBLE_COUNT = 30;

function Bubbles({ visible }) {
  const bubbles = useMemo(
    () => {
      if (__DEV__) {
        console.log('[Bubbles] Generating bubbles, visible:', visible);
      }
      return Array.from({ length: BUBBLE_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        size: Math.random() * 40 + 20, // 20-60px
        duration: Math.random() * 15000 + 10000, // 10-25 seconds
        initialDelay: Math.random() * 3000,
        opacity: Math.random() * 0.2 + 0.1, // 0.1-0.3 (very subtle)
        horizontalSpeed: (Math.random() - 0.5) * 1, // -0.5 to 0.5 pixels per frame
        riseSpeed: Math.random() * 2 + 1, // 1-3 pixels per frame (rising)
      }));
    },
    [],
  );

  const animations = useRef(
    bubbles.map((bubble) => ({
      translateY: new Animated.Value(SCREEN_HEIGHT + bubble.size),
      translateX: new Animated.Value(0),
      opacity: new Animated.Value(bubble.opacity),
      scale: new Animated.Value(0.8),
    })),
  );

  const animationLoops = useRef([]);
  const timeouts = useRef([]);
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('[Bubbles] useEffect triggered, visible:', visible);
    }

    if (!visible) {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      timeouts.current = [];
      animations.current.forEach((anim) => {
        anim.translateY.setValue(SCREEN_HEIGHT);
        anim.translateX.setValue(0);
        anim.scale.setValue(0.8);
      });
      return;
    }

    isActiveRef.current = true;
    if (__DEV__) {
      console.log('[Bubbles] Starting bubbles animation');
    }

    bubbles.forEach((bubble, index) => {
      const anim = animations.current[index];

      const runAnimation = () => {
        if (!isActiveRef.current) return;

        // Start from bottom
        anim.translateY.setValue(SCREEN_HEIGHT + bubble.size);
        anim.translateX.setValue(0);
        anim.scale.setValue(0.8);

        // Calculate end position
        const verticalDistance = -SCREEN_HEIGHT - bubble.size * 2;
        const horizontalDistance = bubble.horizontalSpeed * bubble.duration;

        // Scale up as it rises (like a bubble expanding)
        const scaleAnimation = Animated.timing(anim.scale, {
          toValue: 1.1,
          duration: bubble.duration * 0.6,
          useNativeDriver: true,
        });

        const movementAnimation = Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: verticalDistance,
            duration: bubble.duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: horizontalDistance,
            duration: bubble.duration,
            useNativeDriver: true,
          }),
        ]);

        const animation = Animated.parallel([movementAnimation, scaleAnimation]);

        animation.start((finished) => {
          if (finished && isActiveRef.current) {
            runAnimation();
          }
        });

        animationLoops.current[index] = animation;
      };

      const timeoutId = setTimeout(() => {
        if (isActiveRef.current) {
          runAnimation();
        }
      }, bubble.initialDelay);

      timeouts.current[index] = timeoutId;
    });

    return () => {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      timeouts.current = [];
    };
  }, [visible, bubbles]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {bubbles.map((bubble, index) => {
        const anim = animations.current[index];
        return (
          <Animated.View
            key={`bubble-${bubble.id}`}
            style={[
              styles.bubble,
              {
                left: bubble.x,
                width: bubble.size,
                height: bubble.size,
                opacity: anim.opacity,
                transform: [
                  { translateY: anim.translateY },
                  { translateX: anim.translateX },
                  { scale: anim.scale },
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
  bubble: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 1000, // Circular
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
});

export default Bubbles;

