-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 002: Enclave System
-- Run this in Supabase SQL Editor BEFORE deploying the enclave feature
-- ═══════════════════════════════════════════════════════════════

-- 1. Extend notes.visibility to allow 'enclave'
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_visibility_check;
ALTER TABLE notes ADD CONSTRAINT notes_visibility_check
  CHECK (visibility IN ('private', 'public', 'enclave'));

-- 2. Add enclave_id column to notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS enclave_id UUID;

-- 3. Create enclaves table
CREATE TABLE IF NOT EXISTS enclaves (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create enclave_members join table
CREATE TABLE IF NOT EXISTS enclave_members (
  enclave_id  UUID        NOT NULL REFERENCES enclaves(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (enclave_id, user_id)
);

-- 5. Foreign key from notes to enclaves (safe — skips if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notes_enclave_id_fkey' AND table_name = 'notes'
  ) THEN
    ALTER TABLE notes
      ADD CONSTRAINT notes_enclave_id_fkey
      FOREIGN KEY (enclave_id) REFERENCES enclaves(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Enable RLS
ALTER TABLE enclaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE enclave_members ENABLE ROW LEVEL SECURITY;

-- ── Enclaves policies ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "enclaves_select" ON enclaves;
CREATE POLICY "enclaves_select" ON enclaves
  FOR SELECT USING (
    id IN (SELECT enclave_id FROM enclave_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "enclaves_insert" ON enclaves;
CREATE POLICY "enclaves_insert" ON enclaves
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "enclaves_update" ON enclaves;
CREATE POLICY "enclaves_update" ON enclaves
  FOR UPDATE USING (
    id IN (SELECT enclave_id FROM enclave_members WHERE user_id = auth.uid() AND role = 'owner')
  );

DROP POLICY IF EXISTS "enclaves_delete" ON enclaves;
CREATE POLICY "enclaves_delete" ON enclaves
  FOR DELETE USING (
    id IN (SELECT enclave_id FROM enclave_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ── Enclave members policies ──────────────────────────────────────────────────
-- NOTE: all policies use enclaves.created_by to establish ownership.
-- Never query enclave_members inside enclave_members policies — that causes
-- infinite recursion in Postgres RLS evaluation.

-- SELECT: own row is always visible; creators see all rows in their enclaves
DROP POLICY IF EXISTS "enclave_members_select" ON enclave_members;
CREATE POLICY "enclave_members_select" ON enclave_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR enclave_id IN (
      SELECT id FROM enclaves WHERE created_by = auth.uid()
    )
  );

-- INSERT: users can insert themselves; creators can insert anyone
DROP POLICY IF EXISTS "enclave_members_insert" ON enclave_members;
CREATE POLICY "enclave_members_insert" ON enclave_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR enclave_id IN (
      SELECT id FROM enclaves WHERE created_by = auth.uid()
    )
  );

-- DELETE: members can remove themselves; creators can remove anyone
DROP POLICY IF EXISTS "enclave_members_delete" ON enclave_members;
CREATE POLICY "enclave_members_delete" ON enclave_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR enclave_id IN (
      SELECT id FROM enclaves WHERE created_by = auth.uid()
    )
  );

-- ── Notes: allow enclave members to read enclave-scoped notes ─────────────────

-- Drop and recreate if the default notes policy is too restrictive.
-- NOTE: Only run the line below if your notes table has a blanket RLS policy
-- that blocks enclave members. Skip if your notes table has no RLS or uses
-- a permissive policy that already allows this.
-- DROP POLICY IF EXISTS "notes_select" ON notes;
-- CREATE POLICY "notes_select" ON notes
--   FOR SELECT USING (
--     user_id = auth.uid()
--     OR visibility = 'public'
--     OR (visibility = 'enclave' AND enclave_id IN (
--       SELECT enclave_id FROM enclave_members WHERE user_id = auth.uid()
--     ))
--   );

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_enclave_members_user    ON enclave_members (user_id);
CREATE INDEX IF NOT EXISTS idx_enclave_members_enclave ON enclave_members (enclave_id);
CREATE INDEX IF NOT EXISTS idx_notes_enclave           ON notes (enclave_id) WHERE enclave_id IS NOT NULL;
