-- Migration 012: Echo avatar profile columns
-- Run in Supabase SQL editor

alter table profiles add column if not exists avatar_pattern text;
alter table profiles add column if not exists avatar_name text;
alter table profiles add column if not exists avatar_emote text default 'neutral';
alter table profiles add column if not exists avatar_observation text;
alter table profiles add column if not exists avatar_set_at timestamptz;
