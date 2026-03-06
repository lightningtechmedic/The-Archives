-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 003: Stickies (Complete)
-- Single source of truth. Replaces 003_stickies.sql and 003b_stickies_smart.sql.
-- Run this in Supabase SQL Editor. Safe to run on a fresh or existing database.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sticky_columns (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL DEFAULT 'New Column',
  position   INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stickies (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  column_id      UUID        REFERENCES sticky_columns(id) ON DELETE SET NULL,
  content        TEXT        NOT NULL DEFAULT '',
  color          TEXT        DEFAULT 'paper' CHECK (color IN ('ember','gold','cyan','paper','charcoal')),
  rotation       FLOAT       DEFAULT 0,
  position       INTEGER     DEFAULT 0,
  source_type    TEXT        DEFAULT 'manual' CHECK (source_type IN ('manual','lattice','note')),
  source_note_id UUID        REFERENCES notes(id) ON DELETE SET NULL,
  shared_with    UUID[]      DEFAULT '{}',
  sketch_svg     TEXT,
  tags           TEXT[]      DEFAULT '{}',
  detected_date  TIMESTAMPTZ,
  note_link_id   UUID        REFERENCES notes(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Smart board columns (safe to run on existing tables)
ALTER TABLE sticky_columns
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'freeform'
    CHECK (type IN ('freeform','pipeline','date-sorted','priority','archive')),
  ADD COLUMN IF NOT EXISTS emoji TEXT;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE stickies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sticky_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own stickies" ON stickies;
CREATE POLICY "users manage own stickies" ON stickies
  FOR ALL USING (
    user_id = auth.uid()
    OR auth.uid() = ANY(shared_with)
  );

DROP POLICY IF EXISTS "users manage own columns" ON sticky_columns;
CREATE POLICY "users manage own columns" ON sticky_columns
  FOR ALL USING (user_id = auth.uid());

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_stickies_user    ON stickies (user_id);
CREATE INDEX IF NOT EXISTS idx_stickies_column  ON stickies (column_id);
CREATE INDEX IF NOT EXISTS idx_stickies_tags    ON stickies USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_columns_user     ON sticky_columns (user_id);
