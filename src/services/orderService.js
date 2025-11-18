/**
 * Order service for Supabase
 * Handles orders and order_sets (nail sets)
 */
import { supabase } from '../lib/supabaseClient';
import { calculatePriceBreakdown } from '../utils/pricing';

/**
 * Normalize nail sets for storage
 */
function normalizeNailSetForStorage(set) {
  return {
    name: typeof set.name === 'string' && set.name.trim() ? set.name.trim() : null,
    shape_id: set.shapeId,
    quantity: Math.max(1, Number(set.quantity) || 1),
    description: typeof set.description === 'string' ? set.description.trim() : '',
    set_notes: typeof set.setNotes === 'string' ? set.setNotes.trim() : '',
    design_uploads: Array.isArray(set.designUploads)
      ? set.designUploads
          .map((upload) => {
            if (!upload) return null;
            // Store as JSONB array
            return {
              id: upload.id || null,
              fileName: upload.fileName || null,
              data: upload.data || upload.base64 || upload.content || null,
            };
          })
          .filter(Boolean)
      : [],
    sizes: set.sizes || { mode: 'standard', values: {} },
    requires_follow_up: Boolean(set.requiresFollowUp),
  };
}

/**
 * Transform order set from database to app format
 */
function transformOrderSetFromDB(set) {
  return {
    id: set.id,
    name: set.name,
    shapeId: set.shape_id,
    quantity: set.quantity,
    description: set.description,
    setNotes: set.set_notes,
    designUploads: Array.isArray(set.design_uploads) ? set.design_uploads : [],
    sizes: set.sizes || { mode: 'standard', values: {} },
    requiresFollowUp: Boolean(set.requires_follow_up),
  };
}

/**
 * Transform order from database to app format
 */
