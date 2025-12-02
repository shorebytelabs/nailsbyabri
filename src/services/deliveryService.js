/**
 * Delivery Service
 * Handles fetching and managing delivery methods and tiers from Supabase
 */
import { supabase } from '../lib/supabaseClient';

/**
 * Get all visible delivery methods with their visible tiers for customers
 * @returns {Promise<Object>} Object with delivery methods and their tiers
 */
export async function getVisibleDeliveryMethods() {
  try {
    // Fetch visible methods
    const { data: methods, error: methodsError } = await supabase
      .from('delivery_methods')
      .select('*')
      .eq('is_visible', true)
      .order('display_order', { ascending: true });

    if (methodsError) {
      throw methodsError;
    }

    if (!methods || methods.length === 0) {
      return {};
    }

    // Fetch visible tiers for these methods
    const methodIds = methods.map((m) => m.id);
    const { data: tiers, error: tiersError } = await supabase
      .from('delivery_tiers')
      .select('*')
      .in('delivery_method_id', methodIds)
      .eq('is_visible', true)
      .order('display_order', { ascending: true });

    if (tiersError) {
      throw tiersError;
    }

    // Group tiers by method and transform to expected format
    const result = {};
    methods.forEach((method) => {
      const methodTiers = (tiers || []).filter((t) => t.delivery_method_id === method.id);
      
      if (methodTiers.length > 0) {
        const speedOptions = {};
        methodTiers.forEach((tier) => {
          speedOptions[tier.name] = {
            id: tier.name,
            label: tier.display_name,
            description: tier.description || '',
            fee: Number(tier.price),
            days: tier.days,
            tagline: tier.tagline || '',
          };
        });

        result[method.name] = {
          id: method.name,
          label: method.display_name,
          description: method.description || '',
          baseFee: 0,
          speedOptions,
          defaultSpeed: methodTiers.find((t) => t.is_default)?.name || methodTiers[0]?.name || 'standard',
        };
      }
    });

    return result;
  } catch (error) {
    console.error('[deliveryService] Error fetching visible delivery methods:', error);
    // Fallback to default methods if database fails
    return {
      pickup: {
        id: 'pickup',
        label: 'Pick Up',
        description: 'Ready in 10 to 14 days in 92127',
        baseFee: 0,
        speedOptions: {
          standard: { id: 'standard', label: 'Standard', description: '10 to 14 days', fee: 0, days: 14, tagline: 'Included' },
          priority: { id: 'priority', label: 'Priority', description: '3 to 5 days', fee: 5, days: 5, tagline: 'Get your nails faster!' },
          rush: { id: 'rush', label: 'Rush', description: 'Next day', fee: 10, days: 1, tagline: 'Fast-track your order!' },
        },
        defaultSpeed: 'standard',
      },
      delivery: {
        id: 'delivery',
        label: 'Local Delivery',
        description: 'Ready in 10 to 14 days in 92127',
        baseFee: 0,
        speedOptions: {
          standard: { id: 'standard', label: 'Standard', description: '10 to 14 days', fee: 5, days: 14, tagline: 'Included' },
          priority: { id: 'priority', label: 'Priority', description: '3 to 5 days', fee: 10, days: 5, tagline: 'Get your nails faster!' },
          rush: { id: 'rush', label: 'Rush', description: 'Next day', fee: 15, days: 1, tagline: 'Fast-track your order!' },
        },
        defaultSpeed: 'standard',
      },
      shipping: {
        id: 'shipping',
        label: 'Shipping',
        description: 'Ready to ship in 10 to 14 days',
        baseFee: 0,
        speedOptions: {
          standard: { id: 'standard', label: 'Standard', description: '10 to 14 days', fee: 7, days: 14, tagline: 'Included' },
          priority: { id: 'priority', label: 'Priority', description: '3 to 5 days', fee: 15, days: 5, tagline: 'Get your nails faster!' },
          rush: { id: 'rush', label: 'Rush', description: 'Next day', fee: 20, days: 1, tagline: 'Fast-track your order!' },
        },
        defaultSpeed: 'standard',
      },
    };
  }
}

/**
 * Get all delivery methods (admin only - includes hidden methods)
 * @returns {Promise<Array>} Array of all delivery methods with their tiers
 */
export async function getAllDeliveryMethods() {
  try {
    const { data: methods, error: methodsError } = await supabase
      .from('delivery_methods')
      .select('*')
      .order('display_order', { ascending: true });

    if (methodsError) {
      throw methodsError;
    }

    if (!methods || methods.length === 0) {
      return [];
    }

    // Fetch all tiers for these methods
    const methodIds = methods.map((m) => m.id);
    const { data: tiers, error: tiersError } = await supabase
      .from('delivery_tiers')
      .select('*')
      .in('delivery_method_id', methodIds)
      .order('display_order', { ascending: true });

    if (tiersError) {
      throw tiersError;
    }

    // Group tiers by method
    return methods.map((method) => ({
      ...method,
      tiers: (tiers || []).filter((t) => t.delivery_method_id === method.id),
    }));
  } catch (error) {
    console.error('[deliveryService] Error fetching all delivery methods:', error);
    throw error;
  }
}

