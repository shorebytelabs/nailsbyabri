import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  ...touchableProps
}) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const isDisabled = disabled || loading;
  const accentColor = colors.accent || '#6F171F';
  const accentContrast = colors.accentContrast || '#FFFFFF';
  const disabledColor = colors.hover || withOpacity(accentColor, 0.4);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: accentColor },
        isDisabled && { backgroundColor: disabledColor },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      {...touchableProps}
    >
      {loading ? (
        <ActivityIndicator color={accentContrast} />
      ) : (
        <Text style={[styles.label, { color: accentContrast }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    fontSize: 16,
  },
});

export default PrimaryButton;

