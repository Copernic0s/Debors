begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f6100000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select count(*) from public.cmp_invoices where id like 'F6-RLS-%') <> 2
     or (select count(*) from storage.objects where bucket_id = 'cmp-invoices' and name like 'f6-%') <> 2 then
    raise exception 'open policy state must expose both invoice and PDF fixtures';
  end if;
end;
$$;
rollback;
