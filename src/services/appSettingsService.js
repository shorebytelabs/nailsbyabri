/**
 * App Settings Service
 * Manages global application settings (like active theme) that apply to all users
 */
import { supabase } from '../lib/supabaseClient';

/**
 * Get the active theme ID
 * @returns {Promise<string>} The active theme ID (e.g., 'classicChristmas', 'modernMaroon')
 */
export async function getActiveTheme() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'active_theme')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Setting doesn't exist, return default
        if (__DEV__) {
          console.log('[appSettings] Active theme setting not found, using default');
        }
        return 'classicChristmas';
      }
      throw error;
    }

    // Parse JSONB value
    // Supabase JSONB values are returned as-is (string, number, object, etc.)
    let themeId;
    if (typeof data.value === 'string') {
      // If stored as JSON string like '"classicChristmas"', parse it
      try {
        const parsed = JSON.parse(data.value);
        themeId = typeof parsed === 'string' ? parsed : data.value;
      } catch {
        // If parsing fails, use as-is (might already be the theme ID string)
        themeId = data.value;
      }
    } else {
      // Already parsed, use directly
      themeId = data.value;
    }
    
    if (__DEV__) {
      console.log('[appSettings] ✅ Active theme loaded:', themeId);
    }
    return themeId;
  } catch (error) {
    console.error('[appSettings] ❌ Error getting active theme:', error);
    // Return default theme on error
    return 'classicChristmas';
  }
}

/**
 * Set the active theme ID (admin only)
 * @param {string} themeId - The theme ID to set as active
 * @param {string} adminUserId - The ID of the admin making the change
 * @returns {Promise<void>}
 */
export async function setActiveTheme(themeId, adminUserId) {
  try {
    if (__DEV__) {
      console.log('[appSettings] Setting active theme to:', themeId, 'by admin:', adminUserId);
    }

    // Verify admin user exists and has admin role
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', adminUserId)
      .single();

    if (profileError || !adminProfile) {
      console.error('[appSettings] ❌ Admin profile not found:', profileError);
      throw new Error('Admin profile not found. Please ensure you are logged in as an admin.');
    }

    if (adminProfile.role !== 'admin') {
      console.error('[appSettings] ❌ User is not an admin. Role:', adminProfile.role);
      throw new Error('You do not have admin permissions to change the theme.');
    }

    if (__DEV__) {
      console.log('[appSettings] ✅ Admin verified:', adminProfile.email, 'Role:', adminProfile.role);
    }

    // Try to update existing row
    const { data: updateData, error: updateError } = await supabase
      .from('app_settings')
      .update({
        value: themeId,
        updated_by_admin_id: adminUserId,
      })
      .eq('key', 'active_theme')
      .select();

    // If there's an RLS error, provide more helpful message
    if (updateError) {
      if (updateError.code === '42501') {
        console.error('[appSettings] ❌ RLS Policy Error - Admin role may not be recognized by RLS');
        console.error('[appSettings] Admin User ID:', adminUserId);
        console.error('[appSettings] Admin Email:', adminProfile.email);
        console.error('[appSettings] Admin Role:', adminProfile.role);
        throw new Error('Row-level security policy blocked the update. Please verify your admin role in the database and ensure RLS policies are correctly configured.');
      }
      console.error('[appSettings] ❌ Error updating active theme:', updateError);
      throw updateError;
    }

    // If update succeeded but returned 0 rows, the row doesn't exist - try insert
    if (!updateData || updateData.length === 0) {
      if (__DEV__) {
        console.log('[appSettings] No existing row found, attempting insert...');
      }
      
      const { error: insertError } = await supabase
        .from('app_settings')
        .insert({
          key: 'active_theme',
          value: themeId,
          updated_by_admin_id: adminUserId,
        });

      if (insertError) {
        if (insertError.code === '42501') {
          console.error('[appSettings] ❌ RLS Policy Error on INSERT');
          throw new Error('Row-level security policy blocked the insert. Please verify your admin role in the database.');
        }
        console.error('[appSettings] ❌ Error inserting active theme:', insertError);
        throw insertError;
      }
    }

    if (__DEV__) {
      console.log('[appSettings] ✅ Active theme updated successfully');
    }
  } catch (error) {
    console.error('[appSettings] ❌ Failed to set active theme:', error);
    throw error;
  }
}

