import React, { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import HomeDashboardScreen from '../screens/HomeDashboardScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BottomTabBar from '../components/navigation/BottomTabBar';
import FloatingCreateButton from '../components/navigation/FloatingCreateButton';
import Icon from '../icons/Icon';
import { useAppState } from '../context/AppContext';
import { logEvent } from '../utils/analytics';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

const Tab = createBottomTabNavigator();

function PlaceholderScreen() {
  return <View />;
}

export default function MainTabs() {
  const navigation = useNavigation();
  const { handleStartOrder } = useAppState();
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const insets = useSafeAreaInsets();

  const openCreateFlow = useCallback(() => {
    const canProceed = handleStartOrder();
    if (canProceed) {
      logEvent('tap_fab_create');
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
          <View
            style={[
              styles.logoMark,
              {
                backgroundColor: colors.accent,
                shadowColor: colors.shadow,
              },
            ]}
            accessibilityRole="image"
            accessibilityLabel="Nails by Abri logo"
          >
            <Text style={[styles.logoInitials, { color: colors.accentContrast }]}>NBA</Text>
          </View>
          <View style={styles.brandTextGroup}>
            <Text style={[styles.brandSubtitle, { color: colors.secondaryFont }]}>Nails by Abri</Text>
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
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  logoInitials: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  brandTextGroup: {
    flexDirection: 'column',
    gap: 1,
  },
  brandGreeting: {
    fontSize: 16,
    fontStyle: 'italic',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

