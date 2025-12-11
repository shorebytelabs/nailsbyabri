/**
 * Tips Service
 * Handles CRUD operations for tips displayed on the home screen
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Get all enabled tips (for public display)
 * @returns {Promise<Array>} Array of enabled tips ordered by display_order
 */
export async function getEnabledTips() {
  try {
    // OPTIMIZATION: Explicitly select only needed fields to reduce cached egress
    const { data, error } = await supabase
      .from('tips')
      .select('id, title, description, image_url, youtube_url, display_order, enabled, created_at')
      .eq('enabled', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[tipsService] Error fetching enabled tips:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[tipsService] Error in getEnabledTips:', error);
    throw error;
  }
}

/**
 * Get all tips (admin only - includes disabled)
 * @returns {Promise<Array>} Array of all tips ordered by display_order
 */
export async function getAllTips() {
  try {
    // OPTIMIZATION: Explicitly select only needed fields to reduce cached egress
    const { data, error } = await supabase
      .from('tips')
      .select('id, title, description, image_url, image_path, youtube_url, display_order, enabled, created_by_admin_id, created_at, updated_at')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[tipsService] Error fetching all tips:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[tipsService] Error in getAllTips:', error);
    throw error;
  }
}

/**
 * Create a new tip
 * @param {Object} tipData - Tip data { title, description, image_url, image_path, youtube_url, display_order }
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Created tip
 */
export async function createTip(tipData, adminId) {
  try {
    const { data, error } = await supabase
      .from('tips')
      .insert({
        title: tipData.title,
        description: tipData.description,
        image_url: tipData.image_url || null,
        image_path: tipData.image_path || null,
        youtube_url: tipData.youtube_url || null,
        enabled: tipData.enabled !== false, // Default to true
        display_order: tipData.display_order || 0,
        created_by_admin_id: adminId,
      })
      .select()
      .single();

    if (error) {
      console.error('[tipsService] Error creating tip:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[tipsService] Error in createTip:', error);
    throw error;
  }
}

/**
 * Update an existing tip
 * @param {string} tipId - Tip ID
 * @param {Object} tipData - Updated tip data
 * @returns {Promise<Object>} Updated tip
 */
export async function updateTip(tipId, tipData) {
  try {
    const updateData = {};
    if (tipData.title !== undefined) updateData.title = tipData.title;
    if (tipData.description !== undefined) updateData.description = tipData.description;
    if (tipData.image_url !== undefined) updateData.image_url = tipData.image_url;
    if (tipData.image_path !== undefined) updateData.image_path = tipData.image_path;
    if (tipData.youtube_url !== undefined) updateData.youtube_url = tipData.youtube_url;
    if (tipData.enabled !== undefined) updateData.enabled = tipData.enabled;
    if (tipData.display_order !== undefined) updateData.display_order = tipData.display_order;

    const { data, error } = await supabase
      .from('tips')
      .update(updateData)
      .eq('id', tipId)
      .select()
      .single();

    if (error) {
      console.error('[tipsService] Error updating tip:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[tipsService] Error in updateTip:', error);
    throw error;
  }
}

/**
 * Delete a tip
 * @param {string} tipId - Tip ID
 * @returns {Promise<void>}
 */
export async function deleteTip(tipId) {
  try {
    const { error } = await supabase
      .from('tips')
      .delete()
      .eq('id', tipId);

    if (error) {
      console.error('[tipsService] Error deleting tip:', error);
      throw error;
    }
  } catch (error) {
    console.error('[tipsService] Error in deleteTip:', error);
    throw error;
  }
}

/**
 * Toggle tip enabled status
 * @param {string} tipId - Tip ID
 * @param {boolean} enabled - New enabled status
 * @returns {Promise<Object>} Updated tip
 */
export async function toggleTipEnabled(tipId, enabled) {
  try {
    const { data, error } = await supabase
      .from('tips')
      .update({ enabled })
      .eq('id', tipId)
      .select()
      .single();

    if (error) {
      console.error('[tipsService] Error toggling tip enabled:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[tipsService] Error in toggleTipEnabled:', error);
    throw error;
  }
}

