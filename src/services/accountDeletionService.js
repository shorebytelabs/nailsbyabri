/**
 * Account Deletion Service
 * 
 * Handles account deletion in compliance with Apple App Store guidelines.
 * Anonymizes personal data while preserving transactional records for tax purposes.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Delete the current user's account
 * 
 * This function:
 * - Anonymizes personal information (name, email, phone, addresses)
 * - Preserves transactional data (orders, pricing) for tax purposes
 * - Deletes user-specific data (nail sizes, preferences, consent logs)
 * - Removes the authentication account
 * 
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails or user is not authenticated
 */
export async function deleteAccount() {
  try {
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id;

    if (__DEV__) {
      console.log('[accountDeletion] Starting account deletion for user:', userId);
    }

    // Call the database function to delete the account
    // The function handles all anonymization and deletion logic
    const { error: deleteError } = await supabase.rpc('delete_user_account', {
      p_user_id: userId,
    });

    if (deleteError) {
      // Check if error is due to RLS policy (user trying to delete another user's account)
      if (deleteError.code === '42501' || deleteError.message?.includes('permission') || deleteError.message?.includes('policy')) {
        throw new Error('You can only delete your own account.');
      }
      
      if (__DEV__) {
        console.error('[accountDeletion] ❌ Deletion error:', deleteError);
      }
      
      throw new Error(deleteError.message || 'Failed to delete account. Please contact support.');
    }

    // Sign out the user (this should happen automatically, but we do it explicitly)
    await supabase.auth.signOut();

    if (__DEV__) {
      console.log('[accountDeletion] ✅ Account deleted successfully');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[accountDeletion] ❌ Account deletion failed:', error.message);
    }
    throw error;
  }
}

/**
 * Check if account deletion is available
 * This can be used to verify the function exists and is accessible
 * 
 * @returns {Promise<boolean>}
 */
export async function isAccountDeletionAvailable() {
  try {
    // Try to check if the function exists by calling it with a null UUID
    // This will fail gracefully if the function doesn't exist
    const { error } = await supabase.rpc('delete_user_account', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    });

    // If we get a permission error or function exists error, the function exists
    // We expect an error since we're passing an invalid UUID
    return error?.code !== '42883'; // Function does not exist error code
  } catch (error) {
    return false;
  }
}

