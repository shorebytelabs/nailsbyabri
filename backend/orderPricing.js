const path = require('path');

const shapeCatalog = require(path.join(__dirname, '..', 'shared', 'catalog', 'shapes.json'));

const DESIGN_SETUP_FEE = 0;

function computeCompletionDate(days = 0) {
  const baseline = new Date();
  baseline.setHours(0, 0, 0, 0);
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 0;
  baseline.setDate(baseline.getDate() + safeDays);
  return baseline.toISOString();
}

const DELIVERY_METHODS = {
  pickup: {
    id: 'pickup',
    label: 'Pick Up',
    description: 'Ready in 10 days in 92127',
    baseFee: 0,
    speedOptions: {
      standard: { label: 'Standard', description: '10 to 14 days', fee: 0, days: 14 },
      priority: { label: 'Priority', description: '3 to 5 days', fee: 5, days: 5 },
      rush: { label: 'Rush', description: 'Next day', fee: 10, days: 1 },
    },
    defaultSpeed: 'standard',
  },
  delivery: {
    id: 'delivery',
    label: 'Local Delivery',
    description: 'Ready in 10 days in 92127',
    baseFee: 0,
    speedOptions: {
      standard: { label: 'Standard', description: '10 to 14 days', fee: 5, days: 14 },
      priority: { label: 'Priority', description: '3 to 5 days', fee: 10, days: 5 },
      rush: { label: 'Rush', description: 'Next day', fee: 15, days: 1 },
    },
    defaultSpeed: 'standard',
  },
  shipping: {
    id: 'shipping',
    label: 'Shipping',
    description: 'Ready to ship in 10 to 14 days',
    baseFee: 0,
    speedOptions: {
      standard: { label: 'Standard', description: '10 to 14 days', fee: 7, days: 14 },
      priority: { label: 'Priority', description: '3 to 5 days', fee: 15, days: 5 },
      rush: { label: 'Rush', description: 'Next day', fee: 20, days: 1 },
    },
    defaultSpeed: 'standard',
  },
};

function getShapeById(shapeId) {
  return shapeCatalog.find((shape) => shape.id === shapeId);
}

function getMethodConfig(method) {
  return DELIVERY_METHODS[method] || DELIVERY_METHODS.pickup;
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
  const estimatedCompletionDate = computeCompletionDate(speedConfig.days);

  return {
    lineItems,
    subtotal,
    discounts: discount,
    total,
    estimatedCompletionDays: speedConfig.days,
    estimatedCompletionDate,
    summary: setSummaries,
    fulfillment: {
      method: methodConfig.id,
      speed: Object.keys(methodConfig.speedOptions).find(
        (key) => methodConfig.speedOptions[key] === speedConfig,
      ),
    },
  };
}

module.exports = {
  calculateOrderPricing,
  getShapeById,
  DESIGN_SETUP_FEE,
  DELIVERY_METHODS,
};

