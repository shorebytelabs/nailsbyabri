import shapeCatalog from '../../shared/catalog/shapes.json';

const DESIGN_SETUP_FEE = 10;

export const DELIVERY_METHODS = {
  pickup: {
    id: 'pickup',
    label: 'Pick Up',
    description: 'Ready in 10 days in 92127',
    baseFee: 0,
    speedOptions: {
      standard: { id: 'standard', label: 'Standard', description: '10–14 days', fee: 0, days: 12, tagline: 'Included' },
      priority: { id: 'priority', label: 'Priority', description: '3–5 days', fee: 5, days: 4, tagline: 'Get your nails faster!' },
      rush: { id: 'rush', label: 'Rush', description: 'Next day', fee: 10, days: 1, tagline: 'Fast-track your order!' },
    },
    defaultSpeed: 'standard',
  },
  delivery: {
    id: 'delivery',
    label: 'Local Delivery',
    description: 'Ready in 10 days in 92127',
    baseFee: 10,
    speedOptions: {
      standard: { id: 'standard', label: 'Standard', description: '10–14 days', fee: 0, days: 12, tagline: 'Included' },
      priority: { id: 'priority', label: 'Priority', description: '3–5 days', fee: 10, days: 4, tagline: 'Get your nails faster!' },
      rush: { id: 'rush', label: 'Rush', description: 'Next day', fee: 15, days: 1, tagline: 'Fast-track your order!' },
    },
    defaultSpeed: 'standard',
  },
  shipping: {
    id: 'shipping',
    label: 'Shipping',
    description: 'Ready to ship in 10–14 days',
    baseFee: 7,
    speedOptions: {
      standard: { id: 'standard', label: 'Standard', description: '10–14 days', fee: 0, days: 12, tagline: 'Included' },
      priority: { id: 'priority', label: 'Priority', description: '3–5 days', fee: 15, days: 4, tagline: 'Get your nails faster!' },
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
}) {
  const normalizedSets = normalizeNailSets(nailSets);

  if (!normalizedSets.length) {
    return {
      lineItems: [],
      subtotal: 0,
      discounts: 0,
      total: 0,
      estimatedCompletionDays: getMethodConfig(fulfillment.method).speedOptions[
        fulfillment.speed || getMethodConfig(fulfillment.method).defaultSpeed
      ].days,
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

  if (methodConfig.baseFee > 0) {
    lineItems.push({
      id: 'fulfillment',
      label: methodConfig.label,
      amount: methodConfig.baseFee,
    });
  }

  if (speedConfig.fee > 0) {
    lineItems.push({
      id: 'speed',
      label: `${methodConfig.label} • ${speedConfig.label}`,
      amount: speedConfig.fee,
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

  return {
    lineItems,
    subtotal,
    discounts: discount,
    total: subtotal,
    estimatedCompletionDays: speedConfig.days,
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

