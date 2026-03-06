-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 002b: Fix enclave_members RLS recursion
-- Run this in Supabase SQL Editor to fix the infinite recursion error.
--
-- Root cause: the original enclave_members policies queried
-- enclave_members inside their own USING/CHECK clauses, causing
-- Postgres to recurse infinitely when evaluating them.
--
-- Fix: use enclaves.created_by to establish ownership instead of
-- self-referencing enclave_members.
-- ═══════════════════════════════════════════════════════════════

-- Drop all recursive policies on enclave_members
DROP POLICY IF EXISTS "enclave_members_select" ON enclave_members;
DROP POLICY IF EXISTS "enclave_members_insert" ON enclave_members;
DROP POLICY IF EXISTS "enclave_members_delete" ON enclave_members;

-- Also drop any policies created under the names used in the bug report
DROP POLICY IF EXISTS "members can view enclave members" ON enclave_members;
DROP POLICY IF EXISTS "owners can manage members"        ON enclave_members;
DROP POLICY IF EXISTS "users can join via invite"        ON enclave_members;
DROP POLICY IF EXISTS "users can insert themselves"      ON enclave_members;

-- ── Replacement policies — zero self-reference ────────────────────────────────

-- SELECT: user can see their own membership row, or all rows in enclaves they created
CREATE POLICY "enclave_members_select" ON enclave_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR enclave_id IN (
      SELECT id FROM enclaves WHERE created_by = auth.uid()
    )
  );

-- INSERT: users can insert themselves; enclave creators can insert anyone
CREATE POLICY "enclave_members_insert" ON enclave_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR enclave_id IN (
      SELECT id FROM enclaves WHERE created_by = auth.uid()
    )
  );

-- DELETE: members can remove themselves; creators can remove anyone
CREATE POLICY "enclave_members_delete" ON enclave_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR enclave_id IN (
      SELECT id FROM enclaves WHERE created_by = auth.uid()
    )
  );
