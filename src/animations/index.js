/**
 * Animation Registry
 * Registers all available background animations
 * Each animation has: id, name, component
 */
import SnowBackground from '../components/SnowBackground';

export const animationRegistry = [
  {
    id: 'none',
    name: 'None',
    component: null, // No animation
  },
  {
    id: 'snow',
    name: 'Snow',
    component: SnowBackground,
  },
  // Future animations can be added here:
  // {
  //   id: 'rain',
  //   name: 'Rain',
  //   component: RainBackground,
  // },
];

export const animationIndex = animationRegistry.reduce((acc, animation) => {
  acc[animation.id] = animation;
  return acc;
}, {});

export default animationRegistry;

