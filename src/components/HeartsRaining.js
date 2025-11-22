/**
 * Hearts Raining Background Component
 * Displays falling hearts animation for fun, Valentine's, or playful moments
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const HEART_COUNT = 25;
const HEART_COLORS = ['#FF69B4', '#FF1493', '#FFB6C1', '#FFC0CB', '#FF69B4', '#FF1493'];

function HeartsRaining({ visible }) {
  const hearts = useMemo(
    () => {
      if (__DEV__) {
        console.log('[HeartsRaining] Generating hearts, visible:', visible);
      }
      return Array.from({ length: HEART_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        size: Math.random() * 10 + 6, // 6-16px
        duration: Math.random() * 15000 + 10000, // 10-25 seconds
        initialDelay: Math.random() * 4000,
        opacity: Math.random() * 0.5 + 0.5, // 0.5-1.0
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 2, // -1 to 1 degrees per frame
        horizontalSpeed: (Math.random() - 0.5) * 1.5, // -0.75 to 0.75 pixels per frame
        color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
        scale: Math.random() * 0.3 + 0.7, // 0.7-1.0
      }));
    },
    [],
  );

  const animations = useRef(
    hearts.map((heart) => ({
      translateY: new Animated.Value(-heart.size * 2),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(heart.rotation),
      opacity: new Animated.Value(heart.opacity),
      scale: new Animated.Value(heart.scale),
    })),
  );

  const animationLoops = useRef([]);
  const pulseLoops = useRef([]);
  const timeouts = useRef([]);
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('[HeartsRaining] useEffect triggered, visible:', visible);
    }

    if (!visible) {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      pulseLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      pulseLoops.current = [];
      timeouts.current = [];
      animations.current.forEach((anim) => {
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
        anim.rotate.setValue(0);
        anim.scale.setValue(1);
      });
      return;
    }

    isActiveRef.current = true;
    if (__DEV__) {
      console.log('[HeartsRaining] Starting hearts raining animation');
    }

    hearts.forEach((heart, index) => {
      const anim = animations.current[index];

      // Pulsing animation (heartbeat effect)
      const startPulse = () => {
        if (!isActiveRef.current) return;

        const pulseAnimation = Animated.sequence([
          Animated.timing(anim.scale, {
            toValue: heart.scale * 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(anim.scale, {
            toValue: heart.scale,
            duration: 500,
            useNativeDriver: true,
          }),
        ]);

        pulseAnimation.start((finished) => {
          if (finished && isActiveRef.current) {
            setTimeout(() => {
              if (isActiveRef.current) {
                startPulse();
              }
            }, 2000);
          }
        });

        pulseLoops.current[index] = pulseAnimation;
      };

      // Falling animation
      const runAnimation = () => {
        if (!isActiveRef.current) return;

        anim.translateY.setValue(-heart.size * 2);
        anim.translateX.setValue(0);
        anim.rotate.setValue(heart.rotation);

        const verticalDistance = SCREEN_HEIGHT + heart.size * 2;
        const horizontalDistance = heart.horizontalSpeed * heart.duration;
        const rotationDistance = heart.rotationSpeed * 360;

        const animation = Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: verticalDistance,
            duration: heart.duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: horizontalDistance,
            duration: heart.duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotate, {
            toValue: heart.rotation + rotationDistance,
            duration: heart.duration,
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
          startPulse();
          runAnimation();
        }
      }, heart.initialDelay);

      timeouts.current[index] = timeoutId;
    });

    return () => {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      pulseLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      pulseLoops.current = [];
      timeouts.current = [];
    };
  }, [visible, hearts]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {hearts.map((heart, index) => {
        const anim = animations.current[index];
        const rotateInterpolation = anim.rotate.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        });

        return (
          <Animated.View
            key={`heart-${heart.id}`}
            style={[
              styles.heart,
              {
                left: heart.x,
                width: heart.size,
                height: heart.size,
                backgroundColor: heart.color,
                opacity: anim.opacity,
                transform: [
                  { translateY: anim.translateY },
                  { translateX: anim.translateX },
                  { rotate: rotateInterpolation },
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
  heart: {
    position: 'absolute',
    // Simple heart shape approximation - will render as a rounded square
    // For a true heart shape, SVG would be needed but this works for animation
    borderRadius: 20,
    shadowColor: '#FF1493',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default HeartsRaining;