/**
 * Create a new delivery method (admin only)
 * @param {Object} methodData - Method data
 * @returns {Promise<Object>} Created method
 */
export async function createDeliveryMethod(methodData) {
  try {
    const { data, error } = await supabase
      .from('delivery_methods')
      .insert({
        name: methodData.name,
        display_name: methodData.display_name || methodData.name,
        description: methodData.description || null,
        is_visible: methodData.is_visible !== undefined ? methodData.is_visible : true,
        display_order: Number(methodData.display_order) || 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[deliveryService] Error creating delivery method:', error);
    throw error;
  }
}

/**
 * Update a delivery method (admin only)
 * @param {string} methodId - Method ID (name)
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated method
 */
export async function updateDeliveryMethod(methodId, updates) {
  try {
    const updateData = {};
    if (updates.display_name !== undefined) updateData.display_name = updates.display_name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.is_visible !== undefined) updateData.is_visible = updates.is_visible;
    if (updates.display_order !== undefined) updateData.display_order = Number(updates.display_order);

    const { data, error } = await supabase
      .from('delivery_methods')
      .update(updateData)
      .eq('name', methodId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[deliveryService] Error updating delivery method:', error);
    throw error;
  }
}

/**
 * Delete a delivery method (admin only - will cascade delete tiers)
 * @param {string} methodId - Method ID (name)
 * @returns {Promise<void>}
 */
export async function deleteDeliveryMethod(methodId) {
  try {
    const { error } = await supabase
      .from('delivery_methods')
      .delete()
      .eq('name', methodId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('[deliveryService] Error deleting delivery method:', error);
    throw error;
  }
}

/**
 * Create a new delivery tier (admin only)
 * @param {Object} tierData - Tier data
 * @returns {Promise<Object>} Created tier
 */
export async function createDeliveryTier(tierData) {
  try {
    // Get method ID from name
    const { data: method, error: methodError } = await supabase
      .from('delivery_methods')
      .select('id')
      .eq('name', tierData.delivery_method_name)
      .single();

    if (methodError || !method) {
      throw new Error('Delivery method not found');
    }

    // If this is set as default, unset other defaults for this method
    if (tierData.is_default) {
      await supabase
        .from('delivery_tiers')
        .update({ is_default: false })
        .eq('delivery_method_id', method.id);
    }

    const { data, error } = await supabase
      .from('delivery_tiers')
      .insert({
        delivery_method_id: method.id,
        name: tierData.name,
        display_name: tierData.display_name || tierData.name,
        description: tierData.description || null,
        tagline: tierData.tagline || null,
        price: Number(tierData.price) || 0,
        days: Number(tierData.days) || 14,
        is_visible: tierData.is_visible !== undefined ? tierData.is_visible : true,
        is_default: tierData.is_default || false,
        display_order: Number(tierData.display_order) || 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[deliveryService] Error creating delivery tier:', error);
    throw error;
  }
}

/**
 * Update a delivery tier (admin only)
 * @param {string} tierId - Tier ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated tier
 */
export async function updateDeliveryTier(tierId, updates) {
  try {
    const updateData = {};
    if (updates.display_name !== undefined) updateData.display_name = updates.display_name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.tagline !== undefined) updateData.tagline = updates.tagline;
    if (updates.price !== undefined) updateData.price = Number(updates.price);
    if (updates.days !== undefined) updateData.days = Number(updates.days);
    if (updates.is_visible !== undefined) updateData.is_visible = updates.is_visible;
    if (updates.display_order !== undefined) updateData.display_order = Number(updates.display_order);

    // If setting as default, unset other defaults for the same method
    if (updates.is_default === true) {
      const { data: tier } = await supabase
        .from('delivery_tiers')
        .select('delivery_method_id')
        .eq('id', tierId)
        .single();

      if (tier) {
        await supabase
          .from('delivery_tiers')
          .update({ is_default: false })
          .eq('delivery_method_id', tier.delivery_method_id)
          .neq('id', tierId);
      }
      updateData.is_default = true;
    } else if (updates.is_default === false) {
      updateData.is_default = false;
    }

    const { data, error } = await supabase
      .from('delivery_tiers')
      .update(updateData)
      .eq('id', tierId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[deliveryService] Error updating delivery tier:', error);
    throw error;
  }
}

/**
 * Delete a delivery tier (admin only)
 * @param {string} tierId - Tier ID
 * @returns {Promise<void>}
 */
export async function deleteDeliveryTier(tierId) {
  try {
    const { error } = await supabase
      .from('delivery_tiers')
      .delete()
      .eq('id', tierId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('[deliveryService] Error deleting delivery tier:', error);
    throw error;
  }
}

