/**
 * User Service
 * Handles admin operations for managing users
 * All operations require admin authentication and are validated server-side
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Fetch all users with pagination, search, and filters
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.pageSize - Items per page
 * @param {string} options.search - Search query (name/email)
 * @param {string} options.role - Filter by role
 * @param {boolean} options.active - Filter by active status
 * @returns {Promise<Object>} { users, total, page, pageSize }
 */
export async function fetchUsers({ page = 1, pageSize = 20, search = '', role = '', active = null } = {}) {
  try {
    console.log('[userService] fetchUsers called with:', { page, pageSize, search, role, active });
    
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, role, active, created_at, last_login, failed_login_count, last_password_reset', { count: 'exact' });

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    // Apply role filter
    if (role) {
      query = query.eq('role', role);
    }

    // Apply active filter
    if (active !== null) {
      query = query.eq('active', active);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    console.log('[userService] Executing query...');
    const { data, error, count } = await query;

    console.log('[userService] Query result:', { 
      dataCount: data?.length || 0, 
      count, 
      error: error ? { code: error.code, message: error.message } : null 
    });

    if (error) {
      console.error('[userService] Query error:', error);
      throw error;
    }

    // Get order counts for each user
    const userIds = (data || []).map((user) => user.id);
    console.log('[userService] Fetching order counts for', userIds.length, 'users');
    const orderCounts = await getOrderCountsForUsers(userIds);

    // Combine user data with order counts
    // Map full_name to name for consistency
    const usersWithOrders = (data || []).map((user) => ({
      ...user,
      name: user.full_name || user.email, // Use full_name as name
      orderCount: orderCounts[user.id] || 0,
    }));

    console.log('[userService] Returning', usersWithOrders.length, 'users');
    return {
      users: usersWithOrders,
      total: count || 0,
      page,
      pageSize,
    };
  } catch (error) {
    console.error('[userService] Error fetching users:', error);
    throw error;
  }
}

/**
 * Get order counts for multiple users
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Object>} Object mapping user ID to order count
 */
async function getOrderCountsForUsers(userIds) {
  if (!userIds || userIds.length === 0) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('user_id')
      .in('user_id', userIds);

    if (error) {
      console.error('[userService] Error fetching order counts:', error);
      return {};
    }

    // Count orders per user
    const counts = {};
    (data || []).forEach((order) => {
      if (order.user_id) {
        counts[order.user_id] = (counts[order.user_id] || 0) + 1;
      }
    });

    return counts;
  } catch (error) {
    console.error('[userService] Error counting orders:', error);
    return {};
  }
}

/**
 * Fetch a single user by ID with full details
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object with full details
 */
export async function fetchUserById(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    // Get order count
    const orderCount = await getOrderCountsForUsers([userId]);
    data.orderCount = orderCount[userId] || 0;
    // Map full_name to name for consistency
    data.name = data.full_name || data.email;

    // Get recent orders (last 10)
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, status, created_at, pricing')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    data.recentOrders = recentOrders || [];

    return data;
  } catch (error) {
    console.error('[userService] Error fetching user:', error);
    throw error;
  }
}

/**
 * Update user profile information
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @param {string} updates.name - User name
 * @param {string} updates.email - User email
 * @param {boolean} updates.active - Active status
 * @returns {Promise<Object>} Updated user object
 */
export async function updateUser(userId, updates) {
  try {
    const updatePayload = {};
    if (updates.name !== undefined) updatePayload.full_name = updates.name.trim();
    if (updates.email !== undefined) updatePayload.email = updates.email.trim().toLowerCase();
    if (updates.active !== undefined) updatePayload.active = updates.active;

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Map full_name to name for consistency
    if (data) {
      data.name = data.full_name || data.email;
    }

    return data;
  } catch (error) {
    console.error('[userService] Error updating user:', error);
    throw error;
  }
}

/**
 * Reset user password (triggers email)
 * @param {string} userId - User ID
 * @param {string} adminId - Admin user ID (for logging)
 * @returns {Promise<void>}
 */
export async function resetUserPassword(userId, adminId) {
  try {
    // First get the user's email
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      throw new Error('User not found');
    }

    // Use Supabase Auth admin API to reset password
    // Note: This requires service role key or a server-side function
    // For now, we'll use the client-side resetPasswordForEmail
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: 'nailsbyabri://reset-password',
    });

    if (resetError) {
      throw resetError;
    }

    // Log the password reset action (if logging table exists)
    // This would be done server-side in production
    console.log('[userService] Password reset initiated for user:', userId, 'by admin:', adminId);

    return;
  } catch (error) {
    console.error('[userService] Error resetting password:', error);
    throw error;
  }
}

/**
 * Update user role
 * @param {string} userId - User ID
 * @param {string} newRole - New role ('user' or 'admin')
 * @param {string} adminId - Admin user ID (for logging)
 * @returns {Promise<Object>} Updated user object
 */
