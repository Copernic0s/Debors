-- Manual production activation only after manager scopes and agent_id backfill
-- have been verified. Any guard failure rolls back before policy changes.
begin;

do $$
begin
  if to_regclass('public.agent_scopes') is null then
    raise exception 'Agent RLS activation aborted: public.agent_scopes does not exist. Apply migrations and seed a manager first.';
  end if;

  if not exists (
    select 1 from public.agent_scopes where is_manager is true
  ) then
    raise exception 'Agent RLS activation aborted: agent_scopes has no is_manager=true user. Seed and verify a manager before activation.';
  end if;
end;
$$;

drop policy if exists cmp_invoices_read_authenticated on public.cmp_invoices;
drop policy if exists cmp_invoice_pdfs_read_authenticated on storage.objects;

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where (schemaname = 'public' and tablename = 'cmp_invoices')
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

commit;
