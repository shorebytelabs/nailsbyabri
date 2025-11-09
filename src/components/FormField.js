import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

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
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const border = colors.border || '#D9C8A9';
  const shadow = colors.shadow || '#000000';
  const errorColor = colors.error || '#B33A3A';

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: primaryFont }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: border,
            color: primaryFont,
            backgroundColor: surface,
          },
          !editable && {
            backgroundColor: withOpacity(shadow, 0.05),
            color: withOpacity(primaryFont, 0.6),
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
        <Text style={[styles.error, { color: errorColor }]}>{errorMessage}</Text>
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

