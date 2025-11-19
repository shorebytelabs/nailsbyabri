import React, { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import HomeDashboardScreen from '../screens/HomeDashboardScreen';
import GalleryScreen from '../screens/GalleryScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BottomTabBar from '../components/navigation/BottomTabBar';
import BrandHeader from '../components/navigation/BrandHeader';
import Icon from '../icons/Icon';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

const Tab = createBottomTabNavigator();

const TAB_ICON_SIZE = 22;
const TAB_ICON_SIZE_ACTIVE = 24;
export default function MainTabs() {
  const navigation = useNavigation();
  const { state, handleStartOrder, ensureAuthenticated } = useAppState();
  const { theme } = useTheme();
  const colors = theme?.colors || {};

  // Check if order is a draft (handle both old 'draft' and new 'Draft' formats)
  const isDraftStatus = state.activeOrder?.status === 'draft' || 
                        state.activeOrder?.status === 'Draft' ||
                        (state.activeOrder?.status || '').toLowerCase() === 'draft';
  const draftBadgeCount = isDraftStatus ? 1 : 0;

  const openCreateFlow = useCallback(() => {
    const canProceed = handleStartOrder({ navigation });
    if (canProceed) {
      logEvent('tap_nav_create');
      navigation.navigate('NewOrderFlow');
    }
  }, [handleStartOrder, navigation]);

  const openAdminPanel = useCallback(() => {
    navigation.navigate('AdminPanel');
  }, [navigation]);

  return (
    <View style={styles.root}>
      <BrandHeader 
        showCreateButton 
        onPressCreate={openCreateFlow}
        onPressAdmin={state.currentUser?.isAdmin ? openAdminPanel : undefined}
      />
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
});

