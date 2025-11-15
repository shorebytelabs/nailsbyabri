# Troubleshooting Supabase Connection Issues

## Problem: "Network request failed" with HTTP status 0

If you're seeing "Network request failed" errors with HTTP status 0, this means the request isn't even reaching the Supabase server. This is different from RLS errors (which would return 401/403).

## Quick Checklist

1. **Verify Supabase URL and Key are set**
   - Check `.env.development` file
   - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are present
   - Make sure there are no extra spaces or quotes

2. **Check iOS Simulator Internet Connection**
   - Open Safari in the iOS simulator
   - Try visiting https://google.com
   - If Safari can't load pages, the simulator has no internet

3. **Verify Supabase URL is accessible**
   - Open your Supabase URL in a browser: `https://YOUR_PROJECT.supabase.co`
   - You should see the Supabase API documentation page
   - If it doesn't load, check if your Supabase project is active (not paused)

4. **Check iOS App Transport Security**
   - Verify `Info.plist` allows HTTPS connections
   - Current setting: `NSAllowsArbitraryLoads: false` (good for security)
   - This should allow HTTPS to Supabase

5. **Test with RLS disabled**
   - Run `docs/supabase-disable-rls-for-testing.sql` in Supabase SQL Editor
   - Try creating a profile again
   - If it works, the issue is RLS policies

## Step-by-Step Debugging

### Step 1: Check Environment Variables

Look at the logs when the app starts. You should see:
```
[env] ✅ Supabase configuration loaded successfully
[env]   SUPABASE_URL: https://xxxxx.supabase.co...
[env]   SUPABASE_ANON_KEY: eyJxxx... (SET)
```

If you see "NOT SET", check:
- `.env.development` file exists
- File is in the project root (not in `ios/` or `src/`)
- Values don't have quotes around them
- You've rebuilt the app after changing `.env.development`

### Step 2: Test Connection

When you try to create a profile, check the logs for:
```
[supabase] 🔍 Testing connection to: https://xxxxx.supabase.co/rest/v1/
[supabase] 🔍 Test response status: 200 (or 401/404 - any response means server is reachable)
```

If you see:
- `Network request failed` → Network connectivity issue
- `Request timed out` → Server might be unreachable or slow
- `401` or `404` → Server is reachable, but request failed (might be RLS)

### Step 3: Verify Supabase Project Status

1. Go to your Supabase dashboard
2. Check if the project is active (not paused)
3. Check the project URL matches your `.env.development` file
4. Verify the anon key matches

### Step 4: Test with Browser

1. Open your browser
2. Go to: `https://YOUR_PROJECT.supabase.co/rest/v1/profiles?select=id&limit=1`
3. You should see either:
   - JSON response (if RLS allows it)
   - Error message (but connection works)
   - Timeout/connection error (network issue)

### Step 5: Test with RLS Disabled

1. Open Supabase SQL Editor
2. Run: `ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;`
3. Try creating a profile again
4. If it works, re-enable RLS and add proper policies

## Common Issues and Solutions

### Issue 1: iOS Simulator Has No Internet

**Symptoms:**
- "Network request failed" errors
- Safari in simulator can't load pages
- HTTP status 0

**Solution:**
1. Check your Mac's internet connection
2. Restart the iOS simulator
3. Reset simulator: Device → Erase All Content and Settings
4. Check if you're behind a corporate firewall/proxy

### Issue 2: Supabase Project is Paused

**Symptoms:**
- Connection timeouts
- URL doesn't load in browser

**Solution:**
1. Go to Supabase dashboard
2. Check if project shows "Paused" status
3. Resume the project if paused
4. Wait a few minutes for it to fully start

### Issue 3: Incorrect URL Format

**Symptoms:**
- "Invalid URL" errors
- Connection fails immediately

**Solution:**
1. Verify URL format: `https://xxxxx.supabase.co` (no trailing slash)
2. Check for extra spaces or quotes
3. Make sure it starts with `https://`

### Issue 4: RLS Blocking Requests

**Symptoms:**
- HTTP status 401 or 403
- "permission denied" errors
- Or "Network request failed" (sometimes RLS errors appear as network errors)

**Solution:**
1. Run `docs/supabase-rls-policies.sql` in Supabase SQL Editor
2. Or temporarily disable RLS: `ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;`
3. Test again

### Issue 5: Environment Variables Not Loading

**Symptoms:**
- Logs show "NOT SET" for URL or key
- App builds but can't connect

**Solution:**
1. Verify `.env.development` is in project root
2. Check file doesn't have BOM or special characters
3. Rebuild the app (clean build folder)
4. Check Xcode build logs for env file loading

## Testing the Connection

After fixing the issue, test by:

1. **Log in to the app**
2. **Check logs for:**
   ```
   [supabase] ✅ Profile upserted successfully: <user-id>
   ```
3. **Check Supabase dashboard:**
   - Go to Table Editor
   - Open `profiles` table
   - Verify your profile exists

## Still Having Issues?

If you've tried all the above and still have issues:

1. **Check the detailed logs** - The improved logging should show exactly where it's failing
2. **Test with a simple fetch** - Try fetching the Supabase URL directly in the app
3. **Check Supabase status** - Visit https://status.supabase.com
4. **Verify your Supabase plan** - Free tier projects can be paused after inactivity

## Next Steps

Once connection is working:

1. **Enable RLS** - Re-enable Row Level Security
2. **Add proper policies** - Run `docs/supabase-rls-policies.sql`
3. **Test profile creation** - Create a new profile and verify it syncs
4. **Test profile updates** - Update a profile and verify it syncs
5. **Monitor logs** - Watch for any errors during operations

