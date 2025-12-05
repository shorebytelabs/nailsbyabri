import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { withOpacity } from '../../utils/color';
import AppText from '../AppText';

function BottomTabBar({ state, descriptors, navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = theme?.colors || {};
  const accentColor = colors.accent || '#531C22';
  const inactiveColor = colors.secondaryFont || '#8A8A8A';
  const backgroundColor = colors.primaryBackground || '#FFFFFF';
  const shadowColor = colors.shadow || '#000000';
  const borderColor = colors.border || '#D9C8A9';

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor,
          shadowColor,
          borderTopColor: withOpacity(borderColor, 0.35),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;
        const badgeValue = options.tabBarBadge;
        const icon =
          typeof options.tabBarIcon === 'function'
            ? options.tabBarIcon({
                focused: isFocused,
                color: isFocused ? accentColor : inactiveColor,
              })
            : null;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
              styles.tabButton,
              {
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.iconWrapper}>
              {icon}
              {badgeValue ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: accentColor,
                      borderColor: backgroundColor,
                    },
                  ]}
                >
                  <AppText variant="small" style={[styles.badgeText, { color: colors.accentContrast || '#FFFFFF' }]}>
                    {badgeValue}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText
              variant="ui"
              style={[
                styles.label,
                {
                  color: isFocused ? accentColor : inactiveColor,
                },
              ]}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    height: 72,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    paddingTop: 20,
  },
  iconWrapper: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default BottomTabBar;

