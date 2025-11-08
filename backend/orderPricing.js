const path = require('path');

const shapeCatalog = require(path.join(__dirname, '..', 'shared', 'catalog', 'shapes.json'));

const SPEED_RULES = {
  standard: { label: 'Standard Speed', days: 7, fee: 0 },
  priority: { label: 'Priority Speed', days: 5, fee: 18 },
  rush: { label: 'Rush Speed', days: 3, fee: 35 },
};

const DELIVERY_RULES = {
  pickup: { label: 'Studio Pickup', fee: 0 },
  delivery: { label: 'Local Delivery', fee: 10 },
  shipping: { label: 'Standard Shipping', fee: 7 },
};

const DESIGN_SETUP_FEE = 10;

function getShapeById(shapeId) {
  return shapeCatalog.find((shape) => shape.id === shapeId);
}

function normalizeSizes(sizes) {
  if (!sizes || typeof sizes !== 'object') {
    return { mode: 'standard', values: {} };
  }

  const mode = sizes.mode === 'perSet' || sizes.mode === 'custom' ? 'perSet' : 'standard';
  const values =
    sizes.values && typeof sizes.values === 'object'
      ? Object.entries(sizes.values).reduce((acc, [finger, value]) => {
          acc[finger] = typeof value === 'string' ? value : '';
          return acc;
        }, {})
      : {};

  return { mode, values };
}

function normalizeNailSets(nailSets = []) {
  return nailSets
    .filter((set) => set && set.shapeId)
    .map((set) => {
      const quantity = Math.max(1, Number(set.quantity) || 1);
      const name = typeof set.name === 'string' && set.name.trim() ? set.name.trim() : null;
      const description = typeof set.description === 'string' ? set.description.trim() : '';
      const setNotes = typeof set.setNotes === 'string' ? set.setNotes.trim() : '';
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

      return {
        ...set,
        id: set.id || null,
        name,
        quantity,
        description,
        setNotes,
        designUploads,
        sizes: normalizeSizes(set.sizes),
      };
    });
}

function calculatePerSetPricing(set, shape) {
  const baseUnitPrice = shape.basePrice;
  const requiresCustomArt =
    Array.isArray(set.designUploads) && set.designUploads.length > 0
      ? true
      : Boolean(set.description && set.description.length > 0);

  const setupFee = requiresCustomArt ? DESIGN_SETUP_FEE : 0;
  const unitPrice = baseUnitPrice + setupFee;
  const subtotal = unitPrice * set.quantity;

  return {
    subtotal,
    unitPrice,
    setupFee,
    requiresCustomArt,
  };
}

function calculateOrderPricing({
  nailSets = [],
  fulfillment = {},
  promoCode = null,
}) {
  const normalizedSets = normalizeNailSets(nailSets);

  if (!normalizedSets.length) {
    throw new Error('At least one nail set is required to create an order');
  }

  const lineItems = [];
  const setSummaries = [];

  normalizedSets.forEach((set, index) => {
    const shape = getShapeById(set.shapeId);
    if (!shape) {
      throw new Error(`Unknown nail shape selected for set ${set.name || index + 1}`);
    }

    const { subtotal, unitPrice, setupFee, requiresCustomArt } = calculatePerSetPricing(set, shape);
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
      setupFee,
      requiresCustomArt,
    });
  });

  const deliveryMethod = fulfillment.method || 'pickup';
  const deliverySpeed = fulfillment.speed || 'standard';
  const speedRule = SPEED_RULES[deliverySpeed] || SPEED_RULES.standard;
  const deliveryRule = DELIVERY_RULES[deliveryMethod] || DELIVERY_RULES.pickup;

  if (deliveryRule.fee > 0) {
    lineItems.push({
      id: 'fulfillment',
      label: deliveryRule.label,
      amount: deliveryRule.fee,
    });
  }

  if (speedRule.fee > 0) {
    lineItems.push({
      id: 'speed',
      label: speedRule.label,
      amount: speedRule.fee,
    });
  }

  let subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  let discount = 0;

  if (promoCode && typeof promoCode === 'string') {
    if (promoCode.trim().toLowerCase() === 'holiday10') {
      discount = Math.round(subtotal * 0.1);
      lineItems.push({
        id: 'promo',
        label: 'Holiday Discount',
        amount: -discount,
      });
      subtotal -= discount;
    }
  }

  const total = subtotal;

  return {
    lineItems,
    subtotal,
    discounts: discount,
    total,
    estimatedCompletionDays: speedRule.days,
    summary: setSummaries,
  };
}

module.exports = {
  calculateOrderPricing,
  getShapeById,
  SPEED_RULES,
  DELIVERY_RULES,
  DESIGN_SETUP_FEE,
};

