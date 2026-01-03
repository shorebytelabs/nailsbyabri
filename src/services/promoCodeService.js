/**
 * Promo Code Service
 * Handles validation, application, and management of promotional codes
 * All validation is server-side for security
 */

import { supabase } from '../lib/supabaseClient';
import { calculatePriceBreakdown } from '../utils/pricing';

/**
 * Validate a promo code for the current cart/order
 * Returns validation result with discount details if valid
 * @param {string} code - Promo code to validate
 * @param {Object} orderData - Current order data (nailSets, fulfillment, etc.)
 * @param {string} userId - Current user ID (for per_user_limit checks)
 * @returns {Promise<Object>} Validation result
 */
export async function validatePromoCode(code, orderData = {}, userId = null) {
  try {
    if (!code || typeof code !== 'string') {
      return {
        valid: false,
        error: 'Promo code is required',
      };
    }

    const normalizedCode = code.trim().toUpperCase();

    // Fetch promo code from database
    const { data: promo, error: fetchError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    if (fetchError || !promo) {
      return {
        valid: false,
        error: 'Promo code not found or expired',
      };
    }

    // Check if promo is active
    if (!promo.active) {
      return {
        valid: false,
        error: 'Promo code not found or expired',
      };
    }

    // Check date range
    const now = new Date();
    if (promo.start_date && new Date(promo.start_date) > now) {
      return {
        valid: false,
        error: 'This promo code is not yet active',
      };
    }
    if (promo.end_date && new Date(promo.end_date) < now) {
      return {
        valid: false,
        error: 'Promo code not found or expired',
      };
    }

    // Calculate order subtotal for validation using actual pricing
    // First calculate the full price breakdown without promo code
    const priceBreakdown = await calculatePriceBreakdown({
      nailSets: orderData.nailSets || [],
      fulfillment: orderData.fulfillment || {},
      promoCode: null, // Don't include promo in initial calculation
      adminDiscount: 0,
    });
    // Get subtotal (includes shipping) for validation checks
    const subtotal = priceBreakdown.subtotal || 0;
    
    if (__DEV__) {
      console.log('[validatePromoCode] Price breakdown calculation:', {
        nailSetsCount: orderData.nailSets?.length || 0,
        fulfillment: orderData.fulfillment,
        subtotal,
        lineItemsCount: priceBreakdown.lineItems?.length || 0,
        promoType: promo.type,
        minOrderAmount: promo.min_order_amount,
      });
    }
    // Get subtotal before shipping for percentage/fixed amount calculations
    const subtotalBeforeShipping = priceBreakdown.lineItems
      ?.filter((item) => item.id !== 'delivery')
      .reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

    // Check minimum order amount
    if (promo.min_order_amount && subtotal < Number(promo.min_order_amount)) {
      return {
        valid: false,
        error: `Minimum order $${Number(promo.min_order_amount).toFixed(2)} required`,
      };
    }

    // Check max uses
    if (promo.max_uses && promo.uses_count >= promo.max_uses) {
      return {
        valid: false,
        error: 'This code has been used up',
      };
    }

    // Check per user limit
    if (userId && promo.per_user_limit) {
      const { count } = await supabase
        .from('promo_code_usage')
        .select('*', { count: 'exact', head: true })
        .eq('promo_code_id', promo.id)
        .eq('user_id', userId);

      if (count >= promo.per_user_limit) {
        return {
          valid: false,
          error: 'You have already used this promo code the maximum number of times',
        };
      }
    }

    // Calculate discount amount
    // Pass both subtotals: full (with shipping) for validation, before shipping for percentage calculations
    const discountResult = calculateDiscount(promo, subtotal, subtotalBeforeShipping, orderData);
    
    if (__DEV__) {
      console.log('[validatePromoCode] Discount calculation:', {
        promoType: promo.type,
        subtotal,
        subtotalBeforeShipping,
        calculatedDiscount: discountResult.discount,
        discountDescription: discountResult.description,
        newTotal: Math.max(0, subtotal - discountResult.discount),
      });
    }

    return {
      valid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        description: promo.description,
        type: promo.type,
        value: promo.value,
        combinable: promo.combinable,
      },
      discount: discountResult.discount,
      discountDescription: discountResult.description,
      subtotal,
      newTotal: Math.max(0, subtotal - discountResult.discount), // Ensure total doesn't go negative
    };
  } catch (error) {
    console.error('[promoCodeService] Error validating promo code:', error);
    return {
      valid: false,
      error: 'Unable to validate promo code. Please try again.',
    };
  }
}

/**
 * Calculate discount amount based on promo type
 * @param {Object} promo - Promo code object
 * @param {number} subtotalWithShipping - Order subtotal (including shipping) - for free_order validation
 * @param {number} subtotalBeforeShipping - Order subtotal (before shipping) - for percentage/fixed calculations
 * @param {Object} orderData - Order data
 * @returns {Object} Discount details
 */
