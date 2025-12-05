/**
 * Manage Users Screen
 * Admin-only screen for viewing and managing all users
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import AppText from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { withOpacity } from '../utils/color';
import { fetchUsers } from '../services/userService';

function ManageUsersScreen({ navigation }) {
  const { theme } = useTheme();
  const { state } = useAppState();
  const colors = theme?.colors || {};
  const isAdmin = state.currentUser?.isAdmin || false;

  useEffect(() => {
    console.log('[ManageUsers] Screen mounted, isAdmin:', isAdmin);
  }, [isAdmin]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const pageSize = 20;

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    // If impersonating, redirect to home screen instead of showing alert
    if (state.impersonating) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
      return;
    }
    
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have permission to access this page.');
      navigation.goBack();
      return;
    }
    loadUsers();
  }, [isAdmin, navigation, page, searchQuery, roleFilter, activeFilter, loadUsers, state.impersonating]);

  const loadUsers = useCallback(async () => {
    try {
      console.log('[ManageUsers] loadUsers called');
      setLoading(true);
      const result = await fetchUsers({
        page,
        pageSize,
        search: searchQuery,
        role: roleFilter,
        active: activeFilter,
      });
      console.log('[ManageUsers] fetchUsers returned:', { 
        userCount: result.users?.length || 0, 
        total: result.total 
      });
      setUsers(result.users || []);
      setTotal(result.total || 0);
      console.log('[ManageUsers] State updated, users:', result.users?.length || 0);
    } catch (error) {
      console.error('[ManageUsers] Error loading users:', error);
      const errorMessage = error?.message || error?.code || 'Failed to load users. Please try again.';
      Alert.alert(
        'Error',
        `${errorMessage}\n\nMake sure you have run the migration script to add user management columns to the profiles table.`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('[ManageUsers] loadUsers finished, loading:', false);
    }
  }, [page, searchQuery, roleFilter, activeFilter]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    loadUsers();
  }, [loadUsers]);

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
    setPage(1); // Reset to first page on search
  }, []);

  const handleRoleFilter = useCallback((role) => {
    setRoleFilter(role === roleFilter ? '' : role);
    setPage(1);
  }, [roleFilter]);

  const handleActiveFilter = useCallback((active) => {
    setActiveFilter(active === activeFilter ? null : active);
    setPage(1);
  }, [activeFilter]);

  const handleUserPress = useCallback((user) => {
    // Use navigate which will be overridden by AdminPanelScreen to handle inline rendering
    if (navigation.navigate) {
      navigation.navigate('UserDetail', { userId: user.id });
    }
  }, [navigation]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Invalid';
    }
  };

  const formatRole = (role) => {
    return role === 'admin' ? 'Admin' : 'User';
  };

  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';

  const renderUserRow = ({ item: user }) => (
    <TouchableOpacity
      onPress={() => handleUserPress(user)}
      style={[styles.userRow, { borderColor: withOpacity(borderColor, 0.3) }]}
      activeOpacity={0.7}
    >
      <View style={styles.userRowContent}>
        <View style={styles.userInfo}>
          <AppText style={[styles.userName, { color: primaryFont }]} numberOfLines={1}>
            {user.name || 'No name'}
          </AppText>
          <AppText style={[styles.userEmail, { color: secondaryFont }]} numberOfLines={1}>
            {user.email}
          </AppText>
        </View>
        <View style={styles.userMeta}>
          <View style={styles.metaRow}>
            <AppText style={[styles.metaLabel, { color: secondaryFont }]}>Role:</AppText>
            <AppText style={[styles.metaValue, { color: primaryFont }]}>{formatRole(user.role)}</AppText>
          </View>
          <View style={styles.metaRow}>
            <AppText style={[styles.metaLabel, { color: secondaryFont }]}>Status:</AppText>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: user.active
                    ? withOpacity(colors.success || '#4CAF50', 0.1)
                    : withOpacity(colors.error || '#B33A3A', 0.1),
                },
              ]}
            >
              <AppText
                style={[
                  styles.statusText,
                  {
                    color: user.active ? colors.success || '#4CAF50' : colors.error || '#B33A3A',
                  },
                ]}
              >
                {user.active ? 'Active' : 'Inactive'}
              </AppText>
            </View>
          </View>
          <View style={styles.metaRow}>
            <AppText style={[styles.metaLabel, { color: secondaryFont }]}>Orders:</AppText>
            <AppText style={[styles.metaValue, { color: primaryFont }]}>{user.orderCount || 0}</AppText>
          </View>
          <View style={styles.metaRow}>
            <AppText style={[styles.metaLabel, { color: secondaryFont }]}>Last login:</AppText>
            <AppText style={[styles.metaValue, { color: primaryFont }]}>{formatDate(user.last_login)}</AppText>
          </View>
        </View>
      </View>
      <Icon name="chevronRight" color={secondaryFont} size={20} />
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loading && users.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <AppText style={[styles.emptyText, { color: secondaryFont }]}>No users found</AppText>
        </View>
      );
    }
    if (loading && page === 1) {
      return null; // Show main loader instead
    }
    return null;
  };

  const hasMore = page * pageSize < total;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primaryBackground || '#F4EBE3' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevronRight" color={primaryFont} size={20} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Manage Users</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filtersContainer}>
        <View style={[styles.searchContainer, { borderColor: withOpacity(borderColor, 0.5) }]}>
          <Icon name="search" color={secondaryFont} size={18} />
          <TextInput
            style={[styles.searchInput, { color: primaryFont }]}
            placeholder="Search by name or email..."
            placeholderTextColor={withOpacity(secondaryFont, 0.5)}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Icon name="close" color={secondaryFont} size={18} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
          <TouchableOpacity
            onPress={() => handleRoleFilter('user')}
            style={[
              styles.filterChip,
              {
                backgroundColor: roleFilter === 'user' ? withOpacity(accent, 0.1) : surface,
                borderColor: roleFilter === 'user' ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: roleFilter === 'user' ? accent : primaryFont,
                },
              ]}
            >
              Users
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleRoleFilter('admin')}
            style={[
              styles.filterChip,
              {
                backgroundColor: roleFilter === 'admin' ? withOpacity(accent, 0.1) : surface,
                borderColor: roleFilter === 'admin' ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: roleFilter === 'admin' ? accent : primaryFont,
                },
              ]}
            >
              Admins
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleActiveFilter(true)}
            style={[
              styles.filterChip,
              {
                backgroundColor: activeFilter === true ? withOpacity(accent, 0.1) : surface,
                borderColor: activeFilter === true ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: activeFilter === true ? accent : primaryFont,
                },
              ]}
            >
              Active
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleActiveFilter(false)}
            style={[
              styles.filterChip,
              {
                backgroundColor: activeFilter === false ? withOpacity(accent, 0.1) : surface,
                borderColor: activeFilter === false ? accent : withOpacity(borderColor, 0.5),
              },
            ]}
          >
            <AppText
              style={[
                styles.filterChipText,
                {
                  color: activeFilter === false ? accent : primaryFont,
                },
              ]}
            >
              Inactive
            </AppText>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading && page === 1 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={accent} />
          <AppText style={[styles.loadingText, { color: secondaryFont }]}>Loading users...</AppText>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserRow}
          keyExtractor={(item) => item.id}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListFooterComponent={renderFooter}
          onEndReached={() => {
            if (hasMore && !loading) {
              setPage((prev) => prev + 1);
            }
          }}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <AppText style={[styles.emptyText, { color: secondaryFont }]}>No users found</AppText>
              </View>
            ) : null
          }
        />
      )}

      {total > 0 && (
        <View style={[styles.paginationInfo, { borderTopColor: withOpacity(borderColor, 0.3) }]}>
          <AppText style={[styles.paginationText, { color: secondaryFont }]}>
            Showing {users.length} of {total} users
          </AppText>
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors) {
  const primaryFont = colors.primaryFont || '#220707';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || '#D9C8A9';
  const accent = colors.accent || '#6F171F';

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withOpacity(colors.shadow || '#000000', 0.08),
    },
    backButton: {
      padding: 8,
      transform: [{ rotate: '180deg' }],
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    headerSpacer: {
      width: 36,
    },
    filtersContainer: {
      padding: 16,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: withOpacity(borderColor, 0.3),
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: surface,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
    },
    filtersRow: {
      flexDirection: 'row',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
    },
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      marginTop: 8,
    },
    listContent: {
      padding: 16,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: surface,
      gap: 12,
    },
    userRowContent: {
      flex: 1,
      gap: 8,
    },
    userInfo: {
      gap: 4,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
    },
    userEmail: {
      fontSize: 13,
    },
    userMeta: {
      gap: 4,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    metaLabel: {
      fontSize: 12,
    },
    metaValue: {
      fontSize: 12,
      fontWeight: '500',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
    },
    paginationInfo: {
      padding: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
    },
    paginationText: {
      fontSize: 12,
    },
  });
}

export default ManageUsersScreen;

