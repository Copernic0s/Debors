-- Run after a clean local supabase db reset and all migrations.
do $$
declare
  missing_columns text;
  current_default text;
  invalid_financial_columns text;
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

  select string_agg(required.column_name, ', ' order by required.column_name)
    into invalid_financial_columns
  from (values ('total_amount'), ('remaining_amount'), ('total_paid')) as required(column_name)
  join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = 'cmp_invoices'
   and actual.column_name = required.column_name
  where actual.data_type <> 'numeric'
     or actual.is_nullable <> 'NO'
     or actual.column_default is null
     or actual.column_default not like '0%';

  if invalid_financial_columns is not null then
    raise exception 'financial CMP columns must be numeric not null default 0: %', invalid_financial_columns;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cmp_invoices'
      and policyname = 'cmp_invoices_read_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any(roles)
      and qual = 'true'
  ) then
    raise exception 'open authenticated invoice read policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cmp_invoice_pdfs_read_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any(roles)
      and qual like '%cmp-invoices%'
  ) then
    raise exception 'open authenticated CMP PDF read policy is missing';
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
