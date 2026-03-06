-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 002c: Fix profiles RLS
-- Run ONLY if the profiles table has policies referencing enclaves
-- or enclave_members — those cause infinite recursion.
--
-- Check first:
--   SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';
--
-- If any policy's qual column contains 'enclave' — drop it and replace
-- with the safe version below.
-- ═══════════════════════════════════════════════════════════════

-- Drop any profiles policies that reference enclave tables
-- (replace 'your_policy_name' with the actual name from pg_policies)
-- DROP POLICY IF EXISTS "your_policy_name" ON profiles;

-- Safe profiles policies — no references to enclave tables

-- SELECT: users can read all profiles (needed for enclave member display)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

-- UPDATE: users can only update their own profile
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- INSERT: users can only insert their own profile
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());