/**
 * Subscribe to changes in app settings
 * Useful for real-time theme updates
 * @param {Function} callback - Callback function that receives the new theme ID
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveTheme(callback) {
  const subscription = supabase
    .channel('app_settings_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_settings',
        filter: 'key=eq.active_theme',
      },
      (payload) => {
        // Parse the theme ID from the JSONB value
        let newThemeId;
        const value = payload.new?.value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            newThemeId = typeof parsed === 'string' ? parsed : value;
          } catch {
            newThemeId = value;
          }
        } else {
          newThemeId = value;
        }
        
        if (__DEV__) {
          console.log('[appSettings] Theme changed via real-time:', newThemeId);
        }
        callback(newThemeId);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Get the active animation ID
 * @returns {Promise<string|null>} The active animation ID (e.g., 'snow', 'none') or null if not set
 */
export async function getActiveAnimation() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'active_animation')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Setting doesn't exist, return null (no animation)
        if (__DEV__) {
          console.log('[appSettings] Active animation setting not found, using none');
        }
        return null;
      }
      throw error;
    }

    // Parse JSONB value
    let animationId;
    if (typeof data.value === 'string') {
      try {
        const parsed = JSON.parse(data.value);
        animationId = typeof parsed === 'string' ? parsed : data.value;
      } catch {
        animationId = data.value;
      }
    } else {
      animationId = data.value;
    }
    
    if (__DEV__) {
      console.log('[appSettings] ✅ Active animation loaded:', animationId);
    }
    return animationId;
  } catch (error) {
    console.error('[appSettings] ❌ Error getting active animation:', error);
    // Return null (no animation) on error
    return null;
  }
}

/**
 * Set the active animation ID (admin only)
 * @param {string|null} animationId - The animation ID to set as active (or null/'none' to disable)
 * @param {string} adminUserId - The ID of the admin making the change
 * @returns {Promise<void>}
 */
export async function setActiveAnimation(animationId, adminUserId) {
  try {
    // Normalize: null or 'none' means no animation
    const normalizedId = !animationId || animationId === 'none' ? 'none' : animationId;
    
    if (__DEV__) {
      console.log('[appSettings] Setting active animation to:', normalizedId, 'by admin:', adminUserId);
    }

    // Verify admin user exists and has admin role
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', adminUserId)
      .single();

    if (profileError || !adminProfile) {
      console.error('[appSettings] ❌ Admin profile not found:', profileError);
      throw new Error('Admin profile not found. Please ensure you are logged in as an admin.');
    }

    if (adminProfile.role !== 'admin') {
      console.error('[appSettings] ❌ User is not an admin. Role:', adminProfile.role);
      throw new Error('You do not have admin permissions to change the animation.');
    }

    if (__DEV__) {
      console.log('[appSettings] ✅ Admin verified:', adminProfile.email, 'Role:', adminProfile.role);
    }

    // Try to update existing row
    const { data: updateData, error: updateError } = await supabase
      .from('app_settings')
      .update({
        value: normalizedId,
        updated_by_admin_id: adminUserId,
      })
      .eq('key', 'active_animation')
      .select();

    // If there's an RLS error, provide more helpful message
    if (updateError) {
      if (updateError.code === '42501') {
        console.error('[appSettings] ❌ RLS Policy Error - Admin role may not be recognized by RLS');
        throw new Error('Row-level security policy blocked the update. Please verify your admin role in the database.');
      }
      console.error('[appSettings] ❌ Error updating active animation:', updateError);
      throw updateError;
    }

    // If update succeeded but returned 0 rows, the row doesn't exist - try insert
    if (!updateData || updateData.length === 0) {
      if (__DEV__) {
        console.log('[appSettings] No existing row found, attempting insert...');
      }
      
      const { error: insertError } = await supabase
        .from('app_settings')
        .insert({
          key: 'active_animation',
          value: normalizedId,
          updated_by_admin_id: adminUserId,
        });

      if (insertError) {
        if (insertError.code === '42501') {
          console.error('[appSettings] ❌ RLS Policy Error on INSERT');
          throw new Error('Row-level security policy blocked the insert. Please verify your admin role in the database.');
        }
        console.error('[appSettings] ❌ Error inserting active animation:', insertError);
        throw insertError;
      }
    } else if (__DEV__) {
      // Log the actual value that was saved
      console.log('[appSettings] ✅ Animation update confirmed. Saved value:', normalizedId);
      console.log('[appSettings] Update response:', updateData);
    }

    if (__DEV__) {
      console.log('[appSettings] ✅ Active animation updated successfully');
    }
  } catch (error) {
    console.error('[appSettings] ❌ Failed to set active animation:', error);
    throw error;
  }
}

