-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 007: Ted budget fields + build_log table
-- Ted is the fifth Lattice mind — a budget estimator and financial
-- gatekeeper that intercepts build requests before they ship.
-- Run in Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add budget columns to enclaves
ALTER TABLE enclaves ADD COLUMN IF NOT EXISTS budget_cents INTEGER DEFAULT NULL;
ALTER TABLE enclaves ADD COLUMN IF NOT EXISTS budget_period TEXT DEFAULT 'monthly'
  CHECK (budget_period IN ('monthly', 'project', 'unlimited'));

-- 2. Build log table
CREATE TABLE IF NOT EXISTS build_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enclave_id UUID REFERENCES enclaves(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  estimated_cost_cents INTEGER,
  actual_cost_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  ted_reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE build_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enclave members read build_log" ON build_log
  FOR SELECT USING (
    enclave_id IN (
      SELECT enclave_id FROM enclave_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "enclave members insert build_log" ON build_log
  FOR INSERT WITH CHECK (
    enclave_id IN (
      SELECT enclave_id FROM enclave_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "build log update" ON build_log
  FOR UPDATE USING (
    user_id = auth.uid()
    OR enclave_id IN (
      SELECT enclave_id FROM enclave_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- 4. Index for fast history lookup
CREATE INDEX IF NOT EXISTS build_log_enclave_idx ON build_log (enclave_id, created_at DESC);
