-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 005: Message privacy
-- Scopes Lattice messages to the user/enclave that generated them.
-- Run in Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add enclave_id to messages (nullable — null = personal context)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS enclave_id UUID REFERENCES enclaves(id) ON DELETE CASCADE;

-- 2. Index for fast scoped queries
CREATE INDEX IF NOT EXISTS messages_user_enclave_idx ON messages (user_id, enclave_id);
CREATE INDEX IF NOT EXISTS messages_enclave_id_idx ON messages (enclave_id) WHERE enclave_id IS NOT NULL;

-- 3. Clean up old unscoped messages (user_id = null means they had no attribution).
--    These are the "leaked" AI messages from before this fix.
--    SAFE TO DELETE — they will be regenerated fresh per user going forward.
DELETE FROM messages WHERE user_id IS NULL;

-- 4. Enable RLS on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. DROP any existing policies first (idempotent)
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

-- 6. SELECT: own personal messages OR any message in an enclave you belong to
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    (user_id = auth.uid() AND enclave_id IS NULL)
    OR (
      enclave_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM enclave_members
        WHERE enclave_members.enclave_id = messages.enclave_id
          AND enclave_members.user_id = auth.uid()
      )
    )
  );

-- 7. INSERT: insert personal messages or enclave messages you're a member of
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    (user_id = auth.uid() AND enclave_id IS NULL)
    OR (
      enclave_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM enclave_members
        WHERE enclave_members.enclave_id = messages.enclave_id
          AND enclave_members.user_id = auth.uid()
      )
    )
  );

-- 8. DELETE: only own messages
CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (user_id = auth.uid());
