-- ============================================================================
-- QUICK TEST: DISABLE RLS FOR TESTING
-- ============================================================================
-- 
-- This file disables Row Level Security on all tables for testing purposes.
-- Run this in the Supabase SQL Editor if you want to test without RLS.
--
-- WARNING: This allows anyone with your anon key to read/write all data.
-- Only use this for development/testing!
--
-- ============================================================================

-- Disable RLS on all tables (for testing only)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE nail_size_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_set_design_uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_set_sizing DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_admin_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_discounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TO RE-ENABLE RLS LATER:
-- ============================================================================
-- 
-- Run the supabase-rls-policies.sql file to re-enable RLS with proper policies.
--
-- ============================================================================

