-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 010: Fix enclave_members SELECT policy
--
-- Problem: Regular members could only see their own row.
-- Owner could see all rows (via enclaves.created_by check).
-- The result: settings panel showed empty list for non-owners.
--
-- Fix: Use a SECURITY DEFINER function to check membership
-- without querying enclave_members inside its own policy
-- (which would cause infinite recursion).
-- ═══════════════════════════════════════════════════════════════

-- Helper: returns true if the calling user is a member of the given enclave.
-- SECURITY DEFINER bypasses RLS on the inner query, breaking the recursion cycle.
CREATE OR REPLACE FUNCTION is_enclave_member(enc_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enclave_members
    WHERE enclave_id = enc_id AND user_id = auth.uid()
  );
$$;

-- Replace the existing SELECT policy with one that allows any enclave member
-- to read all rows for their enclave.
DROP POLICY IF EXISTS "enclave_members_select" ON enclave_members;

CREATE POLICY "enclave_members_select" ON enclave_members
  FOR SELECT USING (
    is_enclave_member(enclave_id)
  );
