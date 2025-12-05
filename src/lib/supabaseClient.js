import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_ANON_KEY, SUPABASE_URL, ENV_INFO } from '../config/env';

// Log environment info for debugging (works in production too)
console.log('[supabase] Environment check:', {
  hasUrl: !!SUPABASE_URL,
  hasKey: !!SUPABASE_ANON_KEY,
  urlLength: SUPABASE_URL?.length || 0,
  keyLength: SUPABASE_ANON_KEY?.length || 0,
  envInfo: ENV_INFO,
});

if (!SUPABASE_URL) {
  const errorMsg = 'Supabase URL is not set. Ensure SUPABASE_URL is defined in your environment configuration. Check that .env.production (for Archive) or .env.development (for Debug) exists and contains SUPABASE_URL.';
  console.error('[supabase] ❌', errorMsg);
  console.error('[supabase] ENV_INFO:', ENV_INFO);
  throw new Error(errorMsg);
}

if (!SUPABASE_ANON_KEY) {
  const errorMsg = 'Supabase anon key is not set. Ensure SUPABASE_ANON_KEY is defined in your environment configuration. Check that .env.production (for Archive) or .env.development (for Debug) exists and contains SUPABASE_ANON_KEY.';
  console.error('[supabase] ❌', errorMsg);
  console.error('[supabase] ENV_INFO:', ENV_INFO);
  throw new Error(errorMsg);
}

// Ensure URL doesn't have trailing slash and is valid
const supabaseUrl = SUPABASE_URL.trim().replace(/\/$/, '');
const supabaseKey = SUPABASE_ANON_KEY.trim();

if (__DEV__) {
  console.log('[supabase] Initializing client...');
  console.log('[supabase] URL:', supabaseUrl.substring(0, 40) + '...');
  console.log('[supabase] Key length:', supabaseKey.length);
  console.log('[supabase] Key starts with:', supabaseKey.substring(0, 20) + '...');
}

// Use React Native's native platform fetch implementation
// This ensures we use the platform's native networking (URLSession on iOS, OkHttp on Android)
// Note: URLSession on iOS simulator can still attempt QUIC if server advertises it
// This is a known iOS simulator limitation that can't be fully disabled from JavaScript
const baseFetch = global.fetch.bind(global);

// Detect if we're running in iOS simulator
// iOS simulator has known QUIC/HTTP-3 connection issues with Supabase
// In simulator, we'll implement a skip mechanism after QUIC failures
const isIOSSimulator = __DEV__ && Platform.OS === 'ios';

if (__DEV__) {
  console.log('[supabase] Using React Native native fetch implementation (global.fetch)');
  console.log('[supabase] Platform:', Platform.OS === 'ios' ? 'iOS (URLSession)' : 'Android (OkHttp)');
  if (isIOSSimulator) {
    console.warn('[supabase] ⚠️  Running in iOS simulator - QUIC/HTTP-3 issues may occur');
    console.warn('[supabase] 💡 This is a known iOS simulator limitation');
    console.warn('[supabase] 💡 Supabase sync will skip after QUIC failures to allow app to continue working');
  }
}

