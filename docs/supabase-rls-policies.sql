-- ============================================================================
-- RLS POLICIES FOR NAILS BY ABRI
-- ============================================================================
-- 
-- This file contains Row Level Security (RLS) policies for Supabase tables.
-- Run these in the Supabase SQL Editor to enable database access.
--
-- IMPORTANT: These policies allow anonymous access for testing.
-- For production, you should use Supabase Auth and create more restrictive policies.
--
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow anonymous profile inserts" ON profiles;
DROP POLICY IF EXISTS "Allow anonymous profile updates" ON profiles;
DROP POLICY IF EXISTS "Allow anonymous profile reads" ON profiles;

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert profiles (for signup)
CREATE POLICY "Allow anonymous profile inserts"
ON profiles
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow anyone to update profiles (for profile updates)
CREATE POLICY "Allow anonymous profile updates"
ON profiles
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Policy: Allow anyone to read profiles
CREATE POLICY "Allow anonymous profile reads"
ON profiles
FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- NAIL SIZE PROFILES TABLE
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous nail size profile inserts" ON nail_size_profiles;
DROP POLICY IF EXISTS "Allow anonymous nail size profile updates" ON nail_size_profiles;
DROP POLICY IF EXISTS "Allow anonymous nail size profile reads" ON nail_size_profiles;
DROP POLICY IF EXISTS "Allow anonymous nail size profile deletes" ON nail_size_profiles;

-- Enable RLS on nail_size_profiles table
ALTER TABLE nail_size_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert nail size profiles
CREATE POLICY "Allow anonymous nail size profile inserts"
ON nail_size_profiles
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow anyone to update nail size profiles
CREATE POLICY "Allow anonymous nail size profile updates"
ON nail_size_profiles
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Policy: Allow anyone to read nail size profiles
CREATE POLICY "Allow anonymous nail size profile reads"
ON nail_size_profiles
FOR SELECT
TO anon
USING (true);

-- Policy: Allow anyone to delete nail size profiles
CREATE POLICY "Allow anonymous nail size profile deletes"
ON nail_size_profiles
FOR DELETE
TO anon
USING (true);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous order inserts" ON orders;
DROP POLICY IF EXISTS "Allow anonymous order updates" ON orders;
DROP POLICY IF EXISTS "Allow anonymous order reads" ON orders;

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert orders
CREATE POLICY "Allow anonymous order inserts"
ON orders
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow anyone to update orders (for admin updates)
CREATE POLICY "Allow anonymous order updates"
ON orders
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Policy: Allow anyone to read orders (for now, limit in production)
CREATE POLICY "Allow anonymous order reads"
ON orders
FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- ORDER SETS TABLE
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous order set inserts" ON order_sets;
DROP POLICY IF EXISTS "Allow anonymous order set reads" ON order_sets;

-- Enable RLS on order_sets table
ALTER TABLE order_sets ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert order sets
CREATE POLICY "Allow anonymous order set inserts"
ON order_sets
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow anyone to read order sets
CREATE POLICY "Allow anonymous order set reads"
ON order_sets
FOR SELECT
TO anon
USING (true);

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- These policies allow anonymous access for testing purposes.
-- 
-- For production, you should:
-- 1. Migrate to Supabase Auth for authentication
-- 2. Create policies that check auth.uid() matches the user_id
-- 3. Limit read access to users' own data
-- 4. Add admin policies for admin users
--
-- Example production policy:
-- CREATE POLICY "Users can read their own profiles"
-- ON profiles
-- FOR SELECT
-- TO authenticated
-- USING (auth.uid() = id);
--
-- ============================================================================

