/**
 * Address Service
 * 
 * Manages saved shipping addresses for users.
 * Addresses are stored in the profiles.saved_addresses JSONB column.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Get all saved addresses for the current user
 * @returns {Promise<Array>} Array of saved addresses
 */
export async function getSavedAddresses() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('saved_addresses')
      .eq('id', user.id)
      .single();

    if (error) {
      throw error;
    }

    // Return saved_addresses array or empty array if null
    const addresses = Array.isArray(profile?.saved_addresses) ? profile.saved_addresses : [];
    return addresses;
  } catch (error) {
    console.error('[addressService] Error fetching saved addresses:', error);
    throw error;
  }
}

/**
 * Add a new saved address for the current user
 * @param {Object} address - Address object with: label, name, line1, line2 (optional), city, state, postalCode, isDefault (optional)
 * @returns {Promise<Object>} The added address with id
 */
export async function addSavedAddress(address) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Validate required fields
    if (!address.name || !address.line1 || !address.city || !address.state || !address.postalCode) {
      throw new Error('Name, address line 1, city, state, and postal code are required');
    }

    // Get existing addresses
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('saved_addresses')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const existingAddresses = Array.isArray(profile?.saved_addresses) ? profile.saved_addresses : [];
    
    // Generate unique ID for the new address
    const newAddressId = `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create new address object
    const newAddress = {
      id: newAddressId,
      label: address.label || 'Home',
      name: address.name.trim(),
      line1: address.line1.trim(),
      line2: address.line2?.trim() || null,
      city: address.city.trim(),
      state: address.state.trim().toUpperCase(),
      postalCode: address.postalCode.trim(),
      isDefault: address.isDefault || false,
      createdAt: new Date().toISOString(),
    };

    // If this is marked as default, unset all other defaults
    let updatedAddresses;
    if (newAddress.isDefault) {
      updatedAddresses = existingAddresses.map(addr => ({ ...addr, isDefault: false }));
      updatedAddresses.push(newAddress);
    } else {
      updatedAddresses = [...existingAddresses, newAddress];
    }

    // Update profile with new addresses
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ saved_addresses: updatedAddresses })
      .eq('id', user.id)
      .select('saved_addresses')
      .single();

    if (updateError) {
      throw updateError;
    }

    return newAddress;
  } catch (error) {
    console.error('[addressService] Error adding saved address:', error);
    throw error;
  }
}

/**
 * Update an existing saved address
 * @param {string} addressId - ID of the address to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} The updated address
 */
export async function updateSavedAddress(addressId, updates) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get existing addresses
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('saved_addresses')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const existingAddresses = Array.isArray(profile?.saved_addresses) ? profile.saved_addresses : [];
    const addressIndex = existingAddresses.findIndex(addr => addr.id === addressId);

    if (addressIndex === -1) {
      throw new Error('Address not found');
    }

    // Update the address
    const updatedAddress = {
      ...existingAddresses[addressIndex],
      ...(updates.label !== undefined && { label: updates.label.trim() }),
      ...(updates.name !== undefined && { name: updates.name.trim() }),
      ...(updates.line1 !== undefined && { line1: updates.line1.trim() }),
      ...(updates.line2 !== undefined && { line2: updates.line2?.trim() || null }),
      ...(updates.city !== undefined && { city: updates.city.trim() }),
      ...(updates.state !== undefined && { state: updates.state.trim().toUpperCase() }),
      ...(updates.postalCode !== undefined && { postalCode: updates.postalCode.trim() }),
      ...(updates.isDefault !== undefined && { isDefault: updates.isDefault }),
      updatedAt: new Date().toISOString(),
    };

    // If this is marked as default, unset all other defaults
    let updatedAddresses;
    if (updates.isDefault) {
      updatedAddresses = existingAddresses.map((addr, index) => 
        index === addressIndex ? updatedAddress : { ...addr, isDefault: false }
      );
    } else {
      updatedAddresses = [...existingAddresses];
      updatedAddresses[addressIndex] = updatedAddress;
    }

    // Update profile with updated addresses
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ saved_addresses: updatedAddresses })
      .eq('id', user.id)
      .select('saved_addresses')
      .single();

    if (updateError) {
      throw updateError;
    }

    return updatedAddress;
  } catch (error) {
    console.error('[addressService] Error updating saved address:', error);
    throw error;
  }
}

/**
 * Delete a saved address
 * @param {string} addressId - ID of the address to delete
 * @returns {Promise<void>}
 */
export async function deleteSavedAddress(addressId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get existing addresses
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('saved_addresses')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const existingAddresses = Array.isArray(profile?.saved_addresses) ? profile.saved_addresses : [];
    const updatedAddresses = existingAddresses.filter(addr => addr.id !== addressId);

    // Update profile with remaining addresses
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ saved_addresses: updatedAddresses })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }
  } catch (error) {
    console.error('[addressService] Error deleting saved address:', error);
    throw error;
  }
}

/**
 * Set an address as the default address
 * @param {string} addressId - ID of the address to set as default
 * @returns {Promise<Object>} The updated address
 */
export async function setDefaultAddress(addressId) {
  return updateSavedAddress(addressId, { isDefault: true });
}

