-- CMP invoice cache (latest invoice per company)
-- Purpose: allow local CMP scraper runs to publish results so Vercel users can see them.

create table if not exists public.cmp_invoices (
  company_key text primary key,
  company text not null,
  invoice_id text,
  amount numeric,
  captured_at timestamptz,
  source text default 'cmp_scraper',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cmp_invoices enable row level security;

-- Anyone logged in (authenticated) can read.
drop policy if exists "cmp_invoices_read_authenticated" on public.cmp_invoices;
create policy "cmp_invoices_read_authenticated"
on public.cmp_invoices
for select
to authenticated
using (true);

-- No direct client writes; updates should come from server-side (service role) only.
drop policy if exists "cmp_invoices_block_client_writes" on public.cmp_invoices;
create policy "cmp_invoices_block_client_writes"
on public.cmp_invoices
for all
to authenticated
using (false)
with check (false);

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cmp_invoices_touch on public.cmp_invoices;
create trigger trg_cmp_invoices_touch
before update on public.cmp_invoices
for each row
execute procedure public.touch_updated_at();