export async function updateUserRole(userId, newRole, adminId) {
  try {
    // Validate role
    if (!['user', 'admin'].includes(newRole)) {
      throw new Error('Invalid role');
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log role change (if logging table exists)
    console.log('[userService] Role changed for user:', userId, 'to', newRole, 'by admin:', adminId);

    return data;
  } catch (error) {
    console.error('[userService] Error updating role:', error);
    throw error;
  }
}

/**
 * Get user's nail size profiles
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of nail size profiles
 */
export async function getUserNailSizeProfiles(userId) {
  try {
    // Use the same function that ProfileScreen uses to fetch from nail_size_profiles table
    const { getNailSizeProfiles } = await import('./supabaseService');
    const profiles = await getNailSizeProfiles(userId);

    // Transform to the format expected by UserDetailScreen
    return profiles.map((profile) => ({
      id: profile.id,
      name: profile.label || 'Untitled Profile',
      label: profile.label || 'Untitled Profile', // Also include label for consistency
      isDefault: profile.is_default || false,
      sizes: profile.sizes || {},
    }));
  } catch (error) {
    console.error('[userService] Error fetching nail size profiles:', error);
    throw error;
  }
}

/**
 * Update user's nail size profiles
 * @param {string} userId - User ID
 * @param {Array} profiles - Array of nail size profiles
 * @param {string} defaultProfileId - ID of the default profile
 * @returns {Promise<void>}
 */
export async function updateUserNailSizeProfiles(userId, profiles, defaultProfileId) {
  try {
    // Use the same functions that ProfileScreen uses to save to nail_size_profiles table
    const { getNailSizeProfiles, upsertNailSizeProfile, deleteNailSizeProfile } = await import('./supabaseService');
    
    // Get existing profiles to identify which ones need to be deleted
    const existingProfiles = await getNailSizeProfiles(userId);
    const existingProfileIds = new Set(existingProfiles.map((p) => p.id));
    const newProfileIds = new Set(profiles.map((p) => p.id).filter((id) => !id.startsWith('profile_') && !id.startsWith('temp_')));
    
    // Delete profiles that were removed
    for (const existingProfile of existingProfiles) {
      if (!newProfileIds.has(existingProfile.id)) {
        await deleteNailSizeProfile(userId, existingProfile.id);
      }
    }
    
    // Upsert all profiles
    for (const profile of profiles) {
      // Skip temporary IDs - they'll be created as new profiles
      const isTemporaryId = profile.id.startsWith('profile_') || profile.id.startsWith('temp_');
      
      await upsertNailSizeProfile(userId, {
        id: isTemporaryId ? undefined : profile.id, // Undefined ID creates a new profile
        label: profile.name || profile.label || 'Untitled Profile',
        is_default: profile.id === defaultProfileId || profile.isDefault || false,
        sizes: profile.sizes || {},
      });
    }

    return;
  } catch (error) {
    console.error('[userService] Error updating nail size profiles:', error);
    throw error;
  }
}

/**
 * Get user activity log
 * @param {string} userId - User ID
 * @param {number} limit - Number of events to return
 * @returns {Promise<Array>} Array of activity events
 */
export async function getUserActivityLog(userId, limit = 10) {
  try {
    // For now, return basic activity from user record
    // In production, this would query a dedicated activity_log table
    const user = await fetchUserById(userId);

    const activities = [];

    if (user.created_at) {
      activities.push({
        type: 'account_created',
        timestamp: user.created_at,
        description: 'Account created',
      });
    }

    if (user.last_login) {
      activities.push({
        type: 'login',
        timestamp: user.last_login,
        description: 'Last login',
      });
    }

    if (user.last_password_reset) {
      activities.push({
        type: 'password_reset',
        timestamp: user.last_password_reset,
        description: 'Password reset',
      });
    }

    // Add recent orders as activity
    if (user.recentOrders && user.recentOrders.length > 0) {
      user.recentOrders.forEach((order) => {
        activities.push({
          type: 'order_created',
          timestamp: order.created_at,
          description: `Order ${order.status} - $${order.pricing?.total || 0}`,
          orderId: order.id,
        });
      });
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return activities.slice(0, limit);
  } catch (error) {
    console.error('[userService] Error fetching activity log:', error);
    throw error;
  }
}

/**
 * Log impersonation event
 * @param {string} adminId - Admin user ID
 * @param {string} targetUserId - Target user ID
 * @param {string} action - 'start' or 'end'
 * @returns {Promise<void>}
 */
export async function logImpersonation(adminId, targetUserId, action) {
  try {
    // In production, this would insert into an impersonation_logs table
    // For now, just log to console
    console.log('[userService] Impersonation logged:', {
      adminId,
      targetUserId,
      action,
      timestamp: new Date().toISOString(),
    });

    // TODO: Create impersonation_logs table and insert here
    // const { error } = await supabase
    //   .from('impersonation_logs')
    //   .insert({
    //     admin_id: adminId,
    //     target_user_id: targetUserId,
    //     action,
    //     timestamp: new Date().toISOString(),
    //   });

    return;
  } catch (error) {
    console.error('[userService] Error logging impersonation:', error);
    // Don't throw - logging failure shouldn't block impersonation
  }
}

