/**
 * Shapes Service
 * Handles fetching and managing nail shapes from Supabase
 */
import { supabase } from '../lib/supabaseClient';

/**
 * Get all visible shapes for customers
 * @returns {Promise<Array>} Array of visible shapes
 */
export async function getVisibleShapes() {
  try {
    const { data, error } = await supabase
      .from('nail_shapes')
      .select('*')
      .eq('is_visible', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    // Transform to match expected format
    return (data || []).map((shape) => ({
      id: shape.name, // Use name as ID for backward compatibility
      name: shape.display_name,
      imageUrl: shape.image_url || null,
      basePrice: Number(shape.base_price) + Number(shape.price_adjustment || 0),
    }));
  } catch (error) {
    console.error('[shapesService] Error fetching visible shapes:', error);
    // Fallback to default shapes if database fails
    return [
      { id: 'almond', name: 'Almond', imageUrl: null, basePrice: 10 },
      { id: 'square', name: 'Square', imageUrl: null, basePrice: 10 },
    ];
  }
}

/**
 * Get all shapes (admin only - includes hidden shapes)
 * @returns {Promise<Array>} Array of all shapes
 */
export async function getAllShapes() {
  try {
    const { data, error } = await supabase
      .from('nail_shapes')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[shapesService] Error fetching all shapes:', error);
    throw error;
  }
}

/**
 * Get shape by ID (name)
 * @param {string} shapeId - Shape ID (name)
 * @returns {Promise<Object|null>} Shape object or null
 */
export async function getShapeById(shapeId) {
  try {
    const { data, error } = await supabase
      .from('nail_shapes')
      .select('*')
      .eq('name', shapeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[shapesService] Error fetching shape by ID:', error);
    return null;
  }
}

/**
 * Create a new shape (admin only)
 * @param {Object} shapeData - Shape data
 * @returns {Promise<Object>} Created shape
 */
export async function createShape(shapeData) {
  try {
    const { data, error } = await supabase
      .from('nail_shapes')
      .insert({
        name: shapeData.name,
        display_name: shapeData.display_name || shapeData.name,
        image_url: shapeData.image_url || null,
        base_price: Number(shapeData.base_price) || 10,
        price_adjustment: Number(shapeData.price_adjustment) || 0,
        is_visible: shapeData.is_visible !== undefined ? shapeData.is_visible : true,
        display_order: Number(shapeData.display_order) || 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[shapesService] Error creating shape:', error);
    throw error;
  }
}

/**
 * Update a shape (admin only)
 * @param {string} shapeId - Shape ID (name)
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated shape
 */
export async function updateShape(shapeId, updates) {
  try {
    const updateData = {};
    if (updates.display_name !== undefined) updateData.display_name = updates.display_name;
    if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
    if (updates.base_price !== undefined) updateData.base_price = Number(updates.base_price);
    if (updates.price_adjustment !== undefined) updateData.price_adjustment = Number(updates.price_adjustment);
    if (updates.is_visible !== undefined) updateData.is_visible = updates.is_visible;
    if (updates.display_order !== undefined) updateData.display_order = Number(updates.display_order);

    const { data, error } = await supabase
      .from('nail_shapes')
      .update(updateData)
      .eq('name', shapeId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[shapesService] Error updating shape:', error);
    throw error;
  }
}

/**
 * Delete a shape (admin only)
 * @param {string} shapeId - Shape ID (name)
 * @returns {Promise<void>}
 */
export async function deleteShape(shapeId) {
  try {
    const { error } = await supabase
      .from('nail_shapes')
      .delete()
      .eq('name', shapeId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('[shapesService] Error deleting shape:', error);
    throw error;
  }
}

