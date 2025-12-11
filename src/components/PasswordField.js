import React from 'react';
import { StyleSheet, TextInput, View, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';
import AppText from './AppText';
import Icon from '../icons/Icon';

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
  errorMessage,
  editable = true,
  showPassword = false,
  onToggleShowPassword,
}) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const primaryFont = colors.primaryFont || '#220707';
  const onSurface = colors.onSurface || primaryFont;
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const border = colors.border || '#D9C8A9';
  const shadow = colors.shadow || '#000000';
  const errorColor = colors.error || '#B33A3A';

  return (
    <View style={styles.wrapper}>
      <AppText variant="ui" style={[styles.label, { color: onSurface }]}>{label}</AppText>
      <View style={styles.inputContainer}>
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
            errorMessage && {
              borderColor: errorColor,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={!showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          placeholderTextColor={withOpacity(secondaryFont, 0.6)}
        />
        {onToggleShowPassword && (
          <Pressable
            style={({ pressed }) => [
              styles.toggleButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={onToggleShowPassword}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityHint="Toggles password visibility"
          >
            <Icon
              name={showPassword ? 'eyeOff' : 'eye'}
              color={secondaryFont}
              size={20}
            />
          </Pressable>
        )}
      </View>
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
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 40, // Make room for toggle button
    paddingVertical: 10,
    fontSize: 16,
  },
  toggleButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    minWidth: 32,
  },
  error: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
  },
});

export default PasswordField;

