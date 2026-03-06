-- ============================================================
-- THE VAULT — Three-Way Chat Migration
-- Run in Supabase SQL editor AFTER the initial schema.sql
-- ============================================================

-- Update the role check constraint to support three-way chat roles
-- Drop old constraint and replace with expanded version
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_role_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_role_check
  CHECK (role IN ('user', 'assistant', 'human', 'claude', 'gpt'));

-- Migrate any existing messages to new role names (optional)
-- UPDATE public.messages SET role = 'human' WHERE role = 'user';
-- UPDATE public.messages SET role = 'gpt'   WHERE role = 'assistant';

-- Add avatar_initial column if not present
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS avatar_initial text;
