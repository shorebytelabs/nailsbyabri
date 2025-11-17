import Config from 'react-native-config';

if (__DEV__) {
  // Debug: Log the entire Config object to see what's available
  console.log('[env] DEBUG - Config object:', Config);
  console.log('[env] DEBUG - Config keys:', Object.keys(Config || {}));
  console.log('[env] DEBUG - Config.APP_ENV:', Config.APP_ENV);
  console.log('[env] DEBUG - Config.SUPABASE_URL:', Config.SUPABASE_URL);
  console.log('[env] DEBUG - Config.SUPABASE_ANON_KEY:', Config.SUPABASE_ANON_KEY ? 'SET (length: ' + Config.SUPABASE_ANON_KEY.length + ')' : 'NOT SET');
}

console.log('[env] Config:', Config);

export const APP_ENV = Config.APP_ENV ?? 'development';
export const SUPABASE_URL = Config.SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY ?? '';

if (__DEV__) {
  console.log('[env] Configuration loaded:');
  console.log('[env]   APP_ENV:', APP_ENV);
  console.log('[env]   SUPABASE_URL:', SUPABASE_URL ? `${SUPABASE_URL.substring(0, 30)}...` : 'NOT SET');
  console.log('[env]   SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 20)}...` : 'NOT SET');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      '[env] ⚠️  Missing Supabase configuration. Check your .env.<env> file and ensure the build command includes ENVFILE=.env.development (or equivalent).',
    );
    console.warn('[env] ⚠️  This usually means:');
    console.warn('[env] ⚠️  1. The build script didn\'t run (check Xcode build logs)');
    console.warn('[env] ⚠️  2. Pods need to be reinstalled (cd ios && pod install)');
    console.warn('[env] ⚠️  3. App needs a clean rebuild (Product → Clean Build Folder)');
  } else {
    console.log('[env] ✅ Supabase configuration loaded successfully');
  }
}

