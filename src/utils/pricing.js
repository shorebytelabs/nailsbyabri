import shapeCatalog from '../../shared/catalog/shapes.json';

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

export function getShapeById(shapeId) {
  return shapeCatalog.find((shape) => shape.id === shapeId);
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
      estimatedCompletionDays: SPEED_RULES[fulfillment.speed]?.days ?? SPEED_RULES.standard.days,
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

  return {
    lineItems,
    subtotal,
    discounts: discount,
    total: subtotal,
    estimatedCompletionDays: speedRule.days,
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
  SPEED_RULES,
  DELIVERY_RULES,
  DESIGN_SETUP_FEE,
};

export default calculatePriceBreakdown;

