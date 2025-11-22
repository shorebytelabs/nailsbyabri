/**
 * Snow Background Component
 * Displays subtle animated snowfall effect
 * Only visible when "snow" theme is active
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Number of snowflakes - subtle amount
const SNOWFLAKE_COUNT = 40; // Increased for better visibility

function SnowBackground({ visible }) {
  // Generate random snowflakes once
  const snowflakes = useMemo(
    () => {
      if (__DEV__) {
        console.log('[SnowBackground] Generating snowflakes, visible:', visible);
      }
      return Array.from({ length: SNOWFLAKE_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        size: Math.random() * 4 + 2, // 2-6px for better visibility
        duration: Math.random() * 15000 + 12000, // 12-27 seconds (slow)
        initialDelay: Math.random() * 2000, // Staggered start (reduced delay)
        opacity: Math.min(Math.random() * 0.5 + 0.6, 1.0), // 0.6-1.0 opacity for better visibility
        horizontalSpeed: (Math.random() - 0.5) * 0.3, // Slow horizontal drift
      }));
    },
    [],
  );

  const animations = useRef(
    snowflakes.map((snowflake) => ({
      translateY: new Animated.Value(-snowflake.size * 2),
      translateX: new Animated.Value(0),
      opacity: new Animated.Value(snowflake.opacity),
    })),
  );

  const animationLoops = useRef([]);
  const timeouts = useRef([]);
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('[SnowBackground] useEffect triggered, visible:', visible);
    }

    if (!visible) {
      // Stop all animations and reset positions
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => {
        if (loop) {
          loop.stop();
        }
      });
      timeouts.current.forEach((timeout) => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
      animationLoops.current = [];
      timeouts.current = [];
      // Reset animation values
      animations.current.forEach((anim) => {
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
      });
      return;
    }

    isActiveRef.current = true;
    if (__DEV__) {
      console.log('[SnowBackground] Starting snow animation');
    }

    // Start animations for each snowflake
    snowflakes.forEach((snowflake, index) => {
      const anim = animations.current[index];

      const runAnimation = () => {
        if (!isActiveRef.current) return;

        // Reset to top
        anim.translateY.setValue(-snowflake.size * 2);
        anim.translateX.setValue(0);

        // Calculate end position with horizontal drift
        const horizontalDistance = snowflake.horizontalSpeed * snowflake.duration;

        const animation = Animated.parallel([
          // Vertical fall
          Animated.timing(anim.translateY, {
            toValue: SCREEN_HEIGHT + snowflake.size * 2,
            duration: snowflake.duration,
            useNativeDriver: true,
          }),
          // Subtle horizontal drift
          Animated.timing(anim.translateX, {
            toValue: horizontalDistance,
            duration: snowflake.duration,
            useNativeDriver: true,
          }),
        ]);

        animation.start((finished) => {
          // Only loop if still active and animation completed
          if (finished && isActiveRef.current) {
            runAnimation();
          }
        });

        animationLoops.current[index] = animation;
      };

      // Start the animation after initial delay
      const timeoutId = setTimeout(() => {
        if (isActiveRef.current) {
          runAnimation();
        }
      }, snowflake.initialDelay);

      timeouts.current[index] = timeoutId;
    });

    return () => {
      // Cleanup on unmount or when visible changes
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => {
        if (loop) {
          loop.stop();
        }
      });
      timeouts.current.forEach((timeout) => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
      animationLoops.current = [];
      timeouts.current = [];
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {snowflakes.map((snowflake, index) => {
        const anim = animations.current[index];
        return (
          <Animated.View
            key={`snowflake-${snowflake.id}`}
            style={[
              styles.snowflake,
              {
                left: snowflake.x,
                width: snowflake.size,
                height: snowflake.size,
                opacity: anim.opacity,
                transform: [
                  {
                    translateY: anim.translateY,
                  },
                  {
                    translateX: anim.translateX,
                  },
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
    zIndex: 1, // Above background but below content
    elevation: 1, // Android
  },
  snowflake: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 50, // Circular snowflakes
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2, // Android shadow
  },
});

export default SnowBackground;
