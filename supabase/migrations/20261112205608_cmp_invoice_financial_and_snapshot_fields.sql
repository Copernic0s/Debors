-- Versioned schema additions for CMP financial values and future safe reconciliation.
-- Apply only after reviewing and testing against a local database.

alter table public.cmp_invoices
  add column if not exists total_amount numeric(14, 2),
  add column if not exists remaining_amount numeric(14, 2),
  add column if not exists total_paid numeric(14, 2),
  add column if not exists billing_type text,
  add column if not exists agent_id text,
  add column if not exists last_seen_sync_run_id uuid,
  add column if not exists is_current boolean not null default true,
  add column if not exists closed_at timestamptz;

update public.cmp_invoices
set total_amount = coalesce(total_amount, amount),
    remaining_amount = coalesce(remaining_amount, amount),
    total_paid = coalesce(total_paid, 0)
where total_amount is null
   or remaining_amount is null
   or total_paid is null;

create index if not exists cmp_invoices_invoice_date_idx
  on public.cmp_invoices (invoice_date desc);

create index if not exists cmp_invoices_current_company_idx
  on public.cmp_invoices (is_current, company_name);
