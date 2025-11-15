import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/env';

if (!SUPABASE_URL) {
  throw new Error('Supabase URL is not set. Ensure SUPABASE_URL is defined in your environment configuration.');
}

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase anon key is not set. Ensure SUPABASE_ANON_KEY is defined in your environment configuration.',
  );
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

// Create a custom fetch function that handles QUIC/HTTP3 issues in iOS simulator
// iOS simulator often has issues with QUIC connections, so we add retry logic with longer delays
const customFetch = async (url, options = {}) => {
  const maxRetries = 5; // Increased retries
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (__DEV__) {
        console.log(`[supabase] Fetch attempt ${attempt}/${maxRetries} for:`, url.substring(0, 60) + '...');
      }

      // Add a cache-busting query parameter to force a new connection
      // This helps avoid reusing the broken QUIC connection
      const separator = url.includes('?') ? '&' : '?';
      const cacheBustUrl = `${url}${separator}_cb=${Date.now()}_${attempt}`;

      // Create new options with connection reset headers
      const newOptions = {
        ...options,
        headers: {
          ...options.headers,
          'Connection': 'close', // Force connection close to avoid QUIC reuse
          'Cache-Control': 'no-cache',
        },
      };

      // Add timeout if no signal is provided
      if (!options.signal) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout per attempt
        newOptions.signal = controller.signal;
        // Store timeoutId to clear if request succeeds quickly
        newOptions._timeoutId = timeoutId;
      }

      // Use native fetch with cache-busted URL
      const response = await fetch(cacheBustUrl, newOptions);
      
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
        // Longer wait times with exponential backoff to give QUIC connection time to reset
        const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // 2s, 4s, 8s, 10s
        if (__DEV__) {
          console.log(`[supabase] ⚠️ QUIC/Network error on attempt ${attempt}, retrying in ${waitTime}ms...`);
          console.log(`[supabase] 💡 This is likely an iOS simulator QUIC issue. Consider testing on a physical device.`);
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
    console.error('[supabase] 💡 This is a known iOS simulator QUIC issue. Solutions:');
    console.error('[supabase] 💡   1. Test on a physical iOS device (recommended)');
    console.error('[supabase] 💡   2. Restart the iOS simulator');
    console.error('[supabase] 💡   3. Try a different network/WiFi');
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
  // Use custom fetch to avoid QUIC/HTTP3 issues in iOS simulator
  global: {
    fetch: customFetch,
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

