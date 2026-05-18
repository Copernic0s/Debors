-- Tracker entries captured via local automation (or UI in the future).
-- This table is meant to be global so Vercel users see the same tracker items.

create table if not exists public.tracker_entries (
  id text primary key,
  created_at timestamptz not null default now(),
  created_by text,

  date date,
  company text not null,
  agent text,
  task text,
  status text,
  notes text
);

alter table public.tracker_entries enable row level security;

-- Read: only ops users (Andres/Kevin) for now.
drop policy if exists "tracker_entries_read_ops" on public.tracker_entries;
create policy "tracker_entries_read_ops"
on public.tracker_entries
for select
to authenticated
using (public.is_ops_user());

-- No direct client writes; server-side only.
drop policy if exists "tracker_entries_block_client_writes" on public.tracker_entries;
create policy "tracker_entries_block_client_writes"
on public.tracker_entries
for all
to authenticated
using (false)
with check (false);

