-- Agent-scoped reads for CMP invoices and their private PDFs.
-- Requires 20261112205608_cmp_invoice_financial_and_snapshot_fields.sql first.

create table if not exists public.agent_scopes (
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  is_manager boolean not null default false,
  primary key (user_id, agent_id)
);

alter table public.agent_scopes enable row level security;
grant select on public.agent_scopes to authenticated, service_role;

drop policy if exists "agent scopes readable by owner" on public.agent_scopes;
create policy "agent scopes readable by owner"
  on public.agent_scopes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_cmp_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.agent_scopes s
    where s.user_id = (select auth.uid())
      and s.is_manager
  );
$$;

create or replace function public.has_cmp_agent_scope(scope_agent_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select scope_agent_id is not null and exists (
    select 1
    from public.agent_scopes s
    where s.user_id = (select auth.uid())
      and s.agent_id = scope_agent_id
  );
$$;

revoke all on function public.is_cmp_manager() from public;
revoke all on function public.has_cmp_agent_scope(text) from public;
grant execute on function public.is_cmp_manager() to authenticated, service_role;
grant execute on function public.has_cmp_agent_scope(text) to authenticated, service_role;

drop policy if exists "cmp_invoices_read_authenticated" on public.cmp_invoices;
drop policy if exists "cmp_invoices_read_by_agent_scope" on public.cmp_invoices;
create policy "cmp_invoices_read_by_agent_scope"
  on public.cmp_invoices
  for select
  to authenticated
  using (
    (select public.is_cmp_manager())
    or (select public.has_cmp_agent_scope(agent_id))
  );

drop policy if exists "cmp_invoice_pdfs_read_authenticated" on storage.objects;
drop policy if exists "cmp_invoice_pdfs_read_by_agent_scope" on storage.objects;
create policy "cmp_invoice_pdfs_read_by_agent_scope"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'cmp-invoices'
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

-- Authenticated users cannot write scope assignments or CMP invoice rows.
-- Provision scopes with the service role / SQL editor after verifying user UUIDs.
