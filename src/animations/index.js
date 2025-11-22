/**
 * Animation Registry
 * Registers all available background animations
 * Each animation has: id, name, component
 */
import SnowBackground from '../components/SnowBackground';
import ConfettiBursts from '../components/ConfettiBursts';
import FloatingStars from '../components/FloatingStars';
import Bubbles from '../components/Bubbles';
import FallingLeaves from '../components/FallingLeaves';
import HeartsRaining from '../components/HeartsRaining';
import Fireflies from '../components/Fireflies';

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
  {
    id: 'confetti',
    name: 'Confetti Bursts',
    component: ConfettiBursts,
  },
  {
    id: 'stars',
    name: 'Floating Stars',
    component: FloatingStars,
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    component: Bubbles,
  },
  {
    id: 'leaves',
    name: 'Falling Leaves',
    component: FallingLeaves,
  },
  {
    id: 'hearts',
    name: 'Hearts Raining',
    component: HeartsRaining,
  },
  {
    id: 'fireflies',
    name: 'Fireflies',
    component: Fireflies,
  },
];

export const animationIndex = animationRegistry.reduce((acc, animation) => {
  acc[animation.id] = animation;
  return acc;
}, {});

export default animationRegistry;