// Wrap base fetch with retry logic for QUIC/HTTP3 issues in iOS simulator
// iOS simulator often has issues with QUIC connections, so we add retry logic with longer delays
// Note: We cannot prevent QUIC negotiation from JavaScript - it's an OS-level URLSession decision
// The retry logic helps with transient failures, but QUIC will still be attempted by the OS
const fetchWithRetry = async (url, options = {}) => {
  // In iOS simulator, reduce retries to fail faster so the graceful skip kicks in sooner
  // On physical devices, keep more retries for transient network issues
  const maxRetries = isIOSSimulator ? 3 : 5;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (__DEV__) {
        console.log(`[supabase] Fetch attempt ${attempt}/${maxRetries} for:`, url.substring(0, 60) + '...');
        if (isIOSSimulator && attempt === 1) {
          console.log('[supabase] ⚠️  iOS Simulator: QUIC may be attempted by URLSession (OS-level decision)');
          console.log('[supabase] 💡 If QUIC fails, retries will be attempted, then graceful skip will activate');
        }
      }

      // Note: We don't add cache-busting query parameters because:
      // 1. Supabase's PostgREST API tries to parse all query params as filters
      // 2. With Proxyman, QUIC issues should be resolved anyway
      // 3. Connection reset headers are sufficient for connection reuse issues
      // Use the original URL without modification
      const requestUrl = url;

      // Properly handle headers - convert Headers object to plain object if needed
      // This ensures all headers (including apikey) are preserved
      // React Native fetch accepts plain objects, but Supabase might pass Headers objects
      let headersObj = {};
      if (options.headers) {
        // Check if it's a Headers object (has forEach method)
        if (options.headers.forEach && typeof options.headers.forEach === 'function') {
          // Convert Headers object to plain object
          options.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
        } else if (typeof options.headers === 'object' && options.headers !== null) {
          // Already a plain object, copy all properties
          // Use Object.assign to ensure we get all enumerable and non-enumerable properties
          headersObj = Object.assign({}, options.headers);
          // Also try spreading in case Object.assign missed something
          headersObj = { ...headersObj, ...options.headers };
        }
      }

      // Debug: Log headers to verify apikey is present
      if (__DEV__ && attempt === 1) {
        const headerKeys = Object.keys(headersObj);
        console.log('[supabase] Original headers count:', headerKeys.length);
        console.log('[supabase] Original headers keys:', headerKeys);
        console.log('[supabase] Has apikey header:', 'apikey' in headersObj || 'Apikey' in headersObj || 'APIKEY' in headersObj);
        if ('apikey' in headersObj || 'Apikey' in headersObj || 'APIKEY' in headersObj) {
          const key = 'apikey' in headersObj ? 'apikey' : ('Apikey' in headersObj ? 'Apikey' : 'APIKEY');
          console.log('[supabase] apikey header length:', headersObj[key]?.length || 0);
          console.log('[supabase] apikey header starts with:', headersObj[key]?.substring(0, 20) || 'N/A');
        } else {
          console.warn('[supabase] ⚠️  No apikey header found in request!');
          console.warn('[supabase] ⚠️  This will cause authentication errors');
        }
      }

      // Add our connection reset headers (but don't overwrite existing ones)
      const newHeaders = {
        ...headersObj, // Spread original headers first
        'Connection': headersObj['Connection'] || headersObj['connection'] || 'close', // Only set if not already present
        'Cache-Control': headersObj['Cache-Control'] || headersObj['cache-control'] || 'no-cache', // Only set if not already present
      };

      // Create new options with properly merged headers
      // Note: These headers can't prevent QUIC negotiation, but help with connection reuse
      const newOptions = {
        ...options,
        headers: newHeaders,
      };

      // Add timeout if no signal is provided
      // Use longer timeout for order operations (which may contain large base64 images)
      // Check if this is an order-related operation by looking at the URL
      const isOrderOperation = url.includes('/rest/v1/orders') || url.includes('/rest/v1/order_sets');
      const timeoutDuration = isOrderOperation ? 120000 : 15000; // 120 seconds for orders, 15 seconds for others
      
      if (!options.signal) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          if (__DEV__ && isOrderOperation) {
            console.warn('[supabase] ⚠️  Order operation timeout - request taking longer than 120 seconds');
            console.warn('[supabase] 💡 This usually happens with large base64 image payloads');
            console.warn('[supabase] 💡 Consider: compressing images, using Supabase Storage, or reducing image count');
          }
          controller.abort();
        }, timeoutDuration);
        newOptions.signal = controller.signal;
        // Store timeoutId to clear if request succeeds quickly
        newOptions._timeoutId = timeoutId;
      }

      // Use native platform fetch (global.fetch) with original URL
      // URLSession on iOS will still negotiate QUIC if server advertises it (OS-level decision)
      // With Proxyman, QUIC should work properly, so we don't need cache-busting
      const response = await baseFetch(requestUrl, newOptions);
      
      // Clear timeout if it was set
      if (newOptions._timeoutId) {
        clearTimeout(newOptions._timeoutId);
      }
      
      if (__DEV__ && attempt > 1) {
        console.log(`[supabase] ✅ Fetch succeeded on attempt ${attempt}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      // Check if it's a QUIC/network connection error
      const isNetworkError = 
        error.message?.includes('Network request failed') ||
        error.message?.includes('connection was lost') ||
        error.message?.includes('Socket is not connected') ||
        error.message?.includes('AbortError') ||
        (error.code === -1005); // NSURLErrorNetworkConnectionLost

      if (isNetworkError && attempt < maxRetries) {
        // In simulator, fail faster to trigger graceful skip sooner
        // On physical devices, use longer backoff for transient issues
        const baseWaitTime = isIOSSimulator ? 1000 : 2000;
        const waitTime = Math.min(baseWaitTime * Math.pow(2, attempt - 1), isIOSSimulator ? 4000 : 10000);
        
        if (__DEV__) {
          console.log(`[supabase] ⚠️ QUIC/Network error on attempt ${attempt}, retrying in ${waitTime}ms...`);
          if (isIOSSimulator) {
            console.log(`[supabase] 💡 iOS Simulator QUIC issue - After ${maxRetries} failures, Supabase sync will be skipped`);
          } else {
            console.log(`[supabase] 💡 Network error - Retrying...`);
          }
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Small additional delay to let the connection fully reset
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // If it's not a network error or we've exhausted retries, throw
      throw error;
    }
  }

  // If we get here, all retries failed
  if (__DEV__) {
    console.error('[supabase] ❌ All fetch attempts failed');
    if (isIOSSimulator) {
      console.error('[supabase] 💡 iOS Simulator QUIC limitation detected');
      console.error('[supabase] 💡 The graceful skip mechanism will now skip Supabase sync');
      console.error('[supabase] 💡 App will continue working with local backend');
    } else {
      console.error('[supabase] 💡 Network connection failed. Solutions:');
      console.error('[supabase] 💡   1. Check internet connection');
      console.error('[supabase] 💡   2. Verify Supabase URL');
      console.error('[supabase] 💡   3. Restart app');
    }
  }
  throw lastError;
};

// Create Supabase client with React Native configuration
// Note: Using simpler config first to avoid URL protocol issues
const supabaseConfig = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Disable realtime for React Native to avoid WebSocket issues
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  // Explicitly use React Native's native platform fetch implementation
  // This ensures we use URLSession (iOS) / OkHttp (Android) instead of any default that might use QUIC/HTTP-3
  // The retry wrapper handles simulator QUIC issues while maintaining full performance on physical devices
  global: {
    fetch: fetchWithRetry,
  },
};

if (__DEV__) {
  console.log('[supabase] Creating client with config:', JSON.stringify(supabaseConfig, null, 2));
}

let supabaseClient;

try {
  // Validate URL format before creating client
  if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
    throw new Error(`Invalid Supabase URL format: ${supabaseUrl}. URL must start with http:// or https://`);
  }

  if (__DEV__) {
    console.log('[supabase] URL validation passed');
  }

  // Log the exact URL being used
  if (__DEV__) {
    console.log('[supabase] Creating client with URL:', supabaseUrl);
    console.log('[supabase] Full URL (for debugging):', supabaseUrl);
  }
  
  supabaseClient = createClient(supabaseUrl, supabaseKey, supabaseConfig);
  
  // Store the URL on the client for debugging
  if (supabaseClient) {
    supabaseClient.supabaseUrl = supabaseUrl;
  }
  
  if (__DEV__) {
    console.log('[supabase] ✅ Client created successfully');
    console.log('[supabase] Client type:', typeof supabaseClient);
    console.log('[supabase] Client is object:', typeof supabaseClient === 'object' && supabaseClient !== null);
    
    if (supabaseClient) {
      const clientKeys = Object.keys(supabaseClient);
      console.log('[supabase] Client has keys:', clientKeys.length);
      console.log('[supabase] Client methods:', clientKeys.slice(0, 15));
      console.log('[supabase] Has .from:', typeof supabaseClient.from === 'function');
      console.log('[supabase] Has .auth:', typeof supabaseClient.auth === 'object');
      console.log('[supabase] Has .storage:', typeof supabaseClient.storage === 'object');
      console.log('[supabase] Client URL (stored):', supabaseClient.supabaseUrl || 'not stored');
    } else {
      console.error('[supabase] ❌ Client is null or undefined');
    }
  }
} catch (error) {
  console.error('[supabase] ❌ Error creating client:');
  console.error('[supabase] Error message:', error.message);
  console.error('[supabase] Error name:', error.name);
  console.error('[supabase] Error stack:', error.stack);
  if (error.cause) {
    console.error('[supabase] Error cause:', error.cause);
  }
  throw error;
}

if (!supabaseClient) {
  const error = new Error('Failed to create Supabase client - client is undefined');
  console.error('[supabase] ❌', error.message);
  throw error;
}

export const supabase = supabaseClient;

