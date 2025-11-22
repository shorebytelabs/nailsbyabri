/**
 * Background Animation Component
 * Renders the active background animation based on app settings
 * Animations are independent of themes and can be configured separately
 */
import React from 'react';
import { animationIndex } from '../animations';

function BackgroundAnimation({ activeAnimationId }) {
  if (__DEV__) {
    console.log('[BackgroundAnimation] Rendering with activeAnimationId:', activeAnimationId);
  }

  // If no animation or "none" is selected, don't render anything
  if (!activeAnimationId || activeAnimationId === 'none') {
    if (__DEV__) {
      console.log('[BackgroundAnimation] No animation selected, returning null');
    }
    return null;
  }

  // Get the animation configuration from registry
  const animationConfig = animationIndex[activeAnimationId];
  
  if (__DEV__) {
    console.log('[BackgroundAnimation] Animation config:', animationConfig);
  }
  
  // If animation not found in registry, don't render anything
  if (!animationConfig || !animationConfig.component) {
    if (__DEV__) {
      console.warn('[BackgroundAnimation] Animation not found in registry:', activeAnimationId);
      console.warn('[BackgroundAnimation] Available animations:', Object.keys(animationIndex));
    }
    return null;
  }

  // Render the animation component
  const AnimationComponent = animationConfig.component;
  if (__DEV__) {
    console.log('[BackgroundAnimation] Rendering animation component:', AnimationComponent.name || 'Unknown');
  }
  return <AnimationComponent visible={true} />;
}

export default BackgroundAnimation;

