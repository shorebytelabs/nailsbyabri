import shapeCatalog from '../../shared/catalog/shapes.json';
import { getVisibleDeliveryMethods } from '../services/deliveryService';
import { getVisibleShapes } from '../services/shapesService';

const DESIGN_SETUP_FEE = 0;

// Cache for delivery methods (will be loaded dynamically)
let cachedDeliveryMethods = null;
let deliveryMethodsPromise = null;

// Cache for shapes (will be loaded dynamically)
let cachedShapes = null;
let shapesPromise = null;

function computeCompletionDate(days = 0) {
  const baseline = new Date();
  baseline.setHours(0, 0, 0, 0);
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 0;
  baseline.setDate(baseline.getDate() + safeDays);
  return baseline.toISOString();
}

// Fallback delivery methods (used if database fails)
const FALLBACK_DELIVERY_METHODS = {
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

/**
 * Get delivery methods (loads from database, caches result)
 * @returns {Promise<Object>} Delivery methods object
 */
export async function getDeliveryMethods() {
  if (cachedDeliveryMethods) {
    return cachedDeliveryMethods;
  }
  
  if (deliveryMethodsPromise) {
    return deliveryMethodsPromise;
  }

  deliveryMethodsPromise = (async () => {
    try {
      const methods = await getVisibleDeliveryMethods();
      if (methods && Object.keys(methods).length > 0) {
        cachedDeliveryMethods = methods;
        return methods;
      }
      return FALLBACK_DELIVERY_METHODS;
    } catch (error) {
      console.error('[pricing] Error loading delivery methods, using fallback:', error);
      return FALLBACK_DELIVERY_METHODS;
    } finally {
      deliveryMethodsPromise = null;
    }
  })();

  return deliveryMethodsPromise;
}

/**
 * Get delivery methods synchronously (returns cached or fallback)
 * Use this for synchronous access, but prefer getDeliveryMethods() for async
 */
export function getDeliveryMethodsSync() {
  return cachedDeliveryMethods || FALLBACK_DELIVERY_METHODS;
}

/**
 * Clear delivery methods cache (call when admin updates methods)
 */
export function clearDeliveryMethodsCache() {
  cachedDeliveryMethods = null;
  deliveryMethodsPromise = null;
}

/**
 * Get shapes (loads from database, caches result)
 * @returns {Promise<Array>} Shapes array
 */
export async function getShapes() {
  if (cachedShapes) {
    return cachedShapes;
  }
  
  if (shapesPromise) {
    return shapesPromise;
  }

  shapesPromise = (async () => {
    try {
      const shapes = await getVisibleShapes();
      if (shapes && shapes.length > 0) {
        cachedShapes = shapes;
        return shapes;
      }
      return shapeCatalog;
    } catch (error) {
      console.error('[pricing] Error loading shapes, using fallback:', error);
      return shapeCatalog;
    } finally {
      shapesPromise = null;
    }
  })();

  return shapesPromise;
}

/**
 * Clear shapes cache (call when admin updates shapes)
 */
export function clearShapesCache() {
  cachedShapes = null;
  shapesPromise = null;
}

export async function getShapeById(shapeId) {
  const shapes = await getShapes();
  return shapes.find((shape) => shape.id === shapeId);
}

export function getShapeByIdSync(shapeId) {
  return cachedShapes?.find((shape) => shape.id === shapeId) || 
         shapeCatalog.find((shape) => shape.id === shapeId);
}

async function getMethodConfig(method) {
  const methods = await getDeliveryMethods();
  return methods[method] || methods.pickup || FALLBACK_DELIVERY_METHODS.pickup;
}

function getMethodConfigSync(method) {
  const methods = getDeliveryMethodsSync();
  return methods[method] || methods.pickup || FALLBACK_DELIVERY_METHODS.pickup;
}

function normalizeNailSets(nailSets = []) {
  return nailSets
    .filter((set) => set && set.shapeId)
    .map((set) => {
      const quantity = Math.max(1, Number(set.quantity) || 1);
      const name = typeof set.name === 'string' && set.name.trim() ? set.name.trim() : null;
      const description = typeof set.description === 'string' ? set.description.trim() : '';
      const designUploads = Array.isArray(set.designUploads)
        ? set.designUploads
            .map((upload) => {
              if (!upload) {
                return null;
              }
              if (typeof upload === 'string') {
                return { data: upload };
              }
              if (upload.data || upload.base64 || upload.content) {
                return {
                  id: upload.id || null,
                  fileName: upload.fileName || null,
                  data: upload.data || upload.base64 || upload.content,
                };
              }
              return null;
            })
            .filter(Boolean)
        : [];
      const setNotes = typeof set.setNotes === 'string' ? set.setNotes.trim() : '';

      return {
        ...set,
        id: set.id || null,
        name,
        description,
        setNotes,
        designUploads,
        quantity,
      };
    });
}

export async function calculatePriceBreakdown({
  nailSets = [],
  fulfillment = {},
  promoCode = null,
  adminDiscount = 0, // Admin-applied discount amount (in dollars)
}) {
  const normalizedSets = normalizeNailSets(nailSets);

  // Load delivery methods and shapes (will use cache if available)
  const deliveryMethods = await getDeliveryMethods();
  const shapes = await getShapes();

  if (!normalizedSets.length) {
    const methodConfig = deliveryMethods[fulfillment.method] || deliveryMethods.pickup || FALLBACK_DELIVERY_METHODS.pickup;
    const speedOption =
      methodConfig.speedOptions[fulfillment.speed] || methodConfig.speedOptions[methodConfig.defaultSpeed];
    return {
      lineItems: [],
      subtotal: 0,
      discounts: 0,
      total: 0,
      estimatedCompletionDays: speedOption.days,
      estimatedCompletionDate: computeCompletionDate(speedOption.days),
      summary: [],
    };
  }

  const lineItems = [];
  const setSummaries = [];

  normalizedSets.forEach((set, index) => {
    const shape = shapes.find((s) => s.id === set.shapeId) || getShapeByIdSync(set.shapeId);
    if (!shape) {
      return;
    }
    const requiresCustomArt =
      (Array.isArray(set.designUploads) && set.designUploads.length > 0) ||
      (set.description && set.description.length > 0);
    const unitPrice = shape.basePrice + (requiresCustomArt ? DESIGN_SETUP_FEE : 0);
    const subtotal = unitPrice * set.quantity;
    const labelName = set.name || `${shape.name} Set`;

    lineItems.push({
      id: `set_${index}`,
      label: `${labelName} (${set.quantity} set${set.quantity > 1 ? 's' : ''})`,
      amount: subtotal,
    });

    setSummaries.push({
      id: set.id || `set_${index}`,
      name: set.name,
      shapeId: set.shapeId,
      shapeName: shape.name,
      quantity: set.quantity,
      subtotal,
      unitPrice,
      requiresCustomArt,
    });
  });

  const methodConfig = deliveryMethods[fulfillment.method] || deliveryMethods.pickup || FALLBACK_DELIVERY_METHODS.pickup;
  const speedConfig =
    methodConfig.speedOptions[fulfillment.speed] ||
    methodConfig.speedOptions[methodConfig.defaultSpeed];

  lineItems.push({
    id: 'delivery',
    label: `${methodConfig.label} • ${speedConfig.label} (${speedConfig.description})`,
    amount: speedConfig.fee,
  });

  let subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  let discount = 0;

  // Apply promo code discount first (if any)
  // promoCode can be either:
  // 1. A validated promo code object with discount info (from validatePromoCode)
  // 2. A string (for backward compatibility)
  if (promoCode) {
    let promoDiscount = 0;
    let promoLabel = 'Promo Discount';

    if (typeof promoCode === 'object' && promoCode.valid && promoCode.discount !== undefined) {
      // Validated promo code object
      promoDiscount = Number(promoCode.discount) || 0;
      const promoCodeStr = promoCode.promo?.code || '';
      promoLabel = promoCode.discountDescription 
        ? `Promo (${promoCodeStr}): ${promoCode.discountDescription}`
        : `Promo (${promoCodeStr})`;
      
      if (__DEV__) {
        console.log('[calculatePriceBreakdownSync] Applying promo code:', {
          code: promoCodeStr,
          discount: promoDiscount,
          discountDescription: promoCode.discountDescription,
          promoType: promoCode.promo?.type,
        });
      }
    } else if (typeof promoCode === 'string') {
      // Legacy string format (backward compatibility)
      if (promoCode.trim().toLowerCase() === 'holiday10') {
        promoDiscount = Math.round(subtotal * 0.1);
        promoLabel = 'Holiday Discount';
      }
    }

    if (promoDiscount > 0) {
      // For free shipping, the discount applies to shipping cost
      // For other types, it applies to the subtotal
      const actualDiscount = Math.min(promoDiscount, subtotal);
      lineItems.push({
        id: 'promo',
        label: promoLabel,
        amount: -actualDiscount,
      });
      discount += actualDiscount;
      subtotal -= actualDiscount;
    }
  }

  // Apply admin discount (after promo code discount)
  const adminDiscountAmount = Number(adminDiscount) || 0;
  if (adminDiscountAmount > 0) {
    // Ensure discount doesn't exceed subtotal
    const actualDiscount = Math.min(adminDiscountAmount, subtotal);
    lineItems.push({
      id: 'admin_discount',
      label: 'Discount',
      amount: -actualDiscount,
    });
    discount += actualDiscount;
    subtotal -= actualDiscount;
  }

  return {
    lineItems,
    subtotal,
    discounts: discount,
    total: subtotal,
    estimatedCompletionDays: speedConfig.days,
    estimatedCompletionDate: computeCompletionDate(speedConfig.days),
    summary: setSummaries,
  };
}

export function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

export async function getShapeCatalog() {
  return await getShapes();
}

export function getShapeCatalogSync() {
  return cachedShapes || shapeCatalog;
}

export const pricingConstants = {
  DELIVERY_METHODS: FALLBACK_DELIVERY_METHODS, // Legacy export
  DESIGN_SETUP_FEE,
};

// Sync version for backward compatibility (uses cached data)
export function calculatePriceBreakdownSync({
  nailSets = [],
  fulfillment = {},
  promoCode = null,
  adminDiscount = 0,
}) {
  const normalizedSets = normalizeNailSets(nailSets);
  const deliveryMethods = getDeliveryMethodsSync();
  const shapes = getShapeCatalogSync();

  if (!normalizedSets.length) {
    const methodConfig = deliveryMethods[fulfillment.method] || deliveryMethods.pickup || FALLBACK_DELIVERY_METHODS.pickup;
    const speedOption =
      methodConfig.speedOptions[fulfillment.speed] || methodConfig.speedOptions[methodConfig.defaultSpeed];
    return {
      lineItems: [],
      subtotal: 0,
      discounts: 0,
      total: 0,
      estimatedCompletionDays: speedOption.days,
      estimatedCompletionDate: computeCompletionDate(speedOption.days),
      summary: [],
    };
  }

  const lineItems = [];
  const setSummaries = [];

  normalizedSets.forEach((set, index) => {
    const shape = shapes.find((s) => s.id === set.shapeId);
    if (!shape) {
      return;
    }
    const requiresCustomArt =
      (Array.isArray(set.designUploads) && set.designUploads.length > 0) ||
      (set.description && set.description.length > 0);
    const unitPrice = shape.basePrice + (requiresCustomArt ? DESIGN_SETUP_FEE : 0);
    const subtotal = unitPrice * set.quantity;
    const labelName = set.name || `${shape.name} Set`;

    lineItems.push({
      id: `set_${index}`,
      label: `${labelName} (${set.quantity} set${set.quantity > 1 ? 's' : ''})`,
      amount: subtotal,
    });

    setSummaries.push({
      id: set.id || `set_${index}`,
      name: set.name,
      shapeId: set.shapeId,
      shapeName: shape.name,
      quantity: set.quantity,
      subtotal,
      unitPrice,
      requiresCustomArt,
    });
  });

  const methodConfig = deliveryMethods[fulfillment.method] || deliveryMethods.pickup || FALLBACK_DELIVERY_METHODS.pickup;
  const speedConfig =
    methodConfig.speedOptions[fulfillment.speed] ||
    methodConfig.speedOptions[methodConfig.defaultSpeed];

  lineItems.push({
    id: 'delivery',
    label: `${methodConfig.label} • ${speedConfig.label} (${speedConfig.description})`,
    amount: speedConfig.fee,
  });

  let subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  let discount = 0;

  if (promoCode) {
    let promoDiscount = 0;
    let promoLabel = 'Promo Discount';

    if (typeof promoCode === 'object' && promoCode.valid && promoCode.discount !== undefined) {
      // Validated promo code object (from validatePromoCode)
      promoDiscount = Number(promoCode.discount) || 0;
      const promoCodeStr = promoCode.promo?.code || '';
      promoLabel = promoCode.discountDescription 
        ? `Promo (${promoCodeStr}): ${promoCode.discountDescription}`
        : `Promo (${promoCodeStr})`;
    } else if (typeof promoCode === 'string') {
      // Legacy string format (backward compatibility)
      if (promoCode.trim().toLowerCase() === 'holiday10') {
        promoDiscount = Math.round(subtotal * 0.1);
        promoLabel = 'Holiday Discount';
      }
    }

    if (promoDiscount > 0) {
      // For free shipping, the discount applies to shipping cost
      // For other types, it applies to the subtotal
      const actualDiscount = Math.min(promoDiscount, subtotal);
      lineItems.push({
        id: 'promo',
        label: promoLabel,
        amount: -actualDiscount,
      });
      discount += actualDiscount;
      subtotal -= actualDiscount;
    }
  }

  const adminDiscountAmount = Number(adminDiscount) || 0;
  if (adminDiscountAmount > 0) {
    const actualDiscount = Math.min(adminDiscountAmount, subtotal);
    lineItems.push({
      id: 'admin_discount',
      label: 'Discount',
      amount: -actualDiscount,
    });
    discount += actualDiscount;
    subtotal -= actualDiscount;
  }

  return {
    lineItems,
    subtotal,
    discounts: discount,
    total: subtotal,
    estimatedCompletionDays: speedConfig.days,
    estimatedCompletionDate: computeCompletionDate(speedConfig.days),
    summary: setSummaries,
  };
}

export default calculatePriceBreakdown;

