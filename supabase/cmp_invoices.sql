-- Run in Supabase SQL editor before first CMP sync.

create table if not exists public.cmp_invoices (
  id text primary key,
  invoice_number text not null,
  company_name text not null,
  amount numeric not null default 0,
  invoice_date date,
  due_date date,
  status text not null default 'pending',
  cmp_status_raw text,
  pdf_storage_path text,
  pdf_status text not null default 'missing',
  pdf_downloaded_at timestamptz,
  pdf_error text,
  sync_run_id uuid not null,
  synced_at timestamptz not null default now()
);

alter table public.cmp_invoices
  add column if not exists pdf_storage_path text,
  add column if not exists pdf_status text not null default 'missing',
  add column if not exists pdf_downloaded_at timestamptz,
  add column if not exists pdf_error text;

create index if not exists cmp_invoices_company_idx on public.cmp_invoices (company_name);
create index if not exists cmp_invoices_invoice_idx on public.cmp_invoices (invoice_number);
create index if not exists cmp_invoices_synced_at_idx on public.cmp_invoices (synced_at desc);
create index if not exists cmp_invoices_pdf_status_idx on public.cmp_invoices (pdf_status);

alter table public.cmp_invoices enable row level security;

drop policy if exists "cmp_invoices_read_authenticated" on public.cmp_invoices;
create policy "cmp_invoices_read_authenticated"
  on public.cmp_invoices
  for select
  to authenticated
  using (true);

-- Writes only via service role (ingest API), not from browser clients.

insert into storage.buckets (id, name, public)
values ('cmp-invoices', 'cmp-invoices', false)
on conflict (id) do nothing;

drop policy if exists "cmp_invoice_pdfs_read_authenticated" on storage.objects;
create policy "cmp_invoice_pdfs_read_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'cmp-invoices');

-- PDF writes happen through the local CMP runner/API with the service role.
