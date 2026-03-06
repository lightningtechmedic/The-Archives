-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 003b: Smart Board columns
-- Run this in Supabase SQL Editor BEFORE deploying the smart board.
-- ═══════════════════════════════════════════════════════════════

-- stickies: smart detection storage
ALTER TABLE stickies ADD COLUMN IF NOT EXISTS tags          TEXT[]    DEFAULT '{}';
ALTER TABLE stickies ADD COLUMN IF NOT EXISTS detected_date TIMESTAMPTZ;
ALTER TABLE stickies ADD COLUMN IF NOT EXISTS note_link_id  UUID      REFERENCES notes(id) ON DELETE SET NULL;
ALTER TABLE stickies ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

-- sticky_columns: column types + emoji
ALTER TABLE sticky_columns ADD COLUMN IF NOT EXISTS type  TEXT DEFAULT 'freeform'
  CHECK (type IN ('freeform','pipeline','date-sorted','priority','archive'));
ALTER TABLE sticky_columns ADD COLUMN IF NOT EXISTS emoji TEXT;

-- Index for tag filtering
CREATE INDEX IF NOT EXISTS idx_stickies_tags ON stickies USING GIN (tags);
