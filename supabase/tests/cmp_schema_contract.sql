-- Run after a clean local supabase db reset and all migrations.
do $$
declare
  missing_columns text;
  current_default text;
begin
  select string_agg(required.column_name, ', ' order by required.column_name)
    into missing_columns
  from (values
    ('agent_id'),
    ('total_amount'),
    ('remaining_amount'),
    ('total_paid'),
    ('billing_type'),
    ('last_seen_sync_run_id'),
    ('is_current'),
    ('closed_at')
  ) as required(column_name)
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = 'cmp_invoices'
   and actual.column_name = required.column_name
  where actual.column_name is null;

  if missing_columns is not null then
    raise exception 'cmp_invoices is missing required columns: %', missing_columns;
  end if;

  if to_regclass('public.cmp_sync_runs') is null then
    raise exception 'cmp_sync_runs table is missing';
  end if;

  select column_default into current_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'cmp_invoices'
    and column_name = 'is_current';

  if current_default is null or lower(current_default) not like '%true%' then
    raise exception 'is_current must default to true; found %', current_default;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cmp_sync_runs'
      and column_name = 'id'
  ) then
    raise exception 'cmp_sync_runs.id is missing';
  end if;
end;
$$;
