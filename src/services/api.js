import { Platform } from 'react-native';

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

