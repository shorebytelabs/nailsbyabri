import React, { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HomeDashboardScreen from '../screens/HomeDashboardScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BottomTabBar from '../components/navigation/BottomTabBar';
import FloatingCreateButton from '../components/navigation/FloatingCreateButton';
import Icon from '../icons/Icon';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';

const Tab = createBottomTabNavigator();

function PlaceholderScreen() {
  return <View />;
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { handleStartOrder } = useAppState();

  const openCreateFlow = useCallback(() => {
    const canProceed = handleStartOrder();
    if (canProceed) {
      logEvent('tap_fab_create');
      navigation.navigate('NewOrderFlow');
    }
  }, [handleStartOrder, navigation]);

  return (
    <>
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
              <Icon name="home" color={color} size={focused ? 26 : 24} />
            ),
          }}
        />
        <Tab.Screen
          name="Orders"
          component={OrdersScreen}
          options={{
            tabBarLabel: 'Orders',
            tabBarIcon: ({ color, focused }) => (
              <Icon name="orders" color={color} size={focused ? 26 : 24} />
            ),
          }}
        />
        <Tab.Screen
          name="CreateEntry"
          component={PlaceholderScreen}
          options={{
            tabBarLabel: 'Create',
            tabBarIcon: ({ color, focused }) => (
              <Icon name="create" color={color} size={focused ? 26 : 24} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              logEvent('tap_nav_create');
              openCreateFlow();
            },
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Icon name="profile" color={color} size={focused ? 26 : 24} />
            ),
          }}
        />
      </Tab.Navigator>
      <FloatingCreateButton bottomInset={insets.bottom} onPress={openCreateFlow} />
    </>
  );
}

