-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 006: Add email to profiles
-- Required for enclave invite-by-email (Option A).
-- Run in Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add email column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Populate email for all existing profiles from auth.users
UPDATE profiles
SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id
  AND profiles.email IS NULL;

-- 3. Index for fast invite lookup
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email);
