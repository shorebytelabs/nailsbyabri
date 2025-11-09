import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

const ICON_SIZE = 24;

const iconRenderers = {
  home: (props = {}) => (
    <Svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      color={props.color || 'currentColor'}
      {...props}
    >
      <Path
        d="M4 11.2 12 4l8 7.2M6.5 10.5V20h11v-9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  orders: (props = {}) => (
    <Svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      color={props.color || 'currentColor'}
      {...props}
    >
      <Path
        d="M7 3h10a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M9 7h6M9 11h6M9 15h3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  ),
  profile: (props = {}) => (
    <Svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      color={props.color || 'currentColor'}
      {...props}
    >
      <Path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 20a7 7 0 0 0-14 0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  ),
  create: (props = {}) => (
    <Svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      color={props.color || 'currentColor'}
      {...props}
    >
      <Path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  ),
  plus: (props = {}) => (
    <Svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      color={props.color || 'currentColor'}
      {...props}
    >
      <Path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  ),
  nailPlus: (props = {}) => (
    <Svg
      width={56}
      height={56}
      viewBox="0 0 56 56"
      color={props.color || 'currentColor'}
      {...props}
    >
      <Circle cx={28} cy={28} r={26} fill="currentColor" opacity={0.12} />
      <Path
        d="M36 21c0 4.9-4.17 17-8 17s-8-12.1-8-17a8 8 0 1 1 16 0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M28 18v9M23.5 22.5h9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ),
};

export function Icon({ name, color, size = ICON_SIZE, ...rest }) {
  const Renderer = iconRenderers[name];
  if (!Renderer) {
    return null;
  }
  return <Renderer color={color} width={size} height={size} {...rest} />;
}

export default Icon;

