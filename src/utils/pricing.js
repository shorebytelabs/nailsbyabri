import shapeCatalog from '../../shared/catalog/shapes.json';

const DESIGN_SETUP_FEE = 0;

function computeCompletionDate(days = 0) {
  const baseline = new Date();
  baseline.setHours(0, 0, 0, 0);
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 0;
  baseline.setDate(baseline.getDate() + safeDays);
  return baseline.toISOString();
}

export const DELIVERY_METHODS = {
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

export function getShapeById(shapeId) {
  return shapeCatalog.find((shape) => shape.id === shapeId);
}

function getMethodConfig(method) {
  return DELIVERY_METHODS[method] || DELIVERY_METHODS.pickup;
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

export function calculatePriceBreakdown({
  nailSets = [],
  fulfillment = {},
  promoCode = null,
  adminDiscount = 0, // Admin-applied discount amount (in dollars)
}) {
  const normalizedSets = normalizeNailSets(nailSets);

  if (!normalizedSets.length) {
    const methodConfig = getMethodConfig(fulfillment.method);
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
    const shape = getShapeById(set.shapeId);
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

  const methodConfig = getMethodConfig(fulfillment.method);
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
      label: 'Admin Discount',
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

export function getShapeCatalog() {
  return shapeCatalog;
}

export const pricingConstants = {
  DELIVERY_METHODS,
  DESIGN_SETUP_FEE,
};

export default calculatePriceBreakdown;

