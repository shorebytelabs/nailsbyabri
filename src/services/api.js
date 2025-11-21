import { Platform } from 'react-native';
import shapeCatalog from '../../shared/catalog/shapes.json';
import * as authService from './authService';
import { getConsentLogs } from './consentLogService';

// Legacy backend URL - only used for shapes catalog now
// Auth and orders have been migrated to Supabase
const DEFAULT_BASE_URL = 'http://localhost:4000';

const API_BASE_URL =
  Platform.select({
    android: 'http://10.0.2.2:4000',
    ios: DEFAULT_BASE_URL,
    default: DEFAULT_BASE_URL,
  }) || DEFAULT_BASE_URL;

async function handleResponse(response) {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' ? payload : { error: 'Request failed' };
    const error = new Error(errorPayload.error || 'Request failed');
    error.details = errorPayload;
    throw error;
  }

  return payload;
}

// Migrated to Supabase Auth
export async function signup(payload) {
  return authService.signup({
    email: payload.email,
    password: payload.password,
    name: payload.name,
    ageGroup: payload.ageGroup,
    consentAccepted: payload.consentAccepted || false,
  });
}

// Migrated to Supabase Auth
export async function login(payload) {
  return authService.login({
    email: payload.email,
    password: payload.password,
  });
}

// Migrated to Supabase Auth
export async function submitConsent(payload) {
  return authService.submitConsent({
    token: payload.token,
    approverName: payload.approverName,
  });
}

// Migrated to Supabase
export async function fetchConsentLogs(userId) {
  if (!userId) {
    throw new Error('User ID is required to fetch consent logs');
  }
  return getConsentLogs(userId);
}

export async function fetchShapes() {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/shapes`);
    const data = await handleResponse(response);
    if (Array.isArray(data.shapes) && data.shapes.length) {
      return data.shapes;
    }
    return shapeCatalog;
  } catch (error) {
    return shapeCatalog;
  }
}

// Migrated to Supabase
import * as orderService from './orderService';

export async function createOrUpdateOrder(orderPayload) {
  return orderService.createOrUpdateOrder(orderPayload);
}

export async function createPaymentIntent(orderId) {
  // Payment intents still need backend for Stripe secret key
  // Keep using backend endpoint for now, or set up Supabase Edge Function
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/payment-intent`, {
    method: 'POST',
  });
  return handleResponse(response);
}

export async function completeOrder(orderId, payload = {}) {
  return orderService.completeOrder(orderId, payload);
}

export async function fetchOrder(orderId) {
  return orderService.fetchOrder(orderId);
}

export async function fetchOrders(params = {}) {
  return orderService.fetchOrders(params);
}

export async function updateOrder(orderId, payload) {
  return orderService.updateOrder(orderId, payload);
}

// Migrated to Supabase
export async function deleteOrder(orderId) {
  return orderService.deleteOrder(orderId);
}

