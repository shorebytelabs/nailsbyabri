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
};

const VARIATION_FEE = 12; // per variation entry
const CUSTOM_SIZE_FEE = 8; // applied when manual sizes provided

function getShapeById(shapeId) {
  return shapeCatalog.find((shape) => shape.id === shapeId);
}

function calculateOrderPricing({
  shapeId,
  setCount = 1,
  variations = [],
  sizes = {},
  deliveryMethod = 'pickup',
  deliverySpeed = 'standard',
}) {
  const shape = getShapeById(shapeId);
  if (!shape) {
    throw new Error('Unknown nail shape selected');
  }

  const basePrice = Math.max(1, Number(setCount || 1)) * shape.basePrice;
  const variationCount = Array.isArray(variations)
    ? variations.reduce(
        (sum, item) => sum + Math.max(1, Number(item.quantity) || 1),
        0,
      )
    : 0;
  const variationPrice = variationCount * VARIATION_FEE;

  const hasCustomSizes =
    sizes && typeof sizes === 'object' && Object.values(sizes).some((value) => value && value.trim() !== '');
  const customSizePrice = hasCustomSizes ? CUSTOM_SIZE_FEE : 0;

  const speedRule = SPEED_RULES[deliverySpeed] || SPEED_RULES.standard;
  const deliveryRule = DELIVERY_RULES[deliveryMethod] || DELIVERY_RULES.pickup;

  const lineItems = [
    {
      id: 'base',
      label: `${shape.name} Shape Base (${setCount} set${setCount > 1 ? 's' : ''})`,
      amount: basePrice,
    },
  ];

  if (variationPrice > 0) {
    lineItems.push({
      id: 'variations',
      label: 'Design Variations',
      amount: variationPrice,
    });
  }

  if (customSizePrice > 0) {
    lineItems.push({
      id: 'customSizing',
      label: 'Custom Sizing',
      amount: customSizePrice,
    });
  }

  if (deliveryRule.fee > 0) {
    lineItems.push({
      id: 'delivery',
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

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    lineItems,
    subtotal,
    total: subtotal,
    estimatedCompletionDays: speedRule.days,
  };
}

module.exports = {
  calculateOrderPricing,
  getShapeById,
  SPEED_RULES,
  DELIVERY_RULES,
};

