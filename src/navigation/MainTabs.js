import React, { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HomeDashboardScreen from '../screens/HomeDashboardScreen';
import GalleryScreen from '../screens/GalleryScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BottomTabBar from '../components/navigation/BottomTabBar';
import Icon from '../icons/Icon';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

const Tab = createBottomTabNavigator();

const TAB_ICON_SIZE = 22;
const TAB_ICON_SIZE_ACTIVE = 24;
const LOGO_SOURCE = require('../../assets/images/NailsByAbriLogo.png');

export default function MainTabs() {
  const navigation = useNavigation();
  const { state, handleStartOrder, ensureAuthenticated } = useAppState();
  const { theme } = useTheme();
  const colors = theme?.colors || {};

  const draftBadgeCount = state.activeOrder?.status === 'draft' ? 1 : 0;

  const openCreateFlow = useCallback(() => {
    const canProceed = handleStartOrder({ navigation });
    if (canProceed) {
      logEvent('tap_nav_create');
      navigation.navigate('NewOrderFlow');
    }
  }, [handleStartOrder, navigation]);

  return (
    <View style={styles.root}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[
          styles.brandHeaderSafe,
          {
            backgroundColor: colors.primaryBackground,
            borderBottomColor: withOpacity(colors.shadow, 0.08),
          },
        ]}
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
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create new custom nail set"
              onPress={openCreateFlow}
              style={({ pressed }) => [
                styles.headerButton,
                {
                  backgroundColor: colors.accent,
                  shadowColor: colors.shadow,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Icon name="plus" color={colors.accentContrast} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      <Tab.Navigator
        initialRouteName="Home"
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeDashboardScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Icon name="home" color={color} size={focused ? TAB_ICON_SIZE_ACTIVE : TAB_ICON_SIZE} />
            ),
          }}
        />
        <Tab.Screen
          name="Gallery"
          component={GalleryScreen}
          options={{
            tabBarLabel: 'Gallery',
            tabBarIcon: ({ color, focused }) => (
              <Icon
                name="gallery"
                color={color}
                size={focused ? TAB_ICON_SIZE_ACTIVE : TAB_ICON_SIZE}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Orders"
          component={OrdersScreen}
          listeners={{
            tabPress: (event) => {
              const allowed = ensureAuthenticated({
                navigation,
                message: 'Log in to view your orders.',
                redirect: { type: 'tab', tab: 'Orders' },
              });
              if (!allowed) {
                event.preventDefault();
              }
            },
          }}
          options={{
            tabBarLabel: 'Orders',
            tabBarBadge: draftBadgeCount > 0 ? draftBadgeCount : undefined,
            tabBarIcon: ({ color, focused }) => (
              <Icon name="orders" color={color} size={focused ? TAB_ICON_SIZE_ACTIVE : TAB_ICON_SIZE} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          listeners={{
            tabPress: (event) => {
              const allowed = ensureAuthenticated({
                navigation,
                message: 'Log in to view your profile.',
                redirect: { type: 'tab', tab: 'Profile' },
              });
              if (!allowed) {
                event.preventDefault();
              }
            },
          }}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Icon name="profile" color={color} size={focused ? TAB_ICON_SIZE_ACTIVE : TAB_ICON_SIZE} />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
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

