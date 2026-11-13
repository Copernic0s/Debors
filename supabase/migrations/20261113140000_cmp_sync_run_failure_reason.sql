alter table public.cmp_sync_runs
  add column if not exists failure_reason text;
