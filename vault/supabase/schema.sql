-- ============================================================
-- THE VAULT — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- PROFILES
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  avatar_initial text,
  created_at timestamptz default now()
);

-- MESSAGES (shared AI chat history)
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  display_name text,
  content text not null,
  role text not null check (role in ('user', 'assistant')),
  created_at timestamptz default now()
);

-- NOTES
create table if not exists public.notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text default 'Untitled',
  content text default '',
  is_shared boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- FILES
create table if not exists public.files (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  file_name text not null,
  file_url text not null,
  file_size bigint,
  mime_type text,
  is_shared boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.notes enable row level security;
alter table public.files enable row level security;

-- Profiles
create policy "Profiles viewable by authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Messages
create policy "Messages viewable by authenticated users"
  on public.messages for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert messages"
  on public.messages for insert
  with check (auth.role() = 'authenticated');

-- Notes
create policy "Notes viewable by owner or if shared"
  on public.notes for select
  using (auth.uid() = user_id or (is_shared = true and auth.role() = 'authenticated'));

create policy "Users can insert own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "Users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Files
create policy "Files viewable by owner or if shared"
  on public.files for select
  using (auth.uid() = user_id or (is_shared = true and auth.role() = 'authenticated'));

create policy "Users can insert own files"
  on public.files for insert
  with check (auth.uid() = user_id);

create policy "Users can update own files"
  on public.files for update
  using (auth.uid() = user_id);

create policy "Users can delete own files"
  on public.files for delete
  using (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, avatar_initial)
  values (
    new.id,
    new.email,
    upper(substring(new.email from 1 for 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- REALTIME (enable for messages)
-- ============================================================

-- Run in SQL editor OR enable via Supabase dashboard > Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.profiles;
