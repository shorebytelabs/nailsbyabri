# Supabase Setup Guide

This guide will help you configure Supabase for the Nails by Abri app.

## Problem: "Network request failed" when syncing profiles

If you're seeing "Network request failed" errors when trying to sync profiles to Supabase, this is likely because **Row Level Security (RLS)** is blocking the requests.

## Quick Fix: Disable RLS for Testing

For quick testing, you can temporarily disable RLS on all tables:

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `docs/supabase-disable-rls-for-testing.sql`
4. Click **Run**
5. Try logging in again - profile sync should work

⚠️ **Warning**: This disables all security. Only use for development/testing!

## Proper Fix: Add RLS Policies

For a more secure setup (recommended):

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `docs/supabase-rls-policies.sql`
4. Click **Run**
5. Try logging in again - profile sync should work

This creates policies that allow anonymous users to insert/update/read their own data.

## Verify It's Working

After running one of the SQL scripts above:

1. Log in to the app
2. Check the logs - you should see:
   ```
   [supabase] ✅ Profile upserted successfully: <user-id>
   ```
3. Check Supabase dashboard:
   - Go to **Table Editor**
   - Open the `profiles` table
   - You should see your profile record

## Testing Profile Creation

1. Log in with an existing account or create a new account
2. The app will automatically try to sync the profile to Supabase
3. Check the logs for success/error messages
4. Verify in Supabase dashboard that the profile was created

## Next Steps

Once profile syncing is working:

1. **Test nail size profiles** - Create/edit nail sizes in the Profile tab
2. **Test orders** - Create an order and verify it syncs to Supabase
3. **Monitor logs** - Check for any errors during operations

## Troubleshooting

### Still seeing "Network request failed"?

1. **Check your Supabase URL and key**:
   - Verify `.env.development` has correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - Make sure there are no extra spaces or quotes

2. **Check Supabase dashboard**:
   - Verify your project is active (not paused)
   - Check if RLS is enabled on tables
   - Check if policies exist

3. **Check network connectivity**:
   - Try accessing your Supabase URL in a browser
   - Check if iOS simulator has internet access

4. **Check logs**:
   - Look for detailed error messages in Xcode console or Metro logs
   - The improved error handling should show if it's RLS, network, or another issue

### RLS policies not working?

1. Make sure you ran the SQL in the **SQL Editor** (not in a migration)
2. Check if policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```
3. Verify RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
   ```

### Profile not appearing in Supabase?

1. Check the logs for errors
2. Verify the profile data is being sent (check logs for `[supabase] Upserting profile:`)
3. Check Supabase dashboard for the profile record
4. Try manually inserting a profile via SQL Editor to test

## Production Considerations

For production, you should:

1. **Migrate to Supabase Auth** - Use Supabase's authentication instead of local backend
2. **Create user-specific policies** - Limit access to users' own data:
   ```sql
   CREATE POLICY "Users can read their own profiles"
   ON profiles
   FOR SELECT
   TO authenticated
   USING (auth.uid() = id);
   ```
3. **Add admin policies** - Allow admins to access all data
4. **Disable anonymous access** - Remove or restrict anonymous policies

## Files

- `docs/supabase-disable-rls-for-testing.sql` - Quick fix: Disable RLS
- `docs/supabase-rls-policies.sql` - Proper fix: Add RLS policies
- `src/services/supabaseService.js` - Supabase service functions
- `src/lib/supabaseClient.js` - Supabase client configuration

## Support

If you're still having issues:

1. Check the logs for detailed error messages
2. Verify your Supabase project settings
3. Test with a simple SQL query in Supabase SQL Editor
4. Check Supabase documentation: https://supabase.com/docs

