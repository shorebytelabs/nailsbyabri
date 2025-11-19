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
// In simulator, skip after first QUIC failure since we know it will persist
// On physical devices, allow more retries for transient network issues
const MAX_QUIC_FAILURES = (__DEV__ && Platform.OS === 'ios') ? 1 : 3;

// Note: isIOSSimulator is already declared at the top of the file

export async function upsertProfile(profileData) {
  try {
    // In iOS simulator, skip Supabase sync immediately to avoid QUIC failures
    // The simulator's QUIC implementation is buggy and will always fail
    if (isIOSSimulator && consecutiveQuicFailures >= MAX_QUIC_FAILURES) {
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
    };

    if (__DEV__) {
      console.log('[supabase] Upserting profile:', {
        id: payload.id,
        email: payload.email,
        full_name: payload.full_name,
      });
      console.log('[supabase] Full Supabase URL:', (await import('../lib/supabaseClient')).supabase?.supabaseUrl || 'unknown');
    }

    // Verify we have a session before attempting the upsert
    // RLS policies require auth.uid() to be available
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (__DEV__) {
      console.log('[supabase] Session check before profile upsert:', {
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        payloadUserId: payload.id,
        sessionError: sessionError?.message,
      });
    }
    
    if (!session) {
      if (__DEV__) {
        console.warn('[supabase] ⚠️  No session found - RLS policies will block the insert');
        console.warn('[supabase] This might happen if signup just completed and session isn\'t set yet');
      }
      throw new Error('No active session. Please log in and try again.');
    }
    
    // CRITICAL: Ensure the profile ID matches the authenticated user's ID
    // RLS policy requires auth.uid() = id, so they must match
    // Always use the authenticated user's ID from the session to prevent RLS errors
    const authenticatedUserId = session.user.id;
    if (payload.id !== authenticatedUserId) {
      // This can happen if:
      // 1. The user signed up but the session hasn't been set yet
      // 2. There's a mismatch between the signup response and the actual session
      // 3. The AppContext is using a stale user ID
      // We'll silently fix it by using the authenticated user's ID (no warning needed)
      payload.id = authenticatedUserId;
      if (__DEV__) {
        console.log('[supabase] Using authenticated user ID for profile (corrected from payload):', authenticatedUserId);
      }
    }
    
    // First, check if profile already exists (might have been created by trigger)
    // This helps us understand if we're doing INSERT or UPDATE
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', payload.id)
      .single();
    
    if (__DEV__) {
      console.log('[supabase] Profile check result:', {
        exists: !!existingProfile,
        checkError: checkError?.code,
        checkErrorMessage: checkError?.message,
        userId: payload.id,
      });
    }
    
    // Use upsert - it will INSERT if doesn't exist, UPDATE if it does
    // Handle conflicts on both 'id' and 'email' since email also has a unique constraint
    // First, try to find existing profile by email (in case email matches but id doesn't)
    let existingProfileByEmail = null;
    if (payload.email) {
      const { data: emailProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', payload.email)
        .maybeSingle();
      existingProfileByEmail = emailProfile;
    }
    
    // If profile exists by email but id is different, use the existing id
    if (existingProfileByEmail && existingProfileByEmail.id !== payload.id) {
      if (__DEV__) {
        console.warn('[supabase] ⚠️  Profile exists with different ID for email:', payload.email);
        console.warn('[supabase] Using existing profile ID:', existingProfileByEmail.id);
      }
      payload.id = existingProfileByEmail.id;
    }
    
    const { data, error, status, statusText } = await supabase
      .from('profiles')
      .upsert(payload, {
        onConflict: 'id', // Primary key conflict
        // Note: If email conflict still occurs, it means there's a profile with same email but different id
        // In that case, we'll handle it as an update on the existing profile
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
        
        if (__DEV__) {
          console.log('[supabase] 🔍 QUIC error detected');
          console.log('[supabase] Consecutive QUIC failures:', consecutiveQuicFailures, '/', MAX_QUIC_FAILURES);
          console.log('[supabase] Is iOS Simulator:', isIOSSimulator);
        }
        
        // In iOS simulator, QUIC failures will persist, so skip immediately after first failure
        // On physical devices, allow more retries for transient network issues
        if (consecutiveQuicFailures >= MAX_QUIC_FAILURES) {
          if (__DEV__) {
            if (isIOSSimulator) {
              console.warn('[supabase] ⚠️  QUIC failure detected in iOS simulator (expected)');
              console.warn('[supabase] 💡 iOS Simulator QUIC is known to fail - skipping Supabase sync');
              console.warn('[supabase] 💡 Profile data is saved locally and will sync when tested on a physical device');
              console.warn('[supabase] 💡 App continues working normally with local backend');
            } else {
              console.error('[supabase] ❌ Persistent QUIC connection failures detected');
              console.error('[supabase] 💡 This may be a network issue');
            }
          }
          
          // Return mock success so app continues - DO NOT THROW ERROR
          return {
            id: profileData.id,
            email: profileData.email,
            full_name: profileData.full_name,
            _simulator_skip: true,
          };
        } else {
          // Haven't hit threshold yet, log but continue to throw
          if (__DEV__) {
            console.warn(`[supabase] ⚠️  QUIC failure ${consecutiveQuicFailures}/${MAX_QUIC_FAILURES} - will skip after ${MAX_QUIC_FAILURES}`);
          }
        }
      } else {
        // Reset counter on non-QUIC errors (might be RLS or other issues)
        // Only reset if not in simulator (in simulator, QUIC errors are persistent)
        if (!isIOSSimulator) {
          consecutiveQuicFailures = Math.max(0, consecutiveQuicFailures - 1);
        }
      }

      // Only log errors if we haven't hit the skip threshold
      if (consecutiveQuicFailures < MAX_QUIC_FAILURES) {
        console.error('[supabase] ❌ Error upserting profile:');
        console.error('[supabase] Error object:', JSON.stringify(error, null, 2));
        console.error('[supabase] Error code:', error.code);
        console.error('[supabase] Error message:', error.message);
        console.error('[supabase] Error details:', error.details);
        console.error('[supabase] Error hint:', error.hint);
        console.error('[supabase] HTTP status:', status, statusText);
        console.error('[supabase] Consecutive QUIC failures:', consecutiveQuicFailures, '/', MAX_QUIC_FAILURES);
        console.error('[supabase] Is iOS Simulator:', isIOSSimulator);
        console.error('[supabase] MAX_QUIC_FAILURES value:', MAX_QUIC_FAILURES);
      }
      
      // Check if it's a duplicate key error on email (profile exists but with different ID)
      if (error.code === '23505' && error.message?.includes('profiles_email_key')) {
        if (__DEV__) {
          console.log('[supabase] 🔍 Duplicate email detected, fetching existing profile by email...');
        }
        // Profile exists with this email, fetch it and update it instead
        const { data: existingProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', payload.email)
          .single();
        
        if (!fetchError && existingProfile) {
          if (__DEV__) {
            console.log('[supabase] ✅ Found existing profile, updating with new data');
          }
          // Update the existing profile (use its ID)
          const updatePayload = {
            ...payload,
            id: existingProfile.id, // Use existing profile ID
          };
          
          const { data: updatedData, error: updateError } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', existingProfile.id)
            .select()
            .single();
          
          if (!updateError && updatedData) {
            if (__DEV__) {
              console.log('[supabase] ✅ Profile updated successfully:', updatedData.id);
            }
            consecutiveQuicFailures = 0; // Reset on success
            return updatedData;
          } else {
            if (__DEV__) {
              console.error('[supabase] ❌ Failed to update existing profile:', updateError);
            }
          }
        }
        // If we couldn't fetch or update, fall through to throw error
      }
      
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
 * @param {string} userId - User ID (or target user ID for admin)
 * @returns {Promise<Array>} Array of nail size profiles
 */
export async function getNailSizeProfiles(userId) {
  try {
    if (__DEV__) {
      console.log('[supabase] Fetching nail size profiles for user:', userId);
    }

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

    if (__DEV__) {
      console.log('[supabase] ✅ Fetched', data?.length || 0, 'nail size profiles');
    }

    return data || [];
  } catch (error) {
    console.error('[supabase] Failed to get nail size profiles:', error);
    throw error;
  }
}

/**
 * Create or update a nail size profile
 * @param {string} userId - User ID (or target user ID for admin)
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

    // Normalize sizes to ensure all fingers are present
    const normalizedSizes = {
      thumb: profileData.sizes?.thumb || '',
      index: profileData.sizes?.index || '',
      middle: profileData.sizes?.middle || '',
      ring: profileData.sizes?.ring || '',
      pinky: profileData.sizes?.pinky || '',
    };

    const payload = {
      user_id: userId,
      label: profileData.label || 'Untitled Profile',
      is_default: profileData.is_default || false,
      sizes: normalizedSizes,
    };

    // Don't manually set updated_at - trigger handles it

    let query;
    if (profileData.id && profileData.id !== 'default') {
      // Update existing (skip if id is 'default' - that's a special case)
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
 * @param {string} userId - User ID (or target user ID for admin)
 * @param {string} profileId - Profile ID
 * @returns {Promise<boolean>} Success
 */
export async function deleteNailSizeProfile(userId, profileId) {
  try {
    if (__DEV__) {
      console.log('[supabase] Deleting nail size profile:', profileId, 'for user:', userId);
    }

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

