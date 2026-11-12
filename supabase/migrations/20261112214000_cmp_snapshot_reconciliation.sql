-- Snapshot reconciliation for CMP. Safe to re-run; never deletes invoice rows.

alter table public.cmp_invoices
  add column if not exists last_seen_sync_run_id uuid,
  add column if not exists is_current boolean not null default true,
  add column if not exists closed_at timestamptz;

create table if not exists public.cmp_sync_runs (
  id uuid primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  mode text,
  status text not null default 'running',
  pages_scraped integer,
  rows_extracted integer,
  truncated boolean not null default false,
  coverage jsonb not null default '{}'::jsonb,
  reconciled boolean not null default false,
  closed_rows integer not null default 0
);

alter table public.cmp_sync_runs
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists finished_at timestamptz,
  add column if not exists mode text,
  add column if not exists status text not null default 'running',
  add column if not exists pages_scraped integer,
  add column if not exists rows_extracted integer,
  add column if not exists truncated boolean not null default false,
  add column if not exists coverage jsonb not null default '{}'::jsonb,
  add column if not exists reconciled boolean not null default false,
  add column if not exists closed_rows integer not null default 0;

create index if not exists cmp_invoices_current_agent_idx
  on public.cmp_invoices (is_current, agent_id);

alter table public.cmp_sync_runs enable row level security;
revoke all on public.cmp_sync_runs from anon, authenticated;
grant all on public.cmp_sync_runs to service_role;

