import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import AppText from './AppText';

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  errorMessage,
  editable = true,
}) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFont = colors.primaryFont || '#220707';
  const onSurface = colors.onSurface || primaryFont; // Use onSurface for text on surface backgrounds
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const border = colors.border || '#D9C8A9';
  const shadow = colors.shadow || '#000000';
  const errorColor = colors.error || '#B33A3A';

  return (
    <View style={styles.wrapper}>
      <AppText variant="ui" style={[styles.label, { color: onSurface }]}>{label}</AppText>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: border,
            color: onSurface,
            backgroundColor: surface,
          },
          !editable && {
            backgroundColor: withOpacity(shadow, 0.05),
            color: withOpacity(onSurface, 0.6),
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        placeholderTextColor={withOpacity(secondaryFont, 0.6)}
      />
      {errorMessage ? (
        <AppText variant="small" style={[styles.error, { color: errorColor }]}>{errorMessage}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
  },
});

export default FormField;

