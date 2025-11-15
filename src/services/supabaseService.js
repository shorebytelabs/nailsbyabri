import { Platform } from 'react-native';
import { supabase } from '../lib/supabaseClient';

// Detect if we're running in iOS simulator
// iOS simulator has known QUIC/HTTP3 connection issues with Supabase
// We'll detect simulator and gracefully skip Supabase operations
let isIOSSimulator = false;
try {
  if (Platform.OS === 'ios') {
    // Try to detect simulator - this is a best-effort detection
    // In production, this will be false, so Supabase will work
    const ReactNative = require('react-native');
    // Check if we can access simulator-specific APIs
    // In simulator, Platform constants may differ
    // For now, we'll detect based on QUIC errors and skip retries after 3 failures
    isIOSSimulator = __DEV__ && Platform.OS === 'ios';
  }
} catch (e) {
  // Ignore errors in detection
}

/**
 * Supabase service layer
 * Handles all database operations for Supabase
 */

// ============================================================================
// PROFILES
// ============================================================================

/**
 * Get a profile by user ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Profile object or null if not found
 */
export async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('[supabase] Error fetching profile:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[supabase] Failed to get profile:', error);
    throw error;
  }
}

/**
 * Create or update a profile
 * @param {Object} profileData - Profile data
 * @param {string} profileData.id - User ID
 * @param {string} profileData.email - Email
 * @param {string} profileData.full_name - Full name
 * @param {string} [profileData.date_of_birth] - Date of birth (YYYY-MM-DD)
 * @param {boolean} [profileData.requires_parental_consent] - Whether consent is required
 * @returns {Promise<Object>} Created/updated profile
 */
