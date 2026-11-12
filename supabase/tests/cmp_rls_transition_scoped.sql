begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f6100000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select count(*) from public.cmp_invoices where id like 'F6-RLS-%') <> 1
     or (select count(*) from storage.objects where bucket_id = 'cmp-invoices' and name like 'f6-%') <> 1 then
    raise exception 'agent must see only assigned invoice and PDF';
  end if;
end;
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f6100000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.cmp_invoices where id like 'F6-RLS-%') <> 2
     or (select count(*) from storage.objects where bucket_id = 'cmp-invoices' and name like 'f6-%') <> 2 then
    raise exception 'manager must see all invoice and PDF fixtures';
  end if;
end;
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f6100000-0000-4000-8000-000000000003', true);
do $$
begin
  if (select count(*) from public.cmp_invoices where id like 'F6-RLS-%') <> 0
     or (select count(*) from storage.objects where bucket_id = 'cmp-invoices' and name like 'f6-%') <> 0 then
    raise exception 'user without scope must see no invoice or PDF fixtures';
  end if;
end;
$$;
rollback;
