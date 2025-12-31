/**
 * Utility functions for authentication
 */

/**
 * Check if a string is an email address
 * @param {string} input - Input string to check
 * @returns {boolean} True if input looks like an email
 */
export function isEmail(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }
  
  const trimmed = input.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Check if a string is a phone number
 * @param {string} input - Input string to check
 * @returns {boolean} True if input looks like a phone number
 */
export function isPhone(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }
  
  const trimmed = input.trim();
  
  // Remove common phone number formatting characters
  const cleaned = trimmed.replace(/[\s\-\(\)\.]/g, '');
  
  // Check if it's all digits (US format: 10 digits) or E.164 format (+ followed by digits)
  const phoneRegex = /^(\+?1?)?[2-9]\d{2}[2-9]\d{2}\d{4}$|^\+\d{1,14}$/;
  
  // Also accept if it starts with + and has 10+ digits
  if (cleaned.startsWith('+')) {
    return /^\+\d{10,14}$/.test(cleaned);
  }
  
  // US format: 10 digits or 11 digits starting with 1
  if (/^\d{10}$/.test(cleaned)) {
    return true;
  }
  
  if (/^1\d{10}$/.test(cleaned)) {
    return true;
  }
  
  return false;
}

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Phone number in various formats
 * @returns {string} Phone number in E.164 format (+1234567890)
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return phone;
  }
  
  const trimmed = phone.trim();
  
  // If already in E.164 format, return as is
  if (trimmed.startsWith('+') && /^\+\d{10,14}$/.test(trimmed.replace(/[\s\-\(\)\.]/g, ''))) {
    return trimmed.replace(/[\s\-\(\)\.]/g, '');
  }
  
  // Remove all non-digit characters
  const digits = trimmed.replace(/\D/g, '');
  
  // If 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If already has + prefix, return as is (after cleaning)
  if (trimmed.startsWith('+')) {
    return trimmed.replace(/[\s\-\(\)\.]/g, '');
  }
  
  // Otherwise, try to add +1 for US numbers
  if (digits.length >= 10) {
    return `+1${digits.slice(-10)}`;
  }
  
  // Fallback: return cleaned input with + prefix
  return `+${digits}`;
}

/**
 * Format phone number for display
 * @param {string} phone - Phone number in E.164 format
 * @returns {string} Formatted phone number for display
 */
export function formatPhoneForDisplay(phone) {
  if (!phone || typeof phone !== 'string') {
    return phone;
  }
  
  // Remove + and extract digits
  const digits = phone.replace(/\D/g, '');
  
  // US format: (XXX) XXX-XXXX
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const number = digits.slice(7);
    return `(${area}) ${exchange}-${number}`;
  }
  
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const exchange = digits.slice(3, 6);
    const number = digits.slice(6);
    return `(${area}) ${exchange}-${number}`;
  }
  
  // For other formats, return with + prefix if missing
  if (phone.startsWith('+')) {
    return phone;
  }
  
  return `+${digits}`;
}

