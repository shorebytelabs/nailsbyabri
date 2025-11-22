/**
 * Fireflies / Glow Dots Background Component
 * Displays soft ambient firefly animations for night/forest themes
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FIREFLY_COUNT = 40;

function Fireflies({ visible }) {
  const fireflies = useMemo(
    () => {
      if (__DEV__) {
        console.log('[Fireflies] Generating fireflies, visible:', visible);
      }
      return Array.from({ length: FIREFLY_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * SCREEN_HEIGHT,
        size: Math.random() * 4 + 2, // 2-6px
        duration: Math.random() * 12000 + 8000, // 8-20 seconds
        initialDelay: Math.random() * 3000,
        opacity: Math.random() * 0.6 + 0.4, // 0.4-1.0
        glowSpeed: Math.random() * 2000 + 1000, // 1-3 seconds for glow cycle
        horizontalSpeed: (Math.random() - 0.5) * 2, // -1 to 1 pixels per frame
        verticalSpeed: (Math.random() - 0.5) * 2, // -1 to 1 pixels per frame (floating)
      }));
    },
    [],
  );

  const animations = useRef(
    fireflies.map((firefly) => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      opacity: new Animated.Value(firefly.opacity),
      scale: new Animated.Value(1),
    })),
  );

  const animationLoops = useRef([]);
  const glowLoops = useRef([]);
  const timeouts = useRef([]);
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('[Fireflies] useEffect triggered, visible:', visible);
    }

    if (!visible) {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      glowLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      glowLoops.current = [];
      timeouts.current = [];
      animations.current.forEach((anim) => {
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
        anim.opacity.setValue(0.7);
        anim.scale.setValue(1);
      });
      return;
    }

    isActiveRef.current = true;
    if (__DEV__) {
      console.log('[Fireflies] Starting fireflies animation');
    }

    fireflies.forEach((firefly, index) => {
      const anim = animations.current[index];

      // Glowing animation (pulsing opacity and scale)
      const startGlow = () => {
        if (!isActiveRef.current) return;

        const glowAnimation = Animated.sequence([
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: firefly.opacity * 0.3,
              duration: firefly.glowSpeed / 2,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 0.6,
              duration: firefly.glowSpeed / 2,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: firefly.opacity,
              duration: firefly.glowSpeed / 2,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 1.3,
              duration: firefly.glowSpeed / 2,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: firefly.opacity * 0.5,
              duration: firefly.glowSpeed / 2,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 1,
              duration: firefly.glowSpeed / 2,
              useNativeDriver: true,
            }),
          ]),
        ]);

        glowAnimation.start((finished) => {
          if (finished && isActiveRef.current) {
            startGlow();
          }
        });

        glowLoops.current[index] = glowAnimation;
      };

      // Floating movement animation
      const runAnimation = () => {
        if (!isActiveRef.current) return;

        // Start from current position
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);

        // Random floating movement
        const verticalDistance = firefly.verticalSpeed * firefly.duration;
        const horizontalDistance = firefly.horizontalSpeed * firefly.duration;

        const animation = Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: verticalDistance,
            duration: firefly.duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: horizontalDistance,
            duration: firefly.duration,
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
          startGlow();
          runAnimation();
        }
      }, firefly.initialDelay);

      timeouts.current[index] = timeoutId;
    });

    return () => {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      glowLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      glowLoops.current = [];
      timeouts.current = [];
    };
  }, [visible, fireflies]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {fireflies.map((firefly, index) => {
        const anim = animations.current[index];
        return (
          <Animated.View
            key={`firefly-${firefly.id}`}
            style={[
              styles.firefly,
              {
                left: firefly.x,
                top: firefly.y,
                width: firefly.size,
                height: firefly.size,
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
  firefly: {
    position: 'absolute',
    backgroundColor: '#FFF9C4', // Warm yellow glow
    borderRadius: 50, // Circular
    shadowColor: '#FFF9C4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
});

export default Fireflies;

