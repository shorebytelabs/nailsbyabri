import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import Icon from '../../icons/Icon';
import { withOpacity } from '../../utils/color';
import { useAppState } from '../../context/AppContext';

const LOGO_SOURCE = require('../../../assets/images/NailsByAbriLogo.png');

function BrandHeader({
  showCreateButton = false,
  onPressCreate,
  onPressAdmin,
  rightContent = null,
  testID,
}) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const backgroundColor = colors.primaryBackground || '#F4EBE3';
  const isAdmin = state.currentUser?.isAdmin || false;

  const renderRightContent = () => {
    const buttons = [];

    // Add admin gear icon if user is admin
    if (isAdmin && typeof onPressAdmin === 'function') {
      buttons.push(
        <Pressable
          key="admin"
          accessibilityRole="button"
          accessibilityLabel="Admin Panel"
          onPress={onPressAdmin}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: colors.surface || '#FFFFFF',
              borderWidth: 1,
              borderColor: withOpacity(colors.border || '#D9C8A9', 0.5),
              shadowColor: colors.shadow || '#000000',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          testID="brand-header-admin"
        >
          <Icon name="gear" color={colors.primaryFont || '#220707'} size={20} />
        </Pressable>
      );
    }

    // Add create button if needed
    if (showCreateButton && typeof onPressCreate === 'function') {
      buttons.push(
        <Pressable
          key="create"
          accessibilityRole="button"
          accessibilityLabel="Create new custom nail set"
          onPress={onPressCreate}
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: colors.accent || '#6F171F',
              shadowColor: colors.shadow || '#000000',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          testID="brand-header-create"
        >
          <Icon name="plus" color={colors.accentContrast || '#FFFFFF'} />
        </Pressable>
      );
    }

    if (buttons.length > 0) {
      return <View style={styles.headerActions}>{buttons}</View>;
    }

    if (rightContent) {
      return <View style={styles.headerActions}>{rightContent}</View>;
    }

    return <View style={styles.headerActionsPlaceholder} />;
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.brandHeaderSafe,
        {
          backgroundColor,
          borderBottomColor: withOpacity(colors.shadow || '#000000', 0.08),
        },
      ]}
      testID={testID}
    >
      <View style={styles.brandHeader}>
        <View style={styles.brandInfo}>
          <View style={styles.brandLogoFrame}>
            <Image
              source={LOGO_SOURCE}
              style={styles.brandLogo}
              resizeMode="cover"
              accessibilityRole="image"
              accessibilityLabel="Nails by Abri"
            />
          </View>
        </View>
        {renderRightContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandHeaderSafe: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  brandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoFrame: {
    height: 56,
    width: 200,
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  brandLogo: {
    width: '100%',
    height: 120,
    marginTop: 50,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActionsPlaceholder: {
    width: 42,
    height: 42,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
});

export default BrandHeader;

