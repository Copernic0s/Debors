create table if not exists public.app_shared_state (
  state_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_shared_state enable row level security;

drop policy if exists "app_shared_state_read_authenticated" on public.app_shared_state;
create policy "app_shared_state_read_authenticated"
on public.app_shared_state
for select
to authenticated
using (true);

-- Limit writes to operations users (Andres/Kevin) to avoid agents mutating shared state.
-- Adjust the email checks if ops emails change.
create or replace function public.is_ops_user()
returns boolean
language sql
stable
as $$
  lower(coalesce(auth.jwt() ->> 'email', '')) like '%andres%'
  or lower(coalesce(auth.jwt() ->> 'email', '')) like '%kevin%'
$$;

drop policy if exists "app_shared_state_write_authenticated" on public.app_shared_state;
create policy "app_shared_state_write_authenticated"
on public.app_shared_state
for insert
to authenticated
with check (public.is_ops_user());

drop policy if exists "app_shared_state_update_authenticated" on public.app_shared_state;
create policy "app_shared_state_update_authenticated"
on public.app_shared_state
for update
to authenticated
using (public.is_ops_user())
with check (public.is_ops_user());