/**
 * Subscribe to changes in active animation
 * @param {Function} callback - Callback function that receives the new animation ID
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveAnimation(callback) {
  const subscription = supabase
    .channel('app_settings_animation_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_settings',
        filter: 'key=eq.active_animation',
      },
      (payload) => {
        // Parse the animation ID from the JSONB value
        let newAnimationId;
        const value = payload.new?.value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            newAnimationId = typeof parsed === 'string' ? parsed : value;
          } catch {
            newAnimationId = value;
          }
        } else {
          newAnimationId = value;
        }
        
        // Normalize null to 'none'
        if (!newAnimationId || newAnimationId === 'none') {
          newAnimationId = 'none';
        }
        
        if (__DEV__) {
          console.log('[appSettings] Animation changed via real-time:', newAnimationId);
        }
        callback(newAnimationId);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Get the nail sizing mode ('camera' or 'manual')
 * @returns {Promise<string>} The sizing mode ('camera' or 'manual'), defaults to 'manual'
 */
export async function getNailSizingMode() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'nail_sizing_mode')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Setting doesn't exist, return default (manual for backward compatibility)
        if (__DEV__) {
          console.log('[appSettings] Nail sizing mode setting not found, using default: manual');
        }
        return 'manual';
      }
      throw error;
    }

    // Parse JSONB value
    let mode;
    if (typeof data.value === 'string') {
      try {
        const parsed = JSON.parse(data.value);
        mode = typeof parsed === 'string' ? parsed : data.value;
      } catch {
        mode = data.value;
      }
    } else {
      mode = data.value;
    }
    
    // Validate mode - must be 'camera' or 'manual'
    if (mode !== 'camera' && mode !== 'manual') {
      if (__DEV__) {
        console.warn('[appSettings] Invalid nail sizing mode, defaulting to manual:', mode);
      }
      return 'manual';
    }
    
    if (__DEV__) {
      console.log('[appSettings] ✅ Nail sizing mode loaded:', mode);
    }
    return mode;
  } catch (error) {
    console.error('[appSettings] ❌ Error getting nail sizing mode:', error);
    // Return default (manual) on error for backward compatibility
    return 'manual';
  }
}

/**
 * Set the nail sizing mode (admin only)
 * @param {string} mode - The sizing mode ('camera' or 'manual')
 * @param {string} adminUserId - The ID of the admin making the change
 * @returns {Promise<void>}
 */
export async function setNailSizingMode(mode, adminUserId) {
  try {
    // Validate mode
    if (mode !== 'camera' && mode !== 'manual') {
      throw new Error('Invalid nail sizing mode. Must be "camera" or "manual".');
    }
    
    if (__DEV__) {
      console.log('[appSettings] Setting nail sizing mode to:', mode, 'by admin:', adminUserId);
    }

    // Verify admin user exists and has admin role
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', adminUserId)
      .single();

    if (profileError || !adminProfile) {
      console.error('[appSettings] ❌ Admin profile not found:', profileError);
      throw new Error('Admin profile not found. Please ensure you are logged in as an admin.');
    }

    if (adminProfile.role !== 'admin') {
      console.error('[appSettings] ❌ User is not an admin. Role:', adminProfile.role);
      throw new Error('You do not have admin permissions to change the nail sizing mode.');
    }

    if (__DEV__) {
      console.log('[appSettings] ✅ Admin verified:', adminProfile.email, 'Role:', adminProfile.role);
    }

    // Try to update existing row
    const { data: updateData, error: updateError } = await supabase
      .from('app_settings')
      .update({
        value: mode,
        updated_by_admin_id: adminUserId,
      })
      .eq('key', 'nail_sizing_mode')
      .select();

    // If there's an RLS error, provide more helpful message
    if (updateError) {
      if (updateError.code === '42501') {
        console.error('[appSettings] ❌ RLS Policy Error - Admin role may not be recognized by RLS');
        throw new Error('Row-level security policy blocked the update. Please verify your admin role in the database.');
      }
      console.error('[appSettings] ❌ Error updating nail sizing mode:', updateError);
      throw updateError;
    }

    // If update succeeded but returned 0 rows, the row doesn't exist - try insert
    if (!updateData || updateData.length === 0) {
      if (__DEV__) {
        console.log('[appSettings] No existing row found, attempting insert...');
      }
      
      const { error: insertError } = await supabase
        .from('app_settings')
        .insert({
          key: 'nail_sizing_mode',
          value: mode,
          updated_by_admin_id: adminUserId,
        });

      if (insertError) {
        if (insertError.code === '42501') {
          console.error('[appSettings] ❌ RLS Policy Error on INSERT');
          throw new Error('Row-level security policy blocked the insert. Please verify your admin role in the database.');
        }
        console.error('[appSettings] ❌ Error inserting nail sizing mode:', insertError);
        throw insertError;
      }
    }

    if (__DEV__) {
      console.log('[appSettings] ✅ Nail sizing mode updated successfully');
    }
  } catch (error) {
    console.error('[appSettings] ❌ Failed to set nail sizing mode:', error);
    throw error;
  }
}