function calculateDiscount(promo, subtotalWithShipping, subtotalBeforeShipping, orderData = {}) {
  let discount = 0;
  let description = '';

  switch (promo.type) {
    case 'percentage':
      // Apply percentage to subtotal (items + shipping) - this is more common for "X% off order"
      // If you want percentage to apply only to items, use subtotalBeforeShipping instead
      const percent = Number(promo.value) || 0;
      discount = Math.round(subtotalWithShipping * (percent / 100) * 100) / 100;
      description = `${percent}% off`;
      break;

    case 'fixed_amount':
      // Apply fixed amount to subtotal before shipping (but cap at total with shipping)
      discount = Math.min(Number(promo.value) || 0, subtotalWithShipping);
      description = `$${Number(promo.value).toFixed(2)} off`;
      break;

    case 'free_shipping':
      // Calculate shipping cost from orderData.fulfillment using actual pricing
      const priceBreakdown = calculatePriceBreakdown({
        nailSets: orderData.nailSets || [],
        fulfillment: orderData.fulfillment || {},
        promoCode: null,
        adminDiscount: 0,
      });
      // Find shipping line item (delivery includes shipping cost)
      const shippingItem = priceBreakdown.lineItems?.find((item) => item.id === 'delivery');
      const shippingCost = shippingItem?.amount || 0;
      // For free shipping, discount equals the shipping cost
      discount = shippingCost;
      description = 'Free shipping';
      break;

    case 'free_order':
      // Free order - discount the entire amount (including shipping)
      discount = subtotalWithShipping;
      description = 'Free order';
      break;

    case 'fixed_price_item':
      // For now, treat as fixed amount discount
      // Can be extended later for product-specific pricing
      discount = Math.min(Number(promo.value) || 0, subtotal);
      description = `$${Number(promo.value).toFixed(2)} off`;
      break;

    default:
      discount = 0;
      description = '';
  }

  return { discount, description };
}

// Removed calculateOrderSubtotal and calculateShippingCost - now using calculatePriceBreakdown directly

/**
 * Apply promo code to order (increment usage, create usage record)
 * This should be called when order is finalized
 * @param {string} promoCodeId - Promo code ID
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result
 */
export async function applyPromoCodeToOrder(promoCodeId, orderId, userId) {
  try {
    // Use a transaction-like approach with Supabase
    // First, check if we can still use it (race condition protection)
    const { data: promo, error: fetchError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('id', promoCodeId)
      .single();

    if (fetchError || !promo) {
      throw new Error('Promo code not found');
    }

    // Check max uses again (atomic check)
    if (promo.max_uses && promo.uses_count >= promo.max_uses) {
      throw new Error('Promo code has reached maximum uses');
    }

    // Increment uses_count atomically
    const { error: updateError } = await supabase
      .from('promo_codes')
      .update({
        uses_count: (promo.uses_count || 0) + 1,
      })
      .eq('id', promoCodeId)
      .eq('uses_count', promo.uses_count); // Optimistic locking

    if (updateError) {
      // Race condition - someone else used it
      throw new Error('Promo code usage limit reached');
    }

    // Create usage record
    if (userId) {
      await supabase.from('promo_code_usage').insert({
        promo_code_id: promoCodeId,
        user_id: userId,
        order_id: orderId,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[promoCodeService] Error applying promo code:', error);
    throw error;
  }
}

/**
 * Admin: Get all promo codes
 * @returns {Promise<Array>} List of promo codes
 */
export async function getAllPromoCodes() {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[promoCodeService] Error fetching promo codes:', error);
    throw error;
  }
}

/**
 * Admin: Create promo code
 * @param {Object} promoData - Promo code data
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Created promo code
 */
export async function createPromoCode(promoData, adminId) {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        ...promoData,
        code: (promoData.code || '').trim().toUpperCase(),
        created_by_admin_id: adminId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[promoCodeService] Error creating promo code:', error);
    throw error;
  }
}

/**
 * Admin: Update promo code
 * @param {string} promoId - Promo code ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated promo code
 */
export async function updatePromoCode(promoId, updates) {
  try {
    const updateData = { ...updates };
    if (updateData.code) {
      updateData.code = updateData.code.trim().toUpperCase();
    }

    const { data, error } = await supabase
      .from('promo_codes')
      .update(updateData)
      .eq('id', promoId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[promoCodeService] Error updating promo code:', error);
    throw error;
  }
}

/**
 * Admin: Toggle promo code active status
 * @param {string} promoId - Promo code ID
 * @param {boolean} active - New active status
 * @returns {Promise<Object>} Updated promo code
 */
export async function togglePromoCode(promoId, active) {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .update({ active })
      .eq('id', promoId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[promoCodeService] Error toggling promo code:', error);
    throw error;
  }
}

/**
 * Admin: Delete promo code
 * @param {string} promoId - Promo code ID
 * @returns {Promise<void>}
 */
export async function deletePromoCode(promoId) {
  try {
    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', promoId);

    if (error) throw error;
  } catch (error) {
    console.error('[promoCodeService] Error deleting promo code:', error);
    throw error;
  }
}

