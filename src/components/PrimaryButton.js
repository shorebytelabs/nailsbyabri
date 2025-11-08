import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../theme';

function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
}) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  const backgroundColor = theme?.colors?.accent || styles.button.backgroundColor;
  const disabledColor = theme?.colors?.hover || styles.disabled.backgroundColor;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor },
        isDisabled && { backgroundColor: disabledColor },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.label}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#272b75',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabled: {
    backgroundColor: '#a0a3c2',
  },
  label: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default PrimaryButton;