function transformOrderFromDB(order, orderSets = []) {
  return {
    id: order.id,
    userId: order.user_id,
    status: order.status,
    nailSets: orderSets.map(transformOrderSetFromDB),
    fulfillment: order.fulfillment || { method: 'pickup', speed: 'standard', address: null },
    customerSizes: order.customer_sizes || { mode: 'standard', values: {} },
    orderNotes: order.order_notes || '',
    promoCode: order.promo_code,
    pricing: order.pricing,
    paymentIntentId: order.payment_intent_id,
    discount: order.discount || 0,
    trackingNumber: order.tracking_number || '',
    adminNotes: order.admin_notes,
    adminImages: Array.isArray(order.admin_images) ? order.admin_images : [],
    estimatedFulfillmentDate: order.estimated_fulfillment_date,
    paidAt: order.paid_at,
    productionJobs: Array.isArray(order.production_jobs) ? order.production_jobs : [],
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

/**
 * Create or update an order
 * @param {Object} orderData - Order data
 * @param {string} [orderData.id] - Order ID (for updates)
 * @param {string} orderData.userId - User ID
 * @param {Array} orderData.nailSets - Array of nail sets
 * @param {Object} orderData.fulfillment - Fulfillment options
 * @param {Object} orderData.customerSizes - Customer size preferences
 * @param {string} orderData.orderNotes - Order notes
 * @param {string} [orderData.promoCode] - Promo code
 * @param {string} [orderData.status] - Order status
 * @returns {Promise<Object>} Created/updated order
 */
export async function createOrUpdateOrder(orderData) {
  const startTime = Date.now();
  try {
    if (__DEV__) {
      console.log('[orders] Creating/updating order:', orderData.id || 'new');
    }

    // Get the authenticated user's ID from the session
    // RLS policies require auth.uid() = user_id, so they must match
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session. Please log in and try again.');
    }
    
    const authenticatedUserId = session.user.id;
    
    // Use the authenticated user's ID to ensure RLS policies pass
    // If orderData.userId is provided but doesn't match, we'll use the session ID
    let userId = orderData.userId;
    if (!userId) {
      userId = authenticatedUserId;
    } else if (userId !== authenticatedUserId) {
      if (__DEV__) {
        console.log('[orders] User ID mismatch detected, using authenticated user ID:', {
          providedUserId: userId,
          authenticatedUserId,
        });
      }
      userId = authenticatedUserId;
    }
    
    if (__DEV__) {
      console.log('[orders] Using user ID for order:', userId);
    }

    const { nailSets, fulfillment, customerSizes, orderNotes, promoCode, status } = orderData;

    // Normalize and validate nail sets
    const normalizedSets = Array.isArray(nailSets)
      ? nailSets.map(normalizeNailSetForStorage).filter((set) => set.shape_id)
      : [];

    if (!normalizedSets.length) {
      throw new Error('At least one nail set is required');
    }

    // Validate each set has design, description, or follow-up flag
    const missingDesign = normalizedSets.some(
      (set) =>
        (!set.design_uploads || set.design_uploads.length === 0) &&
        (!set.description || set.description.length === 0) &&
        !set.requires_follow_up,
    );

    if (missingDesign) {
      throw new Error('Each nail set must include a design upload, description, or be marked for follow-up');
    }

    // Calculate pricing (using frontend calculation)
    const pricing = calculatePriceBreakdown({
      nailSets,
      fulfillment,
      promoCode,
    });

    const now = new Date().toISOString();
    const isUpdate = !!orderData.id;

    // Prepare order payload
    const orderPayload = {
      user_id: userId,
      status: status || 'draft',
      customer_sizes: customerSizes || { mode: 'standard', values: {} },
      order_notes: typeof orderNotes === 'string' ? orderNotes.trim() : '',
      promo_code: promoCode || null,
      pricing,
      fulfillment: fulfillment || { method: 'pickup', speed: 'standard', address: null },
    };

    let order;
    let orderSets = [];

    if (isUpdate) {
      // Update existing order
      const updateStart = Date.now();
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update(orderPayload)
        .eq('id', orderData.id)
        .select()
        .single();

      if (__DEV__) {
        console.log(`[orders] ⏱️  Order update query: ${Date.now() - updateStart}ms`);
      }

      if (updateError) {
        throw updateError;
      }

      order = updatedOrder;

      // Delete existing order sets
      const deleteStart = Date.now();
      await supabase.from('order_sets').delete().eq('order_id', orderData.id);
      if (__DEV__) {
        console.log(`[orders] ⏱️  Order sets delete: ${Date.now() - deleteStart}ms`);
      }

      // Create new order sets
      const setsToInsert = normalizedSets.map((set) => ({
        order_id: order.id,
        ...set,
      }));

      const insertStart = Date.now();
      const { data: insertedSets, error: setsError } = await supabase
        .from('order_sets')
        .insert(setsToInsert)
        .select();

      if (__DEV__) {
        console.log(`[orders] ⏱️  Order sets insert: ${Date.now() - insertStart}ms (${setsToInsert.length} sets)`);
      }

      if (setsError) {
        throw setsError;
      }

      orderSets = insertedSets || [];
    } else {
      // Create new order
      const { data: newOrder, error: createError } = await supabase
        .from('orders')
        .insert({
          ...orderPayload,
          created_at: now,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      order = newOrder;

      // Create order sets
      const setsToInsert = normalizedSets.map((set) => ({
        order_id: order.id,
        ...set,
      }));

      const { data: insertedSets, error: setsError } = await supabase
        .from('order_sets')
        .insert(setsToInsert)
        .select();

      if (setsError) {
        // Rollback: delete the order if sets fail
        await supabase.from('orders').delete().eq('id', order.id);
        throw setsError;
      }

      orderSets = insertedSets || [];
    }

    // Fetch complete order with sets
    const completeOrder = transformOrderFromDB(order, orderSets);

    if (__DEV__) {
      const totalTime = Date.now() - startTime;
      console.log(`[orders] ✅ Order ${isUpdate ? 'updated' : 'created'} successfully: ${order.id} in ${totalTime}ms`);
    }

    return { order: completeOrder };
  } catch (error) {
    console.error('[orders] ❌ Failed to create/update order:', error);
    throw error;
  }
}

/**
 * Fetch a single order by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order data
 */
export async function fetchOrder(orderId) {
  try {
    if (__DEV__) {
      console.log('[orders] Fetching order:', orderId);
    }

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        throw new Error('Order not found');
      }
      throw orderError;
    }

    // Fetch order sets
    const { data: orderSets, error: setsError } = await supabase
      .from('order_sets')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (setsError) {
      throw setsError;
    }

    const transformed = transformOrderFromDB(order, orderSets || []);
    
    // Fetch user profile information
    if (order.user_id) {
      if (__DEV__) {
        console.log('[orders] Fetching profile for order:', orderId, 'user_id:', order.user_id);
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', order.user_id)
        .single();
      
      if (profileError) {
        if (__DEV__) {
          console.warn('[orders] ⚠️  Failed to fetch profile for order:', orderId, profileError);
        }
      } else if (profile) {
        if (__DEV__) {
          console.log('[orders] ✅ Profile found for order:', orderId, {
            profileName: profile.full_name,
            profileEmail: profile.email,
          });
        }
        
        transformed.user = {
          id: profile.id,
          name: profile.full_name || null,
          email: profile.email || null,
        };
        // Also add for backward compatibility
        transformed.userName = profile.full_name || null;
        transformed.userEmail = profile.email || null;
        transformed.customerName = profile.full_name || null;
      } else {
        if (__DEV__) {
          console.warn('[orders] ⚠️  No profile found for order:', orderId, 'user_id:', order.user_id);
        }
      }
    }

    if (__DEV__) {
      console.log('[orders] ✅ Order fetched successfully');
    }

    return { order: transformed };
  } catch (error) {
    console.error('[orders] ❌ Failed to fetch order:', error);
    throw error;
  }
}

/**
 * Fetch orders for a user (or all orders if admin)
 * @param {Object} [params] - Query parameters
 * @param {string} [params.userId] - User ID (if not provided, uses current session)
 * @param {boolean} [params.allOrders] - If true, fetch all orders (for admin)
 * @param {string} [params.status] - Filter by status
 * @returns {Promise<Array>} Array of orders
 */
export async function fetchOrders(params = {}) {
  const startTime = Date.now();
  try {
    if (__DEV__) {
      console.log('[orders] Fetching orders with params:', params);
    }

    // Get current session (should be instant - reads from AsyncStorage)
    const sessionStart = Date.now();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const sessionEnd = Date.now();
    const sessionTime = sessionEnd - sessionStart;
    const currentUserId = session?.user?.id;
    
    if (__DEV__) {
      console.log(`[orders] ⏱️  Session fetch: ${sessionTime}ms`);
      if (sessionTime > 100) {
        console.warn(`[orders] ⚠️  Session fetch is slow (${sessionTime}ms). Should be <10ms (reads from AsyncStorage).`);
        if (sessionError) {
          console.warn(`[orders] Session error:`, sessionError);
        }
      }
    }
    
    if (!session) {
      if (__DEV__) {
        console.warn('[orders] ⚠️  No session found');
      }
      return { orders: [] };
    }

    // Use PostgREST's automatic join syntax to fetch orders with profiles in one query
    // This requires a foreign key relationship between orders.user_id and profiles.id.
    // If the foreign key exists, this will be much faster than separate queries.
    // If it doesn't exist, we'll fall back to separate queries.
    // NOTE: We select all fields (*) which includes large JSONB fields like:
    // - customer_sizes (can be large if per-set sizing)
    // - pricing (usually small)
    // - fulfillment (usually small)
    // - production_jobs (can be large)
    // For list views, we might want to exclude these, but for now we fetch everything
    let query = supabase
      .from('orders')
      .select(`
        *,
        profile:profiles (
          id,
          full_name,
          email
        )
      `);

    // If the foreign key join doesn't work, fall back to manual join
    // Try using the relationship syntax first
    if (params.allOrders) {
      // Admin: fetch all orders (no user filter)
    } else if (params.userId) {
      // Specific user's orders
      query = query.eq('user_id', params.userId);
    } else if (currentUserId) {
      // Current user's orders
      query = query.eq('user_id', currentUserId);
    } else {
      // No user ID and no session - return empty
      return { orders: [] };
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    query = query.order('created_at', { ascending: false });

    // Try to fetch orders with joined profiles
    const queryStart = Date.now();
    let orders;
    let ordersError;
    let useJoin = true;
    
    try {
      const result = await query;
      orders = result.data;
      ordersError = result.error;
      
      if (__DEV__) {
        console.log(`[orders] ⏱️  Orders query (with join): ${Date.now() - queryStart}ms`);
      }
    } catch (err) {
      ordersError = err;
      orders = null;
    }
    
    // If join failed (foreign key doesn't exist or join syntax error), fall back to separate queries
    if (ordersError || !orders) {
      if (__DEV__) {
        console.log('[orders] Join query failed, falling back to separate queries:', ordersError?.code, ordersError?.message);
        console.log('[orders] 💡 To enable joins, run: docs/supabase-add-profile-trigger-and-fkey.sql');
      }
      
      useJoin = false;
      
      // Fall back to separate queries
      let fallbackQuery = supabase.from('orders').select('*');
      
      if (params.allOrders) {
        // Admin: fetch all orders
      } else if (params.userId) {
        fallbackQuery = fallbackQuery.eq('user_id', params.userId);
      } else if (currentUserId) {
        fallbackQuery = fallbackQuery.eq('user_id', currentUserId);
      } else {
        return { orders: [] };
      }
      
      if (params.status) {
        fallbackQuery = fallbackQuery.eq('status', params.status);
      }
      
      fallbackQuery = fallbackQuery.order('created_at', { ascending: false });
      
      const fallbackStart = Date.now();
      const { data: fallbackOrders, error: fallbackError } = await fallbackQuery;
      
      if (__DEV__) {
        console.log(`[orders] ⏱️  Orders fallback query: ${Date.now() - fallbackStart}ms`);
      }
      
      if (fallbackError) {
        if (__DEV__) {
          console.error('[orders] ❌ Error fetching orders:', fallbackError);
          console.error('[orders] Error code:', fallbackError.code);
          console.error('[orders] Error message:', fallbackError.message);
          console.error('[orders] Error details:', fallbackError.details);
          console.error('[orders] Query params were:', params);
        }
        throw fallbackError;
      }
      
      orders = fallbackOrders;
    }

    if (__DEV__) {
      console.log('[orders] ✅ Fetched', orders?.length || 0, 'orders from Supabase');
      if (params.allOrders) {
        console.log('[orders] Admin mode: fetched ALL orders');
      }
    }

    // Fetch order sets for all orders
    const orderIds = (orders || []).map((o) => o.id);
    let allOrderSets = [];
    let setsStart = Date.now();
    let profilesStart = Date.now();

    if (orderIds.length > 0) {
      setsStart = Date.now();
      // OPTIMIZATION: Exclude design_uploads from list query (can be 6MB+ per row!)
      // We only need basic info for the list view. Full details (including design_uploads)
      // are fetched when viewing individual order details via fetchOrder()
      const { data: sets, error: setsError } = await supabase
        .from('order_sets')
        .select('id, order_id, name, shape_id, quantity, description, set_notes, sizes, requires_follow_up, created_at, updated_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true });

      if (__DEV__) {
        console.log(`[orders] ⏱️  Order sets query: ${Date.now() - setsStart}ms (${orderIds.length} orders)`);
      }

      if (setsError) {
        throw setsError;
      }

      allOrderSets = sets || [];
    }

    // Group sets by order_id
    const setsByOrderId = {};
    allOrderSets.forEach((set) => {
      if (!setsByOrderId[set.order_id]) {
        setsByOrderId[set.order_id] = [];
      }
      setsByOrderId[set.order_id].push(set);
    });

    // Extract profiles from joined data or fetch separately
    let profilesMap = {};
    
    if (useJoin && orders && orders.length > 0 && orders[0].profile !== undefined) {
      // Profiles were joined in the query - extract them
      if (__DEV__) {
        console.log('[orders] ✅ Using joined profile data from query');
      }
      
      orders.forEach((order) => {
        const profile = Array.isArray(order.profile) ? order.profile[0] : order.profile;
        if (profile && profile.id) {
          profilesMap[profile.id] = profile;
        }
      });
    } else {
      // No joined profiles - fetch them separately
      const userIds = [...new Set((orders || []).map((o) => o.user_id).filter(Boolean))];
      
      if (userIds.length > 0) {
        if (__DEV__) {
          console.log('[orders] Fetching profiles separately for user IDs:', userIds);
        }
        
        // Fetch all profiles in a single batch query
        // This should work because:
        // - Admins can read all profiles (RLS policy allows it)
        // - Regular users only see their own orders, so they only need their own profile
        profilesStart = Date.now();
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (__DEV__) {
          console.log(`[orders] ⏱️  Profiles batch query: ${Date.now() - profilesStart}ms (${userIds.length} users)`);
        }
        
        if (profilesError) {
          // If batch query fails, log the error but don't fail completely
          // We'll just show "Unknown customer" for orders without profiles
          if (__DEV__) {
            console.error('[orders] ⚠️  Failed to fetch profiles (some orders may show "Unknown customer"):', profilesError);
            console.error('[orders] Error code:', profilesError.code);
            console.error('[orders] Error message:', profilesError.message);
            console.error('[orders] This is likely an RLS policy issue. Check that admins can read all profiles.');
          }
          // Don't throw - continue without profiles (orders will show "Unknown customer")
          profilesMap = {};
        } else {
          // Create a map of user_id -> profile
          profilesMap = (profiles || []).reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {});
          
          if (__DEV__) {
            console.log(`[orders] ✅ Fetched ${profiles?.length || 0} profiles (${Object.keys(profilesMap).length} unique)`);
          }
        }
      }
    }

    // Transform orders with their sets and user information
    const transformedOrders = (orders || []).map((order) => {
      // Remove the joined profile from the order object before transforming (if it exists)
      const { profile: joinedProfile, ...orderWithoutProfile } = order;
      const transformed = transformOrderFromDB(orderWithoutProfile, setsByOrderId[order.id] || []);
      
      // Add user information from profiles map or joined profile
      const profile = profilesMap[order.user_id] || (Array.isArray(joinedProfile) ? joinedProfile[0] : joinedProfile);
      
      if (profile) {
        if (__DEV__) {
          console.log('[orders] Attaching profile to order:', order.id, {
            userId: order.user_id,
            profileName: profile.full_name,
            profileEmail: profile.email,
          });
        }
        
        transformed.user = {
          id: profile.id,
          name: profile.full_name || null,
          email: profile.email || null,
        };
        // Also add for backward compatibility
        transformed.userName = profile.full_name || null;
        transformed.userEmail = profile.email || null;
        transformed.customerName = profile.full_name || null;
      } else {
        if (__DEV__) {
          console.warn('[orders] ⚠️  No profile found for order:', order.id, 'user_id:', order.user_id);
        }
      }
      
      return transformed;
    });

    if (__DEV__) {
      const totalTime = Date.now() - startTime;
      console.log(`[orders] ✅ Fetched ${transformedOrders.length} orders in ${totalTime}ms total`);
      
      // Performance breakdown - calculate actual times
      // Note: These queries run sequentially, so times are cumulative
      const ordersQueryTime = Date.now() - queryStart;
      const setsQueryTime = orderIds.length > 0 ? (Date.now() - setsStart) : 0;
      // profilesQueryTime is calculated in the else block if needed
      let profilesQueryTime = 0;
      if (!useJoin) {
        const userIds = [...new Set((orders || []).map((o) => o.user_id).filter(Boolean))];
        if (userIds.length > 0 && typeof profilesStart !== 'undefined') {
          profilesQueryTime = Date.now() - profilesStart;
        }
      }
      // Transform time is the remainder after all queries
      const transformTime = Math.max(0, totalTime - sessionTime - ordersQueryTime - setsQueryTime - profilesQueryTime);
      
      console.log(`[orders] ⏱️  Performance breakdown:`);
      console.log(`[orders]   - Session fetch: ${sessionTime}ms ${sessionTime > 100 ? '⚠️ SLOW' : '✅'}`);
      console.log(`[orders]   - Orders query (${useJoin ? 'with join' : 'separate'}): ${ordersQueryTime}ms ${ordersQueryTime > 1000 ? '⚠️ SLOW' : ordersQueryTime > 500 ? '⚠️' : '✅'}`);
      if (orderIds.length > 0) {
        console.log(`[orders]   - Order sets query (${orderIds.length} orders): ${setsQueryTime}ms ${setsQueryTime > 500 ? '⚠️ SLOW' : '✅'}`);
      }
      if (!useJoin && userIds.length > 0) {
        console.log(`[orders]   - Profiles query (${userIds.length} users): ${profilesQueryTime}ms ${profilesQueryTime > 500 ? '⚠️ SLOW' : '✅'}`);
      }
      console.log(`[orders]   - Data transformation: ${transformTime}ms ${transformTime > 100 ? '⚠️' : '✅'}`);
      console.log(`[orders]   - Total: ${totalTime}ms`);
      
      if (totalTime > 2000) {
        console.warn(`[orders] ⚠️  Slow query detected (>2s). Breakdown:`);
        if (sessionTime > 100) {
          console.warn(`[orders]   ⚠️  Session fetch is VERY slow (${sessionTime}ms). Should be <10ms. This might indicate:`);
          console.warn(`[orders]      - Network call instead of AsyncStorage read`);
          console.warn(`[orders]      - AsyncStorage performance issue`);
          console.warn(`[orders]      - Supabase client initialization delay`);
        }
        if (ordersQueryTime > 1000) {
          console.warn(`[orders]   ⚠️  Orders query is slow (${ordersQueryTime}ms). Possible causes:`);
          console.warn(`[orders]      - Missing database indexes (run: docs/supabase-add-performance-indexes.sql)`);
          console.warn(`[orders]      - Network latency (iOS simulator can add overhead)`);
          console.warn(`[orders]      - Large JSONB data in orders (design_uploads, sizes, pricing)`);
        }
        if (setsQueryTime > 500) {
          console.warn(`[orders]   ⚠️  Order sets query is slow (${setsQueryTime}ms). Possible causes:`);
          console.warn(`[orders]      - Missing composite index on order_sets(order_id, created_at)`);
          console.warn(`[orders]      - Large JSONB arrays (design_uploads)`);
          console.warn(`[orders]      - Network latency`);
        }
        if (profilesQueryTime > 500) {
          console.warn(`[orders]   ⚠️  Profiles query is slow (${profilesQueryTime}ms). Consider using join instead.`);
        }
      }
    }

    return { orders: transformedOrders };
  } catch (error) {
    console.error('[orders] ❌ Failed to fetch orders:', error);
    throw error;
  }
}

/**
 * Update an order (partial update)
 * @param {string} orderId - Order ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated order
 */
export async function updateOrder(orderId, updates) {
  try {
    if (__DEV__) {
      console.log('[orders] Updating order:', orderId, updates);
    }

    const allowedStatuses = new Set([
      'draft',
      'submitted',
      'pending',
      'in_progress',
      'completed',
      'delivered',
      'cancelled',
      'pending_payment',
      'paid',
    ]);

    const updatePayload = {};

    if (updates.status && allowedStatuses.has(updates.status)) {
      updatePayload.status = updates.status;
    }

    if (typeof updates.adminNotes === 'string') {
      updatePayload.admin_notes = updates.adminNotes.trim();
    }

    if (Array.isArray(updates.adminImages)) {
      updatePayload.admin_images = updates.adminImages.filter(
        (item) => typeof item === 'string' && item.length > 0,
      );
    }

    if (typeof updates.discount === 'number' && !Number.isNaN(updates.discount)) {
      updatePayload.discount = updates.discount;
    }

    if (updates.trackingNumber !== undefined) {
      updatePayload.tracking_number =
        updates.trackingNumber === null ? '' : String(updates.trackingNumber).trim();
    }

    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Fetch order sets
    const { data: orderSets, error: setsError } = await supabase
      .from('order_sets')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (setsError) {
      throw setsError;
    }

    const transformed = transformOrderFromDB(updatedOrder, orderSets || []);
    
    // Fetch user profile information
    if (updatedOrder.user_id) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', updatedOrder.user_id)
        .single();
      
      if (!profileError && profile) {
        transformed.user = {
          id: profile.id,
          name: profile.full_name || null,
          email: profile.email || null,
        };
        // Also add for backward compatibility
        transformed.userName = profile.full_name || null;
        transformed.userEmail = profile.email || null;
        transformed.customerName = profile.full_name || null;
      }
    }
    
    const completeOrder = transformed;

    if (__DEV__) {
      console.log('[orders] ✅ Order updated successfully');
      console.log('[orders] Updated order admin fields:', {
        adminNotes: completeOrder.adminNotes,
        adminImages: completeOrder.adminImages?.length || 0,
        trackingNumber: completeOrder.trackingNumber,
        status: completeOrder.status,
      });
    }

    return { order: completeOrder };
  } catch (error) {
    console.error('[orders] ❌ Failed to update order:', error);
    throw error;
  }
}

/**
 * Complete an order (mark as paid)
 * @param {string} orderId - Order ID
 * @param {Object} [payload] - Additional data
 * @param {string} [payload.paymentIntentId] - Payment intent ID
 * @returns {Promise<Object>} Completed order
 */
export async function completeOrder(orderId, payload = {}) {
  try {
    if (__DEV__) {
      console.log('[orders] Completing order:', orderId);
    }

    // Fetch current order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    if (order.status === 'paid') {
      // Already paid, return as-is
      const { data: orderSets } = await supabase
        .from('order_sets')
        .select('*')
        .eq('order_id', orderId);
      return { order: transformOrderFromDB(order, orderSets || []) };
    }

    // Validate payment intent if provided
    if (payload.paymentIntentId && order.payment_intent_id) {
      if (payload.paymentIntentId !== order.payment_intent_id) {
        throw new Error('Payment intent mismatch for this order');
      }
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Calculate estimated fulfillment date
    let estimatedFulfillmentDate = null;
    if (order.pricing && order.pricing.estimatedCompletionDate) {
      estimatedFulfillmentDate = new Date(order.pricing.estimatedCompletionDate).toISOString();
    } else {
      const daysToAdd = order.pricing?.estimatedCompletionDays || 7;
      const estimated = new Date(now);
      estimated.setDate(estimated.getDate() + daysToAdd);
      estimatedFulfillmentDate = estimated.toISOString();
    }

    // Create production jobs from order sets
    const { data: orderSets } = await supabase
      .from('order_sets')
      .select('*')
      .eq('order_id', orderId);

    const productionJobs = (orderSets || []).map((set) => ({
      id: `${orderId}_${set.id}`,
      orderId: order.id,
      nailSetId: set.id,
      quantity: set.quantity,
      shapeId: set.shape_id,
      name: set.name,
      description: set.description,
    }));

    // Update order to paid status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        estimated_fulfillment_date: estimatedFulfillmentDate,
        production_jobs: productionJobs,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    const completeOrder = transformOrderFromDB(updatedOrder, orderSets || []);

    if (__DEV__) {
      console.log('[orders] ✅ Order completed successfully');
    }

    return { order: completeOrder };
  } catch (error) {
    console.error('[orders] ❌ Failed to complete order:', error);
    throw error;
  }
}

/**
 * Create payment intent for an order
 * NOTE: This still requires a backend for Stripe secret key security
 * For now, this is a placeholder that should call your backend
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Payment intent data
 */
export async function createPaymentIntent(orderId) {
  // Payment intents require Stripe secret key which should not be in the client
  // You'll need to keep a backend endpoint for this, or use Supabase Edge Functions
  // For now, throw an error indicating this needs backend setup
  throw new Error(
    'Payment intent creation requires backend. Set up a backend endpoint or Supabase Edge Function for Stripe integration.',
  );
}

/**
 * Delete an order (only allowed for draft orders)
 * @param {string} orderId - Order ID to delete
 * @returns {Promise<void>}
 */
export async function deleteOrder(orderId) {
  try {
    if (__DEV__) {
      console.log('[orders] Deleting order:', orderId);
    }

    // First, check if the order exists and is a draft
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('Order not found');
      }
      throw fetchError;
    }

    if (order.status !== 'draft') {
      throw new Error('Only draft orders can be deleted');
    }

    // Delete order sets first (foreign key constraint)
    const { error: setsError } = await supabase
      .from('order_sets')
      .delete()
      .eq('order_id', orderId);

    if (setsError) {
      throw setsError;
    }

    // Delete the order
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (deleteError) {
      throw deleteError;
    }

    if (__DEV__) {
      console.log('[orders] ✅ Order deleted successfully');
    }
  } catch (error) {
    console.error('[orders] ❌ Failed to delete order:', error);
    throw error;
  }
}

