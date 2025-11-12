import { Platform } from 'react-native';
import shapeCatalog from '../../shared/catalog/shapes.json';

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

export async function signup(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      dob: payload.dob,
      parent_email: payload.parentEmail,
      parent_phone: payload.parentPhone,
    }),
  });
  return handleResponse(response);
}

export async function login(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function submitConsent(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: payload.token,
      approver_name: payload.approverName,
    }),
  });
  return handleResponse(response);
}

export async function fetchConsentLogs() {
  const response = await fetch(`${API_BASE_URL}/auth/consent/logs`);
  const data = await handleResponse(response);
  return data.logs;
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

export async function createOrUpdateOrder(orderPayload) {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  });
  return handleResponse(response);
}

export async function createPaymentIntent(orderId) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/payment-intent`, {
    method: 'POST',
  });
  return handleResponse(response);
}

export async function completeOrder(orderId, payload = {}) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function fetchOrder(orderId) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`);
  return handleResponse(response);
}

export async function fetchOrders(params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && String(value).length)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const response = await fetch(`${API_BASE_URL}/orders${query ? `?${query}` : ''}`);
  return handleResponse(response);
}

export async function updateOrder(orderId, payload) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

