-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 003: Sticky Note Board
-- Run this in Supabase SQL Editor BEFORE deploying the board feature
-- ═══════════════════════════════════════════════════════════════

-- Sticky columns (user-defined, draggable)
CREATE TABLE IF NOT EXISTS sticky_columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'New Column',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Stickies
CREATE TABLE IF NOT EXISTS stickies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  column_id       UUID REFERENCES sticky_columns(id) ON DELETE SET NULL,
  content         TEXT NOT NULL DEFAULT '',
  color           TEXT DEFAULT 'paper' CHECK (color IN ('ember','gold','cyan','paper','charcoal')),
  rotation        FLOAT DEFAULT 0,
  position        INTEGER DEFAULT 0,
  source_type     TEXT DEFAULT 'manual' CHECK (source_type IN ('manual','lattice','note')),
  source_note_id  UUID REFERENCES notes(id) ON DELETE SET NULL,
  shared_with     UUID[] DEFAULT '{}',
  sketch_svg      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE sticky_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own columns" ON sticky_columns;
CREATE POLICY "users manage own columns" ON sticky_columns
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE stickies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own stickies" ON stickies;
CREATE POLICY "users manage own stickies" ON stickies
  FOR ALL USING (
    user_id = auth.uid()
    OR auth.uid() = ANY(shared_with)
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sticky_columns_user ON sticky_columns (user_id, position);
CREATE INDEX IF NOT EXISTS idx_stickies_user       ON stickies (user_id);
CREATE INDEX IF NOT EXISTS idx_stickies_column     ON stickies (column_id, position);
