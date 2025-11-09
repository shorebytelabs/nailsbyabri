require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const Stripe = require('stripe');
const { readData, writeData } = require('./storage');
const { calculateOrderPricing, DELIVERY_METHODS } = require('./orderPricing');
const shapeCatalog = require('../shared/catalog/shapes.json');

const PORT = process.env.PORT || 4000;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET_KEY ? Stripe(STRIPE_SECRET_KEY) : null;

if (!STRIPE_SECRET_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    'Stripe secret key not set. Payment endpoints will return errors until STRIPE_SECRET_KEY is provided.',
  );
}

const app = express();
app.use(cors());
app.use('/payments/webhook', express.raw({ type: 'application/json' }));
const jsonBodyParser = express.json();
app.use((req, res, next) => {
  if (req.originalUrl === '/payments/webhook') {
    return next();
  }
  return jsonBodyParser(req, res, next);
});

function calculateAge(dobString) {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function sanitizeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function publicConsentLog(log) {
  const { token, ...rest } = log;
  return rest;
}

function sanitizeOrder(order) {
  const { paymentIntentClientSecret, ...rest } = order;

  if (!rest.nailSets && rest.shapeId) {
    const legacySet = {
      id: `${rest.id || 'order'}_legacy`,
      name: rest.notes || null,
      shapeId: rest.shapeId,
      quantity: rest.setCount || 1,
      description: rest.notes || '',
      setNotes: rest.notes || '',
      designUploads: rest.designImage
        ? [
            {
              id: `${rest.id || 'legacy'}_upload`,
              fileName: rest.designFileName || null,
              data: rest.designImage,
            },
          ]
        : [],
      sizes: {
        mode: 'standard',
        values: rest.sizes || {},
      },
      requiresFollowUp: !rest.designImage,
    };
    rest.nailSets = [legacySet];
    const fallbackFulfillment = normalizeFulfillment({
      method: rest.deliveryMethod || 'pickup',
      speed: rest.deliverySpeed || 'standard',
      address: rest.address || null,
    });
    rest.fulfillment = rest.fulfillment
      ? normalizeFulfillment(rest.fulfillment)
      : fallbackFulfillment;
    rest.customerSizes = rest.customerSizes || { mode: 'standard', values: rest.sizes || {} };
    rest.orderNotes = rest.notes || '';
  }

  return rest;
}

function findOrderById(state, orderId) {
  return state.orders.find((item) => item.id === orderId);
}

function normalizeSizesPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { mode: 'unset', values: {} };
  }
  const mode = payload.mode === 'perSet' || payload.mode === 'custom' ? 'perSet' : 'standard';
  const values =
    payload.values && typeof payload.values === 'object'
      ? Object.entries(payload.values).reduce((acc, [finger, value]) => {
          acc[finger] = typeof value === 'string' ? value : '';
          return acc;
        }, {})
      : {};
  return { mode, values };
}

function normalizeFulfillment(payload = {}) {
  const methodConfig = DELIVERY_METHODS[payload.method] || DELIVERY_METHODS.pickup;
  const speed =
    payload.speed && methodConfig.speedOptions[payload.speed]
      ? payload.speed
      : methodConfig.defaultSpeed;
  const address =
    methodConfig.id === 'shipping' || methodConfig.id === 'delivery'
      ? {
          name: payload.address?.name || '',
          line1: payload.address?.line1 || '',
          line2: payload.address?.line2 || '',
          city: payload.address?.city || '',
          state: payload.address?.state || '',
          postalCode: payload.address?.postalCode || '',
        }
      : null;

  return {
    method: methodConfig.id,
    speed,
    address,
  };
}

function normalizeNailSetPayload(setPayload = {}) {
  if (!setPayload.shapeId) {
    return null;
  }
  const designUploads = Array.isArray(setPayload.designUploads)
    ? setPayload.designUploads
        .map((upload) => {
          if (!upload) {
            return null;
          }
          if (typeof upload === 'string') {
            return { id: uuid(), fileName: null, data: upload };
          }
          const data = upload.data || upload.base64 || upload.content || null;
          if (!data) {
            return null;
          }
          return {
            id: upload.id || uuid(),
            fileName: upload.fileName || null,
            data,
          };
        })
        .filter(Boolean)
    : [];

  return {
    id: setPayload.id || uuid(),
    name: typeof setPayload.name === 'string' && setPayload.name.trim() ? setPayload.name.trim() : null,
    shapeId: setPayload.shapeId,
    quantity: Math.max(1, Number(setPayload.quantity) || 1),
    description: typeof setPayload.description === 'string' ? setPayload.description.trim() : '',
    setNotes: typeof setPayload.setNotes === 'string' ? setPayload.setNotes.trim() : '',
    designUploads,
    sizes: normalizeSizesPayload(setPayload.sizes),
    requiresFollowUp: Boolean(setPayload.requiresFollowUp),
  };
}

