-- Restore production-equivalent open reads. This script is safe to re-run.
begin;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cmp_invoices'
      and policyname = 'cmp_invoices_read_authenticated'
  ) then
    execute 'create policy cmp_invoices_read_authenticated on public.cmp_invoices for select to authenticated using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cmp_invoice_pdfs_read_authenticated'
  ) then
    execute 'create policy cmp_invoice_pdfs_read_authenticated on storage.objects for select to authenticated using (bucket_id = ''cmp-invoices'')';
  end if;
end;
$$;

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where (schemaname = 'public' and tablename = 'cmp_invoices')
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

commit;
