import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';

function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
}) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.disabled, style]}
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