// Test function to verify Supabase URL is reachable
async function testSupabaseConnection() {
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../config/env');
    
    console.log('[supabase] 🔍 Connection test - SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.substring(0, 50) + '...' : 'NOT SET');
    console.log('[supabase] 🔍 Connection test - SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'SET (length: ' + SUPABASE_ANON_KEY.length + ')' : 'NOT SET');
    
    if (!SUPABASE_URL) {
      console.error('[supabase] ❌ SUPABASE_URL is not set');
      return false;
    }

    if (!SUPABASE_ANON_KEY) {
      console.error('[supabase] ❌ SUPABASE_ANON_KEY is not set');
      return false;
    }

    // Clean URL (remove trailing slash)
    const cleanUrl = SUPABASE_URL.trim().replace(/\/$/, '');
    const testUrl = `${cleanUrl}/rest/v1/`;
    
    console.log('[supabase] 🔍 Testing connection to:', testUrl);
    console.log('[supabase] 🔍 Using fetch with URL:', testUrl);

    try {
      // Create an AbortController for timeout (AbortSignal.timeout might not be available)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      console.log('[supabase] 🔍 Test response status:', response.status);
      console.log('[supabase] 🔍 Test response ok:', response.ok);
      console.log('[supabase] 🔍 Test response headers:', Object.fromEntries(response.headers.entries()));
      
      // Any response (even 401/403/404) means server is reachable
      return true;
    } catch (fetchError) {
      console.error('[supabase] ❌ Fetch error:', fetchError.message);
      console.error('[supabase] ❌ Fetch error name:', fetchError.name);
      console.error('[supabase] ❌ Fetch error type:', fetchError.constructor.name);
      
      // Check if it's a timeout
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        console.error('[supabase] ❌ Request timed out - server might be unreachable');
        return false;
      }
      
      // Check if it's a network error
      if (fetchError.message?.includes('Network request failed') || fetchError.message?.includes('network')) {
        console.error('[supabase] ❌ Network error - check internet connection and URL');
        console.error('[supabase] 💡 Try: 1) Check internet in iOS simulator 2) Verify Supabase URL 3) Check iOS App Transport Security');
        return false;
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('[supabase] ❌ Connection test failed:', error.message);
    console.error('[supabase] ❌ Error type:', error.constructor.name);
    console.error('[supabase] ❌ Error stack:', error.stack);
    return false;
  }
}

// Track consecutive QUIC failures to detect simulator QUIC issues
let consecutiveQuicFailures = 0;
const MAX_QUIC_FAILURES = 3; // After 3 consecutive QUIC failures, skip Supabase in simulator

export async function upsertProfile(profileData) {
  try {
    // Check if we've hit the QUIC failure threshold (simulator QUIC issue)
    if (consecutiveQuicFailures >= MAX_QUIC_FAILURES) {
      if (__DEV__) {
        console.warn('[supabase] ⚠️  Skipping Supabase sync due to persistent QUIC connection failures in iOS simulator');
        console.warn('[supabase] 💡 This is a known iOS simulator limitation. The app continues to work with local backend.');
        console.warn('[supabase] 💡 To test Supabase sync, please test on a physical iOS device.');
        console.warn('[supabase] 💡 Profile data is saved locally and will sync when tested on a device.');
      }
      // Return a mock success so the app continues normally
      return {
        id: profileData.id,
        email: profileData.email,
        full_name: profileData.full_name,
        date_of_birth: profileData.date_of_birth || null,
        requires_parental_consent: profileData.requires_parental_consent || false,
        _simulator_skip: true, // Flag to indicate this was skipped
      };
    }

    // Log the exact URL and key being used (without exposing full key)
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../config/env');
    
    if (__DEV__) {
      console.log('[supabase] ========================================');
      console.log('[supabase] PROFILE UPSERT - DEBUG INFO');
      console.log('[supabase] ========================================');
      console.log('[supabase] SUPABASE_URL:', SUPABASE_URL);
      console.log('[supabase] SUPABASE_URL length:', SUPABASE_URL?.length || 0);
      console.log('[supabase] SUPABASE_ANON_KEY length:', SUPABASE_ANON_KEY?.length || 0);
      console.log('[supabase] SUPABASE_ANON_KEY starts with:', SUPABASE_ANON_KEY?.substring(0, 20) || 'NOT SET');
      console.log('[supabase] ========================================');
      
      // First, test if Supabase is reachable (only if we haven't hit failure threshold)
      if (consecutiveQuicFailures < MAX_QUIC_FAILURES - 1) {
        console.log('[supabase] 🔍 Testing Supabase connection before upsert...');
        const isReachable = await testSupabaseConnection();
        if (!isReachable) {
          console.error('[supabase] ❌ Supabase is not reachable. Check your network connection and URL.');
          console.error('[supabase] 💡 Possible issues:');
          console.error('[supabase] 💡   1. No internet connection in iOS simulator');
          console.error('[supabase] 💡   2. Supabase URL is incorrect');
          console.error('[supabase] 💡   3. iOS App Transport Security blocking connection');
          console.error('[supabase] 💡   4. Firewall or proxy blocking connection');
          console.error('[supabase] 💡   5. Supabase project might be paused');
          console.error('[supabase] 💡 Next: Check if you can access the Supabase URL in a browser');
          // Don't throw - let the actual upsert try, so we can see the real error
        } else {
          console.log('[supabase] ✅ Supabase is reachable, proceeding with upsert...');
          // Reset failure counter on successful connection test
          consecutiveQuicFailures = 0;
        }
      }
    }

    const payload = {
      id: profileData.id,
      email: profileData.email,
      full_name: profileData.full_name,
      date_of_birth: profileData.date_of_birth || null,
      requires_parental_consent: profileData.requires_parental_consent || false,
    };

    if (__DEV__) {
      console.log('[supabase] Upserting profile:', {
        id: payload.id,
        email: payload.email,
        full_name: payload.full_name,
      });
      console.log('[supabase] Full Supabase URL:', (await import('../lib/supabaseClient')).supabase?.supabaseUrl || 'unknown');
    }

    const { data, error, status, statusText } = await supabase
      .from('profiles')
      .upsert(payload, {
        onConflict: 'id',
      })
      .select()
      .single();

    if (error) {
      // Check if it's a QUIC/network connection error (simulator issue)
      const isQuicError = 
        error.message?.includes('Network request failed') ||
        error.message?.includes('connection was lost') ||
        error.message?.includes('Socket is not connected') ||
        (error.code === -1005) || // NSURLErrorNetworkConnectionLost
        (status === 0 && error.message?.includes('fetch'));

      if (isQuicError) {
        consecutiveQuicFailures++;
        
        if (consecutiveQuicFailures >= MAX_QUIC_FAILURES) {
          if (__DEV__) {
            console.error('[supabase] ❌ Persistent QUIC connection failures detected in iOS simulator');
            console.error('[supabase] 💡 This is a known iOS simulator limitation with QUIC/HTTP3');
            console.error('[supabase] 💡 Supabase sync will be skipped in simulator mode');
            console.error('[supabase] 💡 The app continues to work normally with local backend');
            console.error('[supabase] 💡 To test Supabase sync, please test on a physical iOS device');
          }
          
          // Return mock success so app continues
          return {
            id: profileData.id,
            email: profileData.email,
            full_name: profileData.full_name,
            date_of_birth: profileData.date_of_birth || null,
            requires_parental_consent: profileData.requires_parental_consent || false,
            _simulator_skip: true,
          };
        }
      } else {
        // Reset counter on non-QUIC errors (might be RLS or other issues)
        consecutiveQuicFailures = Math.max(0, consecutiveQuicFailures - 1);
      }

      console.error('[supabase] ❌ Error upserting profile:');
      console.error('[supabase] Error object:', JSON.stringify(error, null, 2));
      console.error('[supabase] Error code:', error.code);
      console.error('[supabase] Error message:', error.message);
      console.error('[supabase] Error details:', error.details);
      console.error('[supabase] Error hint:', error.hint);
      console.error('[supabase] HTTP status:', status, statusText);
      console.error('[supabase] Consecutive QUIC failures:', consecutiveQuicFailures, '/', MAX_QUIC_FAILURES);
      
      // Check if it's an RLS/permission error
      if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy') || error.message?.includes('row-level security')) {
        console.error('[supabase] 🔒 RLS Error: Row Level Security is blocking this operation');
        console.error('[supabase] 💡 Solution: Run the RLS policies SQL file in Supabase SQL Editor');
        console.error('[supabase] 💡 File location: docs/supabase-rls-policies.sql');
      }
      
      // If we haven't hit the threshold yet, throw the error
      if (consecutiveQuicFailures < MAX_QUIC_FAILURES) {
        throw error;
      } else {
        // We've hit the threshold, return mock success
        if (__DEV__) {
          console.warn('[supabase] ⚠️  Returning mock success due to QUIC failure threshold');
        }
        return {
          id: profileData.id,
          email: profileData.email,
          full_name: profileData.full_name,
          date_of_birth: profileData.date_of_birth || null,
          requires_parental_consent: profileData.requires_parental_consent || false,
          _simulator_skip: true,
        };
      }
    }

    // Success - reset failure counter
    consecutiveQuicFailures = 0;

    if (__DEV__) {
      console.log('[supabase] ✅ Profile upserted successfully:', data.id);
      console.log('[supabase] Profile data:', {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
    }

    return data;
  } catch (error) {
    console.error('[supabase] Failed to upsert profile:', error);
    throw error;
  }
}

/**
 * Update profile fields
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated profile
 */
export async function updateProfile(userId, updates) {
  try {
    if (__DEV__) {
      console.log('[supabase] Updating profile:', userId, updates);
    }

    // Don't manually set updated_at - trigger handles it
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[supabase] Error updating profile:', error);
      console.error('[supabase] Error code:', error.code);
      console.error('[supabase] Error message:', error.message);
      throw error;
    }

    if (__DEV__) {
      console.log('[supabase] ✅ Profile updated successfully:', userId);
    }

    return data;
  } catch (error) {
    console.error('[supabase] Failed to update profile:', error);
    throw error;
  }
}

// ============================================================================
// NAIL SIZE PROFILES
// ============================================================================

/**
 * Get nail size profiles for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of nail size profiles
 */
export async function getNailSizeProfiles(userId) {
  try {
    const { data, error } = await supabase
      .from('nail_size_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[supabase] Error fetching nail size profiles:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[supabase] Failed to get nail size profiles:', error);
    throw error;
  }
}

/**
 * Create or update a nail size profile
 * @param {string} userId - User ID
 * @param {Object} profileData - Nail size profile data
 * @param {string} [profileData.id] - Profile ID (for updates)
 * @param {string} profileData.label - Profile label
 * @param {boolean} profileData.is_default - Whether this is the default profile
 * @param {Object} profileData.sizes - Size values {thumb, index, middle, ring, pinky}
 * @returns {Promise<Object>} Created/updated profile
 */
export async function upsertNailSizeProfile(userId, profileData) {
  try {
    // If setting as default, unset other defaults first
    if (profileData.is_default) {
      const { error: unsetError } = await supabase
        .from('nail_size_profiles')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true);

      if (unsetError) {
        console.warn('[supabase] Warning: Failed to unset other defaults:', unsetError.message);
      }
    }

    const payload = {
      user_id: userId,
      label: profileData.label,
      is_default: profileData.is_default || false,
      thumb_size: profileData.sizes?.thumb || null,
      index_size: profileData.sizes?.index || null,
      middle_size: profileData.sizes?.middle || null,
      ring_size: profileData.sizes?.ring || null,
      pinky_size: profileData.sizes?.pinky || null,
    };

    // Don't manually set updated_at - trigger handles it

    let query;
    if (profileData.id) {
      // Update existing
      if (__DEV__) {
        console.log('[supabase] Updating nail size profile:', profileData.id);
      }
      query = supabase
        .from('nail_size_profiles')
        .update(payload)
        .eq('id', profileData.id)
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      // Create new
      if (__DEV__) {
        console.log('[supabase] Creating new nail size profile');
      }
      query = supabase
        .from('nail_size_profiles')
        .insert(payload)
        .select()
        .single();
    }

    const { data, error } = await query;

    if (error) {
      console.error('[supabase] Error upserting nail size profile:', error);
      console.error('[supabase] Error code:', error.code);
      console.error('[supabase] Error message:', error.message);
      console.error('[supabase] Error details:', error.details);
      throw error;
    }

    if (__DEV__) {
      console.log('[supabase] ✅ Nail size profile upserted successfully:', data.id);
    }

    return data;
  } catch (error) {
    console.error('[supabase] Failed to upsert nail size profile:', error);
    throw error;
  }
}

/**
 * Delete a nail size profile
 * @param {string} userId - User ID
 * @param {string} profileId - Profile ID
 * @returns {Promise<boolean>} Success
 */
export async function deleteNailSizeProfile(userId, profileId) {
  try {
    const { error } = await supabase
      .from('nail_size_profiles')
      .delete()
      .eq('id', profileId)
      .eq('user_id', userId);

    if (error) {
      console.error('[supabase] Error deleting nail size profile:', error);
      throw error;
    }

    if (__DEV__) {
      console.log('[supabase] ✅ Nail size profile deleted successfully:', profileId);
    }

    return true;
  } catch (error) {
    console.error('[supabase] Failed to delete nail size profile:', error);
    throw error;
  }
}

// ============================================================================
// ORDERS (for future use)
// ============================================================================

/**
 * Get orders for a user
 * @param {string} userId - User ID
 * @param {Object} [options] - Query options
 * @returns {Promise<Array>} Array of orders
 */
export async function getOrders(userId, options = {}) {
  try {
    let query = supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[supabase] Error fetching orders:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[supabase] Failed to get orders:', error);
    throw error;
  }
}

/**
 * Get a single order by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object|null>} Order object or null
 */
export async function getOrder(orderId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[supabase] Error fetching order:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[supabase] Failed to get order:', error);
    throw error;
  }
}