function createProductionJobs(order) {
  if (!order || !Array.isArray(order.nailSets)) {
    return [];
  }
  return order.nailSets.map((set) => ({
    id: `${order.id}_${set.id}`,
    orderId: order.id,
    nailSetId: set.id,
    quantity: set.quantity,
    shapeId: set.shapeId,
    name: set.name,
    description: set.description,
    designUploads: set.designUploads,
    setNotes: set.setNotes,
    sizes: set.sizes,
  }));
}

app.post('/auth/signup', async (req, res) => {
  const {
    name,
    email,
    password,
    dob,
    parent_email: parentEmailRaw,
    parent_phone: parentPhoneRaw,
  } = req.body || {};

  if (!name || !email || !password || !dob) {
    return res
      .status(400)
      .json({ error: 'Missing required fields: name, email, password, dob' });
  }

  const normalizedEmail = normalizeEmail(email);
  const parentEmail = parentEmailRaw ? normalizeEmail(parentEmailRaw) : null;
  const parentPhone = parentPhoneRaw ? String(parentPhoneRaw).trim() : null;

  const age = calculateAge(dob);
  if (age === null) {
    return res.status(400).json({ error: 'Invalid date of birth' });
  }

  const isMinor = age < 18;
  if (isMinor && !parentEmail && !parentPhone) {
    return res.status(400).json({
      error: 'Parent or guardian contact is required for minors',
    });
  }

  const state = readData();
  const existingUser = state.users.find(
    (storedUser) => normalizeEmail(storedUser.email) === normalizedEmail,
  );

  if (existingUser) {
    return res.status(409).json({ error: 'Account already exists for this email' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const userId = uuid();

  const newUser = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    dob: new Date(dob).toISOString().split('T')[0],
    age,
    parentEmail,
    parentPhone,
    createdAt: now,
    pendingConsent: isMinor,
    consentedAt: isMinor ? null : now,
    consentApprover: isMinor ? null : name.trim(),
    consentChannel: isMinor ? null : 'self',
    passwordHash,
  };

  let consentToken = null;
  const consentLog = {
    id: uuid(),
    userId,
    status: isMinor ? 'pending' : 'approved',
    channel: isMinor ? (parentEmail ? 'email' : 'sms') : 'self',
    contact: isMinor ? parentEmail || parentPhone : normalizedEmail,
    createdAt: now,
    approvedAt: isMinor ? null : now,
    approverName: isMinor ? null : name.trim(),
    token: null,
  };

  if (isMinor) {
    consentToken = uuid();
    consentLog.token = consentToken;
  }

  state.users.push(newUser);
  state.consentLogs.push(consentLog);
  writeData(state);

  return res.status(201).json({
    user: sanitizeUser(newUser),
    consentRequired: isMinor,
    consentToken: consentToken || undefined,
    consentLog: publicConsentLog(consentLog),
  });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const normalizedEmail = normalizeEmail(email);
  const state = readData();
  const user = state.users.find(
    (storedUser) => normalizeEmail(storedUser.email) === normalizedEmail,
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.pendingConsent) {
    return res.status(403).json({
      error: 'Parental consent is still pending',
      pendingConsent: true,
      user: sanitizeUser(user),
    });
  }

  return res.json({
    user: sanitizeUser(user),
  });
});

app.post('/auth/consent', (req, res) => {
  const { token, approver_name: approverNameRaw } = req.body || {};
  const approverName = approverNameRaw ? String(approverNameRaw).trim() : null;

  if (!token) {
    return res.status(400).json({ error: 'Missing consent token' });
  }

  const state = readData();
  const consentLog = state.consentLogs.find((log) => log.token === token);

  if (!consentLog) {
    return res.status(404).json({ error: 'Consent request not found' });
  }

  if (consentLog.status === 'approved') {
    return res.status(409).json({ error: 'Consent already approved' });
  }

  const user = state.users.find((storedUser) => storedUser.id === consentLog.userId);
  if (!user) {
    return res
      .status(404)
      .json({ error: 'Child account not found for consent request' });
  }

  const now = new Date().toISOString();
  user.pendingConsent = false;
  user.consentedAt = now;
  user.consentApprover = approverName;
  user.consentChannel = consentLog.channel;

  consentLog.status = 'approved';
  consentLog.approvedAt = now;
  consentLog.approverName = approverName;
  consentLog.token = null;

  writeData(state);

  return res.json({
    user: sanitizeUser(user),
    consentLog: publicConsentLog(consentLog),
  });
});

app.get('/auth/consent/logs', (_req, res) => {
  const state = readData();
  return res.json({
    logs: state.consentLogs.map(publicConsentLog),
    count: state.consentLogs.length,
  });
});

app.get('/catalog/shapes', (_req, res) => {
  return res.json({ shapes: shapeCatalog });
});

app.post('/orders', (req, res) => {
  const {
    id: orderId,
    userId,
    nailSets,
    fulfillment,
    customerSizes,
    orderNotes,
    promoCode,
    status,
  } = req.body || {};

  if (!userId) {
    return res.status(400).json({ error: 'userId is required to create an order' });
  }

  const normalizedSets = Array.isArray(nailSets)
    ? nailSets
        .map((set) => normalizeNailSetPayload(set))
        .filter(Boolean)
    : [];

  if (!normalizedSets.length) {
    return res.status(400).json({ error: 'At least one nail set is required' });
  }

  const missingDesign = normalizedSets.some(
    (set) =>
      (!set.designUploads || set.designUploads.length === 0) &&
      (!set.description || set.description.length === 0) &&
      !set.requiresFollowUp,
  );

  if (missingDesign) {
    return res.status(400).json({
      error: 'Each nail set must include a design upload, description, or be marked for follow-up',
    });
  }

  try {
    const pricing = calculateOrderPricing({
      nailSets: normalizedSets,
      fulfillment,
      promoCode,
    });

    const state = readData();
    const normalizedStatus = status || 'draft';
    const now = new Date().toISOString();
    let order = orderId ? findOrderById(state, orderId) : null;
    const isNew = !order;

    if (isNew) {
      order = {
        id: uuid(),
        createdAt: now,
        userId,
      };
      state.orders.push(order);
    }

    Object.assign(order, {
      userId,
      nailSets: normalizedSets,
      fulfillment: normalizeFulfillment(fulfillment),
      customerSizes: normalizeSizesPayload(customerSizes),
      orderNotes: typeof orderNotes === 'string' ? orderNotes.trim() : '',
      promoCode: promoCode || null,
      status: normalizedStatus,
      pricing,
      updatedAt: now,
    });

    writeData(state);

    return res.status(isNew ? 201 : 200).json({
      order: sanitizeOrder(order),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const state = readData();
  const order = findOrderById(state, orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  return res.json({ order: sanitizeOrder(order) });
});

app.post('/orders/:orderId/payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({
      error: 'Stripe is not configured. Provide STRIPE_SECRET_KEY to enable payments.',
    });
  }

  const { orderId } = req.params;
  const state = readData();
  const order = findOrderById(state, orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (!order.pricing || typeof order.pricing.total !== 'number') {
    return res.status(400).json({ error: 'Order total unavailable' });
  }

  try {
    const amountInCents = Math.round(order.pricing.total * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        orderId: order.id,
        userId: order.userId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    order.paymentIntentId = paymentIntent.id;
    order.paymentIntentClientSecret = paymentIntent.client_secret;
    order.status = 'pending_payment';
    order.updatedAt = new Date().toISOString();

    writeData(state);

    return res.json({
      clientSecret: paymentIntent.client_secret,
      order: sanitizeOrder(order),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/orders/:orderId/complete', (req, res) => {
  const { orderId } = req.params;
  const { paymentIntentId } = req.body || {};
  const state = readData();
  const order = findOrderById(state, orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (paymentIntentId && order.paymentIntentId && paymentIntentId !== order.paymentIntentId) {
    return res.status(400).json({ error: 'Payment intent mismatch for this order' });
  }

  if (order.status === 'paid') {
    return res.status(200).json({ order: sanitizeOrder(order) });
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let estimated =
    order.pricing && order.pricing.estimatedCompletionDate
      ? new Date(order.pricing.estimatedCompletionDate)
      : null;
  if (!estimated || Number.isNaN(estimated.getTime())) {
    estimated = new Date(now);
    const daysToAdd =
      order.pricing && order.pricing.estimatedCompletionDays
        ? Number(order.pricing.estimatedCompletionDays)
        : 7;
    estimated.setDate(estimated.getDate() + daysToAdd);
  }

  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  order.estimatedFulfillmentDate = estimated.toISOString();
  order.updatedAt = order.paidAt;
  order.productionJobs = createProductionJobs(order);

  writeData(state);

  return res.json({
    order: sanitizeOrder(order),
  });
});

app.post('/payments/webhook', (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured.' });
  }

  let event = req.body;

  if (STRIPE_WEBHOOK_SECRET) {
    const signature = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    }
  } else if (Buffer.isBuffer(req.body)) {
    try {
      event = JSON.parse(req.body.toString('utf8'));
    } catch (err) {
      return res.status(400).send(`Unable to parse webhook payload: ${err.message}`);
    }
  }

  const state = readData();

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const order = state.orders.find((item) => item.paymentIntentId === paymentIntent.id);
    if (order) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      let estimated =
        order.pricing && order.pricing.estimatedCompletionDate
          ? new Date(order.pricing.estimatedCompletionDate)
          : null;
      if (!estimated || Number.isNaN(estimated.getTime())) {
        estimated = new Date(now);
        const daysToAdd =
          order.pricing && order.pricing.estimatedCompletionDays
            ? Number(order.pricing.estimatedCompletionDays)
            : 7;
        estimated.setDate(estimated.getDate() + daysToAdd);
      }

      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      order.estimatedFulfillmentDate = estimated.toISOString();
      order.updatedAt = order.paidAt;
      order.productionJobs = createProductionJobs(order);
      writeData(state);
    }
  }

  return res.json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Auth service listening on port ${PORT}`);
});

