export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') {
    return null;
  }
  const normalized = hex.replace('#', '');
  const hexValue = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized;
  const intValue = parseInt(hexValue, 16);
  if (Number.isNaN(intValue)) {
    return null;
  }
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

export function withOpacity(color, alpha) {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  if (!color) {
    return `rgba(0, 0, 0, ${safeAlpha})`;
  }

  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    if (!rgb) {
      return `rgba(0, 0, 0, ${safeAlpha})`;
    }
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
  }

  const rgbaMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbaMatch) {
    const [r, g, b] = rgbaMatch[1]
      .split(',')
      .map((segment) => Number(segment.trim()))
      .filter((value, index) => index < 3 && Number.isFinite(value));
    if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }
  }

  return color;
}
