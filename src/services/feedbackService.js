/**
 * Feedback Service
 * Handles customer feedback/reviews for completed orders
 */
import { supabase } from '../lib/supabaseClient';
import { uploadImageToStorage } from './imageStorageService';

/**
 * Submit feedback for an order
 * @param {string} orderId - Order ID
 * @param {number} rating - Rating (1-5)
 * @param {string} comment - Optional comment (max 500 chars)
 * @param {Array<string>} imageUrls - Optional array of image URLs (already uploaded)
 * @returns {Promise<Object>} Created feedback object
 */
export async function submitFeedback(orderId, rating, comment = null, imageUrls = []) {
  try {
    if (!orderId) {
      throw new Error('Order ID is required');
    }
    if (!rating || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    if (comment && comment.length > 500) {
      throw new Error('Comment must be 500 characters or less');
    }

    // Get authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    const userId = session.user.id;

    // Check if feedback already exists for this order
    const { data: existingFeedback } = await supabase
      .from('feedback')
      .select('id')
      .eq('order_id', orderId)
      .single();

    // Normalize imageUrls to array
    const imageUrlsArray = Array.isArray(imageUrls) ? imageUrls.filter(url => url && url.trim()) : [];

    if (existingFeedback) {
      // Update existing feedback
      const { data, error } = await supabase
        .from('feedback')
        .update({
          rating,
          comment: comment?.trim() || null,
          image_urls: imageUrlsArray.length > 0 ? imageUrlsArray : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingFeedback.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Don't update order status - it should already be "Completed"
      // Status remains "Completed" regardless of feedback submission

      return data;
    }

    // Create new feedback
    const { data, error } = await supabase
      .from('feedback')
      .insert({
        order_id: orderId,
        user_id: userId,
        rating,
        comment: comment?.trim() || null,
        image_urls: imageUrlsArray.length > 0 ? imageUrlsArray : null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update order status to "Completed"
    await supabase
      .from('orders')
      .update({ status: 'Completed' })
      .eq('id', orderId);

    // Update order status to "Completed"
    await supabase
      .from('orders')
      .update({ status: 'Completed' })
      .eq('id', orderId);

    return data;
  } catch (error) {
    console.error('[feedbackService] Error submitting feedback:', error);
    throw error;
  }
}

/**
 * Upload feedback images to Supabase Storage
 * @param {Array<Object>} images - Array of image objects with { uri, type, fileName }
 * @param {string} userId - User ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Array<string>>} Array of uploaded image URLs
 */
export async function uploadFeedbackImages(images, userId, orderId) {
  try {
    if (!Array.isArray(images) || images.length === 0) {
      return [];
    }

    if (!userId || !orderId) {
      throw new Error('User ID and Order ID are required');
    }

    const uploadPromises = images.map(async (image) => {
      if (!image.uri) {
        return null;
      }

      try {
        const uploadResult = await uploadImageToStorage(
          {
            uri: image.uri,
            type: image.type || 'image/jpeg',
            fileName: image.fileName || `feedback-${Date.now()}.jpg`,
          },
          userId,
          orderId,
          null, // No setId for feedback images
          'feedback', // imageType
        );

        return uploadResult.url;
      } catch (error) {
        console.error('[feedbackService] Error uploading feedback image:', error);
        throw error;
      }
    });

    const uploadedUrls = await Promise.all(uploadPromises);
    return uploadedUrls.filter(url => url !== null);
  } catch (error) {
    console.error('[feedbackService] Error uploading feedback images:', error);
    throw error;
  }
}

/**
 * Get feedback for a specific order
 * @param {string} orderId - Order ID
 * @returns {Promise<Object|null>} Feedback object or null
 */
export async function getFeedbackByOrderId(orderId) {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[feedbackService] Error fetching feedback:', error);
    throw error;
  }
}

/**
 * Get all feedback (admin only)
 * @returns {Promise<Array>} Array of feedback entries with order and user info
 */
export async function getAllFeedback() {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select(`
        *,
        orders (
          id
        ),
        profiles (
          id,
          full_name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[feedbackService] Error fetching all feedback:', error);
    throw error;
  }
}

/**
 * Check if an order has pending feedback
 * @param {string} orderId - Order ID
 * @returns {Promise<boolean>} True if feedback is pending
 */
export async function hasPendingFeedback(orderId) {
  try {
    const feedback = await getFeedbackByOrderId(orderId);
    return !feedback;
  } catch (error) {
    console.error('[feedbackService] Error checking pending feedback:', error);
    return false;
  }
}

