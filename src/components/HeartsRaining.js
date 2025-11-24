/**
 * Hearts Raining Background Component
 * Displays falling hearts animation with actual heart shapes
 * Fun, romantic/Valentine's vibe with clearly recognizable heart shapes
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const HEART_COUNT = 45; // Increased from 25 for better visibility
const HEART_COLORS = ['#FF69B4', '#FF1493', '#FFB6C1', '#FFC0CB', '#FF69B4', '#FF1493'];

// Classic heart shape path - two rounded lobes at top, pointy bottom
// Creates a recognizable, lightweight heart shape using SVG path
// Path: Proper heart shape with two rounded lobes at top and pointy V at bottom
// This creates a classic, clearly recognizable heart shape
// Using bezier curves: two arcs for top lobes, pointy V for bottom
// Standard heart path formula: two rounded top lobes, pointy bottom
const HEART_PATH = 'M 12,21.35 C 12,21.35 2,12.35 2,7.35 C 2,3.35 5,0.35 12,0.35 C 19,0.35 22,3.35 22,7.35 C 22,12.35 12,21.35 12,21.35 Z';

function HeartsRaining({ visible }) {
  const hearts = useMemo(
    () => {
      if (__DEV__) {
        console.log('[HeartsRaining] Generating hearts, visible:', visible);
      }
      return Array.from({ length: HEART_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        size: Math.random() * 25 + 10, // 10-35px (larger size variation for better visibility)
        duration: Math.random() * 20000 + 10000, // 10-30 seconds (more varied fall speeds)
        initialDelay: Math.random() * 6000,
        opacity: Math.random() * 0.3 + 0.7, // 0.7-1.0 (more visible, not overwhelming)
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 4, // -2 to 2 degrees per frame (more noticeable rotation)
        horizontalSpeed: (Math.random() - 0.5) * 3, // -1.5 to 1.5 pixels per frame (more noticeable drift)
        color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
        scale: Math.random() * 0.3 + 0.7, // 0.7-1.0 (for pulsing effect)
        sway: Math.random() * 30 + 20, // 20-50 pixels side-to-side sway (natural floating)
        swaySpeed: Math.random() * 1500 + 800, // 0.8-2.3 seconds per sway cycle (varied)
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
  const swayLoops = useRef([]);
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
      swayLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      pulseLoops.current = [];
      swayLoops.current = [];
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

      // Swaying motion (side-to-side while falling - natural floating)
      const startSway = () => {
        if (!isActiveRef.current) return;

        const swayAnimation = Animated.sequence([
          Animated.timing(anim.translateX, {
            toValue: heart.sway,
            duration: heart.swaySpeed,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: -heart.sway,
            duration: heart.swaySpeed * 2,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: 0,
            duration: heart.swaySpeed,
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

      // Pulsing animation (heartbeat effect)
      const startPulse = () => {
        if (!isActiveRef.current) return;

        const pulseAnimation = Animated.sequence([
          Animated.timing(anim.scale, {
            toValue: heart.scale * 1.15,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim.scale, {
            toValue: heart.scale,
            duration: 400,
            useNativeDriver: true,
          }),
        ]);

        pulseAnimation.start((finished) => {
          if (finished && isActiveRef.current) {
            setTimeout(() => {
              if (isActiveRef.current) {
                startPulse();
              }
            }, 1500 + Math.random() * 1000); // Varied pulse timing
          }
        });

        pulseLoops.current[index] = pulseAnimation;
      };

      // Falling animation with rotation
      const runAnimation = () => {
        if (!isActiveRef.current) return;

        anim.translateY.setValue(-heart.size * 2);
        anim.translateX.setValue(0);
        anim.rotate.setValue(heart.rotation);

        const verticalDistance = SCREEN_HEIGHT + heart.size * 2;
        const rotationDistance = heart.rotationSpeed * 360;

        const animation = Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: verticalDistance,
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
          startSway();
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
      swayLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      pulseLoops.current = [];
      swayLoops.current = [];
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
              styles.heartContainer,
              {
                left: heart.x,
                width: heart.size,
                height: heart.size,
                opacity: anim.opacity,
                transform: [
                  { translateY: anim.translateY },
                  { translateX: anim.translateX },
                  { rotate: rotateInterpolation },
                  { scale: anim.scale },
                ],
              },
            ]}
          >
            <Svg
              width={heart.size}
              height={heart.size}
              viewBox="0 0 24 24"
              style={styles.heartSvg}
            >
              <Path
                d={HEART_PATH}
                fill={heart.color}
                stroke={heart.color}
                strokeWidth="0.4"
                opacity={0.95}
              />
            </Svg>
          </Animated.View>
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
  heartContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartSvg: {
    // SVG styling handled by Path component
  },
});

export default HeartsRaining;

