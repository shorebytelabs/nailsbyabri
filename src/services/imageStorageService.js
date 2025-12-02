/**
 * Image Storage Service
 * Handles uploading images to Supabase Storage for orders
 */

import { supabase } from '../lib/supabaseClient';
import { SUPABASE_URL } from '../config/env';

const STORAGE_BUCKET = 'order-images';

/**
 * Upload an image file to Supabase Storage
 * @param {Object} file - File object with { uri, type, fileName }
 * @param {string} userId - User ID (required)
 * @param {string} orderId - Order ID (required)
 * @param {string} setId - Set ID (optional)
 * @param {string} imageType - 'design', 'sizing', or 'admin'
 * @returns {Promise<{url: string, path: string, fileName: string}>} Public URL and storage path
 */
export async function uploadImageToStorage(file, userId, orderId, setId = null, imageType = 'design') {
  try {
    if (!file.uri) {
      throw new Error('File URI is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    // Get session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    // Generate unique filename
    const fileExt = file.fileName?.split('.').pop() || file.type?.split('/')[1] || 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}_${randomId}.${fileExt}`;
    
    // Build storage path: order-images/{userId}/{orderId}/{setId}/{imageType}/{fileName}
    const pathParts = [userId, orderId];
    if (setId) {
      pathParts.push(setId);
    }
    pathParts.push(imageType);
    pathParts.push(fileName);
    const filePath = pathParts.join('/');

    // Create FormData for React Native
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type || 'image/jpeg',
      name: fileName,
    });

    // Upload using Supabase Storage REST API
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        // Don't set Content-Type - let FormData set it with boundary
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      let errorMessage = 'Upload failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get image URL from storage.');
    }

    return {
      url: urlData.publicUrl,
      path: filePath,
      fileName: fileName,
    };
  } catch (error) {
    console.error('[imageStorageService] Error uploading image:', error);
    throw error;
  }
}

/**
 * Delete an image from Supabase Storage
 * @param {string} filePath - Storage path of the file to delete
 * @returns {Promise<void>}
 */
export async function deleteImageFromStorage(filePath) {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('[imageStorageService] Error deleting image:', error);
      throw error;
    }
  } catch (error) {
    console.error('[imageStorageService] Error deleting image:', error);
    throw error;
  }
}

/**
 * Upload a shape image to Supabase Storage
 * @param {string} uri - File URI from image picker
 * @param {string} bucket - Storage bucket name
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadShapeImage(uri, bucket) {
  try {
    if (!uri) {
      throw new Error('File URI is required');
    }

    // Get session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `shape_${timestamp}_${randomId}.jpg`;
    const filePath = `shapes/${fileName}`;

    // Create FormData for React Native
    const formData = new FormData();
    formData.append('file', {
      uri: uri,
      type: 'image/jpeg',
      name: fileName,
    });

    // Upload using Supabase Storage REST API
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        // Don't set Content-Type - let FormData set it with boundary
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      let errorMessage = 'Upload failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get image URL from storage.');
    }

    return urlData.publicUrl;
  } catch (error) {
    console.error('[imageStorageService] Error uploading shape image:', error);
    throw error;
  }
}

/**
 * Extract storage path from a public URL
 * @param {string} url - Public Supabase Storage URL
 * @returns {string|null} Storage path or null if invalid
 */
export function extractStoragePathFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // URL format: https://[project].supabase.co/storage/v1/object/public/order-images/[path]
  const match = url.match(/\/order-images\/(.+)$/);
  return match ? match[1] : null;
}

