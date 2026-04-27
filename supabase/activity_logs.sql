create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  user_email text not null,
  action_type text not null,
  details text not null,
  entity_type text,
  entity_id text,
  company text,
  field_name text,
  old_value text,
  new_value text
);

create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_action_type_idx on public.activity_logs (action_type);
create index if not exists activity_logs_user_email_idx on public.activity_logs (user_email);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_insert_authenticated" on public.activity_logs;
create policy "activity_logs_insert_authenticated"
on public.activity_logs
for insert
to authenticated
with check (true);

drop policy if exists "activity_logs_select_andres_only" on public.activity_logs;
create policy "activity_logs_select_andres_only"
on public.activity_logs
for select
to authenticated
using (
  lower(coalesce(auth.jwt() ->> 'email', '')) like '%andres%'
);

drop policy if exists "activity_logs_block_updates" on public.activity_logs;
create policy "activity_logs_block_updates"
on public.activity_logs
for update
to authenticated
using (false)
with check (false);

drop policy if exists "activity_logs_block_deletes" on public.activity_logs;
create policy "activity_logs_block_deletes"
on public.activity_logs
for delete
to authenticated
using (false);
