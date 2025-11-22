/**
 * Confetti Bursts Background Component
 * Displays fun confetti bursts animation for celebrations
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COUNT = 50;
const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#FFD89B'];

function ConfettiBursts({ visible }) {
  const confettiPieces = useMemo(
    () => {
      if (__DEV__) {
        console.log('[ConfettiBursts] Generating confetti pieces, visible:', visible);
      }
      return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * SCREEN_HEIGHT,
        size: Math.random() * 6 + 3, // 3-9px
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 5, // -2.5 to 2.5 degrees per frame
        duration: Math.random() * 8000 + 5000, // 5-13 seconds
        initialDelay: Math.random() * 2000,
        opacity: Math.random() * 0.5 + 0.5, // 0.5-1.0
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        velocityY: Math.random() * 3 + 2, // 2-5 pixels per frame
        velocityX: (Math.random() - 0.5) * 4, // -2 to 2 pixels per frame
        gravity: Math.random() * 0.1 + 0.05, // 0.05-0.15
      }));
    },
    [],
  );

  const animations = useRef(
    confettiPieces.map((piece) => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(piece.rotation),
      opacity: new Animated.Value(piece.opacity),
    })),
  );

  const animationLoops = useRef([]);
  const timeouts = useRef([]);
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (__DEV__) {
      console.log('[ConfettiBursts] useEffect triggered, visible:', visible);
    }

    if (!visible) {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
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
      console.log('[ConfettiBursts] Starting confetti animation');
    }

    confettiPieces.forEach((piece, index) => {
      const anim = animations.current[index];

      const runAnimation = () => {
        if (!isActiveRef.current) return;

        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
        anim.rotate.setValue(piece.rotation);

        // Animate with physics-like motion
        const maxFall = SCREEN_HEIGHT + piece.size * 2;
        const horizontalDrift = piece.velocityX * piece.duration;

        const animation = Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: maxFall,
            duration: piece.duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: horizontalDrift,
            duration: piece.duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotate, {
            toValue: piece.rotation + piece.rotationSpeed * 360,
            duration: piece.duration,
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
          runAnimation();
        }
      }, piece.initialDelay);

      timeouts.current[index] = timeoutId;
    });

    return () => {
      isActiveRef.current = false;
      animationLoops.current.forEach((loop) => loop?.stop());
      timeouts.current.forEach((timeout) => clearTimeout(timeout));
      animationLoops.current = [];
      timeouts.current = [];
    };
  }, [visible, confettiPieces]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {confettiPieces.map((piece, index) => {
        const anim = animations.current[index];
        const rotateInterpolation = anim.rotate.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        });

        return (
          <Animated.View
            key={`confetti-${piece.id}`}
            style={[
              styles.confettiPiece,
              {
                left: piece.x,
                top: piece.y,
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
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
  confettiPiece: {
    position: 'absolute',
    borderRadius: 2,
  },
});

export default ConfettiBursts;

