/**
 * Floating Stars / Galaxy Sparkles Background Component
 * Displays magical floating stars with sparkle effect
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STAR_COUNT = 60;

function FloatingStars({ visible }) {
  const stars = useMemo(
    () => {
      if (__DEV__) {
        console.log('[FloatingStars] Generating stars, visible:', visible);
      }
      return Array.from({ length: STAR_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * SCREEN_HEIGHT,
        size: Math.random() * 3 + 1, // 1-4px
        duration: Math.random() * 12000 + 8000, // 8-20 seconds
        initialDelay: Math.random() * 3000,
        opacity: Math.random() * 0.6 + 0.4, // 0.4-1.0
        twinkleSpeed: Math.random() * 2000 + 1000, // 1-3 seconds for twinkle cycle
        horizontalSpeed: (Math.random() - 0.5) * 2, // -1 to 1 pixels per frame
        verticalSpeed: Math.random() * 1 + 0.5, // 0.5-1.5 pixels per frame
      }));
    },
    [],
  );

  const animations = useRef(
    stars.map((star) => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      opacity: new Animated.Value(star.opacity),
      scale: new Animated.Value(1),
    })),
  );

  const animationLoops = useRef([]);
  const twinkleLoops = useRef([]);
  const timeouts = useRef([]);
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('[FloatingStars] useEffect triggered, visible:', visible);
    }

    if (!visible) {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      twinkleLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      twinkleLoops.current = [];
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
      console.log('[FloatingStars] Starting floating stars animation');
    }

    stars.forEach((star, index) => {
      const anim = animations.current[index];

      // Twinkle animation (pulsing opacity and scale)
      const startTwinkle = () => {
        if (!isActiveRef.current) return;

        const twinkleAnimation = Animated.sequence([
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: star.opacity * 0.3,
              duration: star.twinkleSpeed / 2,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 0.6,
              duration: star.twinkleSpeed / 2,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: star.opacity,
              duration: star.twinkleSpeed / 2,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 1,
              duration: star.twinkleSpeed / 2,
              useNativeDriver: true,
            }),
          ]),
        ]);

        twinkleAnimation.start((finished) => {
          if (finished && isActiveRef.current) {
            startTwinkle();
          }
        });

        twinkleLoops.current[index] = twinkleAnimation;
      };

      // Floating movement animation
      const runAnimation = () => {
        if (!isActiveRef.current) return;

        anim.translateY.setValue(0);
        anim.translateX.setValue(0);

        const verticalDistance = star.verticalSpeed * star.duration;
        const horizontalDistance = star.horizontalSpeed * star.duration;

        const animation = Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: verticalDistance,
            duration: star.duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: horizontalDistance,
            duration: star.duration,
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
          startTwinkle();
          runAnimation();
        }
      }, star.initialDelay);

      timeouts.current[index] = timeoutId;
    });

    return () => {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      twinkleLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      twinkleLoops.current = [];
      timeouts.current = [];
    };
  }, [visible, stars]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {stars.map((star, index) => {
        const anim = animations.current[index];
        return (
          <Animated.View
            key={`star-${star.id}`}
            style={[
              styles.star,
              {
                left: star.x,
                top: star.y,
                width: star.size,
                height: star.size,
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
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 3,
  },
});

export default FloatingStars;