create or replace function public.apply_cmp_sync_run(
  p_run_id uuid,
  p_started_at timestamptz,
  p_rows jsonb,
  p_status text,
  p_mode text,
  p_pages_scraped integer,
  p_rows_extracted integer,
  p_truncated boolean,
  p_cutoff_date date,
  p_scope_agent_ids text[],
  p_reconcile_min_ratio numeric,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_existing public.cmp_sync_runs%rowtype;
  v_scope_agent_ids text[] := array_remove(coalesce(p_scope_agent_ids, array[]::text[]), '');
  v_invoice_ids text[];
  v_rows_count integer;
  v_previous_current integer;
  v_would_close integer := 0;
  v_closed_rows integer := 0;
  v_eligible boolean := false;
  v_skip_reason text;
begin
  if p_run_id is null then
    raise exception 'run_id is required';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'rows must be a JSON array';
  end if;
  if p_status not in ('complete', 'incomplete', 'failed') then
    raise exception 'invalid run status';
  end if;
  if p_rows_extracted < 0 or p_pages_scraped < 0 then
    raise exception 'run counts cannot be negative';
  end if;
  if p_reconcile_min_ratio < 0 or p_reconcile_min_ratio > 1 then
    raise exception 'reconcile ratio must be between 0 and 1';
  end if;
  if p_cutoff_date is null then
    raise exception 'cutoff date is required';
  end if;

  select coalesce(array_agg(distinct r.id), array[]::text[])
    into v_invoice_ids
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
    as r(id text, company_name text, invoice_number text)
  where nullif(trim(r.id), '') is not null
    and nullif(trim(r.company_name), '') is not null
    and nullif(trim(r.invoice_number), '') is not null;

  v_rows_count := cardinality(v_invoice_ids);
  if v_rows_count <> p_rows_extracted then
    raise exception 'rows_extracted does not match valid invoice rows';
  end if;

  perform pg_advisory_xact_lock(hashtext('cmp-snapshot-reconciliation'));
  if not p_dry_run then
    select * into v_existing
    from public.cmp_sync_runs r
    where r.id = p_run_id;
    if found then
      return jsonb_build_object(
        'dryRun', false,
        'runId', p_run_id,
        'status', v_existing.status,
        'reconciled', v_existing.reconciled,
        'closedRows', v_existing.closed_rows,
        'idempotentReplay', true
      );
    end if;
  end if;

  select count(*)::integer
    into v_previous_current
  from public.cmp_invoices i
  where i.is_current
    and i.agent_id = any(v_scope_agent_ids)
    and (
      lower(coalesce(i.status, 'pending')) <> 'paid'
      or coalesce(i.remaining_amount, i.amount, 0) > 0
      or i.invoice_date >= p_cutoff_date
    );

  v_eligible := p_status = 'complete'
    and not p_truncated
    and p_rows_extracted > 0
    and cardinality(v_scope_agent_ids) > 0
    and p_rows_extracted::numeric >= v_previous_current::numeric * p_reconcile_min_ratio;

  if p_status <> 'complete' then
    v_skip_reason := 'run_not_complete';
  elsif p_truncated then
    v_skip_reason := 'run_truncated';
  elsif p_rows_extracted = 0 then
    v_skip_reason := 'empty_run';
  elsif cardinality(v_scope_agent_ids) = 0 then
    v_skip_reason := 'empty_scope';
  elsif p_rows_extracted::numeric < v_previous_current::numeric * p_reconcile_min_ratio then
    v_skip_reason := 'coverage_below_threshold';
  end if;

  select count(*)::integer
    into v_would_close
  from public.cmp_invoices i
  where v_eligible
    and i.is_current
    and i.agent_id = any(v_scope_agent_ids)
    and i.last_seen_sync_run_id is distinct from p_run_id
    and not (i.id = any(v_invoice_ids))
    and (
      lower(coalesce(i.status, 'pending')) <> 'paid'
      or coalesce(i.remaining_amount, i.amount, 0) > 0
      or i.invoice_date >= p_cutoff_date
    );

  if p_dry_run then
    return jsonb_build_object(
      'dryRun', true,
      'runId', p_run_id,
      'eligible', v_eligible,
      'previousCurrentRowsInScope', v_previous_current,
      'rowsExtracted', p_rows_extracted,
      'rowsThatWouldClose', case when v_eligible then v_would_close else 0 end,
      'skipReason', v_skip_reason,
      'scopeAgentCount', cardinality(v_scope_agent_ids),
      'cutoffDate', p_cutoff_date
    );
  end if;

  insert into public.cmp_invoices (
    id, invoice_number, company_name, agent_id, amount,
    invoice_date, due_date, status, cmp_status_raw, sync_run_id,
    synced_at, total_amount, remaining_amount, total_paid, billing_type,
    last_seen_sync_run_id, is_current, closed_at
  )
  select
    r.id, r.invoice_number, r.company_name, r.agent_id, coalesce(r.amount, 0),
    r.invoice_date, r.due_date, coalesce(nullif(lower(r.status), ''), 'pending'),
    r.cmp_status_raw, p_run_id, coalesce(r.synced_at, now()),
    coalesce(r.total_amount, r.amount, 0),
    coalesce(r.remaining_amount, r.amount, 0),
    coalesce(r.total_paid, 0), r.billing_type,
    p_run_id, true, null
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(
    id text, invoice_number text, company_name text, agent_id text,
    amount numeric, invoice_date date, due_date date, status text,
    cmp_status_raw text, synced_at timestamptz, total_amount numeric,
    remaining_amount numeric, total_paid numeric, billing_type text
  )
  where nullif(trim(r.id), '') is not null
    and nullif(trim(r.company_name), '') is not null
    and nullif(trim(r.invoice_number), '') is not null
  on conflict (id) do update set
    invoice_number = excluded.invoice_number,
    company_name = excluded.company_name,
    agent_id = excluded.agent_id,
    amount = excluded.amount,
    invoice_date = excluded.invoice_date,
    due_date = excluded.due_date,
    status = excluded.status,
    cmp_status_raw = excluded.cmp_status_raw,
    sync_run_id = excluded.sync_run_id,
    synced_at = excluded.synced_at,
    total_amount = excluded.total_amount,
    remaining_amount = excluded.remaining_amount,
    total_paid = excluded.total_paid,
    billing_type = excluded.billing_type,
    last_seen_sync_run_id = excluded.last_seen_sync_run_id,
    is_current = true,
    closed_at = null;

  if v_eligible then
    update public.cmp_invoices i
    set is_current = false,
        closed_at = now()
    where i.is_current
      and i.agent_id = any(v_scope_agent_ids)
      and i.last_seen_sync_run_id is distinct from p_run_id
      and not (i.id = any(v_invoice_ids))
      and (
        lower(coalesce(i.status, 'pending')) <> 'paid'
        or coalesce(i.remaining_amount, i.amount, 0) > 0
        or i.invoice_date >= p_cutoff_date
      );
    get diagnostics v_closed_rows = row_count;
  end if;

  insert into public.cmp_sync_runs (
    id, started_at, finished_at, mode, status, pages_scraped,
    rows_extracted, truncated, coverage, reconciled, closed_rows
  ) values (
    p_run_id, coalesce(p_started_at, now()), now(), p_mode, p_status, p_pages_scraped,
    p_rows_extracted, p_truncated,
    jsonb_build_object(
      'cutoff_date', p_cutoff_date,
      'scope_agent_ids', to_jsonb(v_scope_agent_ids),
      'previous_current_rows_in_scope', v_previous_current,
      'skip_reason', v_skip_reason
    ),
    v_eligible, v_closed_rows
  );

  return jsonb_build_object(
    'dryRun', false,
    'runId', p_run_id,
    'status', p_status,
    'reconciled', v_eligible,
    'closedRows', v_closed_rows,
    'rowsUpserted', p_rows_extracted,
    'skipReason', v_skip_reason,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.apply_cmp_sync_run(uuid, timestamptz, jsonb, text, text, integer, integer, boolean, date, text[], numeric, boolean) from public, anon, authenticated;
grant execute on function public.apply_cmp_sync_run(uuid, timestamptz, jsonb, text, text, integer, integer, boolean, date, text[], numeric, boolean) to service_role;
