-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 001: Memory Architecture
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- 1. Add visibility column to notes
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public'));

-- Migrate existing is_shared data (safe — skips if is_shared column doesn't exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'is_shared'
  ) THEN
    UPDATE notes SET visibility = 'public' WHERE is_shared = TRUE AND visibility IS DISTINCT FROM 'public';
  END IF;
END $$;

-- 2. note_collaborators — per-note invite list
CREATE TABLE IF NOT EXISTS note_collaborators (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id        UUID        NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email  TEXT        NOT NULL,
  accepted       BOOLEAN     DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE note_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "note_collaborators_access" ON note_collaborators;
CREATE POLICY "note_collaborators_access" ON note_collaborators
  FOR ALL USING (
    note_id IN (SELECT id FROM notes WHERE user_id = auth.uid())
    OR user_id = auth.uid()
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- 3. reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id       UUID        REFERENCES notes(id) ON DELETE CASCADE,
  note_title    TEXT,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phrase        TEXT        NOT NULL,
  reminder_date TIMESTAMPTZ,
  notify_all    BOOLEAN     DEFAULT FALSE,
  dismissed     BOOLEAN     DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_access" ON reminders;
CREATE POLICY "reminders_access" ON reminders
  FOR ALL USING (
    user_id = auth.uid()
    OR notify_all = TRUE
  );

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_reminders_user_date      ON reminders (user_id, reminder_date) WHERE dismissed = FALSE;
CREATE INDEX IF NOT EXISTS idx_note_collaborators_note  ON note_collaborators (note_id);
CREATE INDEX IF NOT EXISTS idx_notes_visibility         ON notes (visibility);
