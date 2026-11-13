-- Keep existing authenticated PDF reads for other users while denying billing viewers.
-- This deliberately does not activate global agent RLS or require agent_id backfill.
drop policy if exists cmp_invoice_pdfs_read_authenticated on storage.objects;
create policy cmp_invoice_pdfs_read_authenticated
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'cmp-invoices'
    and not (select public.is_cmp_billing_viewer())
  );
