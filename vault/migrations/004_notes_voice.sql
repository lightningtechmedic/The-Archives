-- ═══════════════════════════════════════════════════════════════
-- The Vault — Migration 004: Voice recording support
-- Run in Supabase SQL editor.
-- Also: create the 'voice-recordings' bucket in Supabase Storage
--       dashboard → Storage → New bucket → name: voice-recordings → Public: on
-- ═══════════════════════════════════════════════════════════════

-- Add source_type to notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';

-- Storage bucket (run if bucket doesn't exist yet)
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-recordings', 'voice-recordings', true)
ON CONFLICT DO NOTHING;

-- Storage RLS: users manage files under their own uid/ folder
DROP POLICY IF EXISTS "users manage own recordings" ON storage.objects;
CREATE POLICY "users manage own recordings" ON storage.objects
  FOR ALL USING (
    bucket_id = 'voice-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'voice-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read for voice recordings (so audio player can stream)
DROP POLICY IF EXISTS "voice recordings public read" ON storage.objects;
CREATE POLICY "voice recordings public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-recordings');
