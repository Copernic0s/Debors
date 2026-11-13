-- Billing viewers can read all invoices, but never receive PDF access.
-- Provision users through activation/grant_guidiana_billing_viewer.sql.

create table if not exists public.cmp_billing_viewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.cmp_billing_viewers enable row level security;
revoke all on public.cmp_billing_viewers from public, anon, authenticated;
grant all on public.cmp_billing_viewers to service_role;

create or replace function public.is_cmp_billing_viewer()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.cmp_billing_viewers v
    where v.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_cmp_billing_viewer() from public, anon;
grant execute on function public.is_cmp_billing_viewer() to authenticated, service_role;

drop policy if exists cmp_invoices_read_by_agent_scope on public.cmp_invoices;
create policy cmp_invoices_read_by_agent_scope
  on public.cmp_invoices
  for select
  to authenticated
  using (
    (select public.is_cmp_manager())
    or (select public.is_cmp_billing_viewer())
    or (select public.has_cmp_agent_scope(agent_id))
  );

drop policy if exists cmp_invoice_pdfs_read_by_agent_scope on storage.objects;
create policy cmp_invoice_pdfs_read_by_agent_scope
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'cmp-invoices'
    and not (select public.is_cmp_billing_viewer())
    and (
      (select public.is_cmp_manager())
      or exists (
        select 1
        from public.cmp_invoices i
        where i.pdf_storage_path = storage.objects.name
          and (select public.has_cmp_agent_scope(i.agent_id))
      )
    )
  );
