/**
 * AppText - A Text component with controlled Dynamic Type scaling
 * 
 * Handles iOS/Android Dynamic Type properly to prevent UI breakage
 * when users increase system text size.
 * 
 * Variants:
 * - "body" (default): Body text that scales normally, max 1.4x
 * - "ui": UI elements (buttons, titles, headers, nav labels) with limited scaling, max 1.2x
 * - "small": Small elements (badges, pills, tags) with no scaling
 * 
 * @param {string} variant - Text variant: "body" (default), "ui", or "small"
 * @param {Object} style - Style override (merged with variant styles)
 * @param {number} numberOfLines - Maximum number of lines
 * @param {React.ReactNode} children - Text content
 * @param {...any} props - All other Text props
 */
import React from 'react';
import { Text } from 'react-native';

const AppText = ({ variant = 'body', style, numberOfLines, children, ...props }) => {
  // Determine scaling behavior based on variant
  const allowScaling = variant === 'body';
  const maxMultiplier = variant === 'body' ? 1.4 : variant === 'ui' ? 1.2 : 1.0;
  
  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      allowFontScaling={allowScaling}
      maxFontSizeMultiplier={maxMultiplier}
      {...props}
    >
      {children}
    </Text>
  );
};

export default AppText;

