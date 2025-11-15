# Quick Fix: Disable RLS to Test Connection

Since the browser test shows Supabase is reachable, but the iOS simulator is having network issues, let's first rule out RLS as the cause.

## Step 1: Disable RLS Temporarily

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Copy and paste this SQL:

```sql
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE nail_size_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_sets DISABLE ROW LEVEL SECURITY;
```

4. Click **Run**

## Step 2: Test Profile Creation

1. Try creating a profile in the app
2. Check the logs - you should see either:
   - `[supabase] ✅ Profile upserted successfully` (success!)
   - Or the same network error (network issue, not RLS)

## Step 3: If It Works

If profile creation works with RLS disabled:
1. Re-enable RLS: `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`
2. Run the RLS policies SQL: `docs/supabase-rls-policies.sql`
3. Test again

## Step 4: If It Still Fails

If you still get network errors with RLS disabled, the issue is network connectivity in the iOS simulator, not RLS.

Try:
1. Restart the iOS simulator
2. Check if Safari in simulator can load websites
3. Reset network settings in simulator
4. Try on a physical device instead

