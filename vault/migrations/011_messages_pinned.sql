-- Migration 011: add pinned flag and note_id to messages
-- Run in Supabase SQL editor before testing pin-to-Ledger

ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS note_id uuid REFERENCES notes(id) ON DELETE SET NULL;

-- Index for fast pinned lookups
CREATE INDEX IF NOT EXISTS messages_pinned_idx ON messages (user_id, pinned) WHERE pinned = true;

-- RLS: pinned messages visible to the owner (existing select policy already covers this)
-- No new policy needed — pinned is just a column on an existing row the user owns.
