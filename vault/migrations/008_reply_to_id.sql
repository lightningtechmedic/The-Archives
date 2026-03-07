-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 008: reply_to_id + neuron_snapshot
-- Adds conversation threading to messages and The Impression to build_log.
-- Run in Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add reply_to_id to messages (self-referencing FK, nullable)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- 2. Index for fast thread lookups
CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON messages(reply_to_id);

-- 3. Add neuron_snapshot to build_log (The Impression — frozen thinking topology at build approval)
ALTER TABLE build_log ADD COLUMN IF NOT EXISTS neuron_snapshot JSONB;
