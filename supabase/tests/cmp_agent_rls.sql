-- Run after db reset and all migrations on a local Supabase database.
-- Fixed fixtures are rolled back; never run this against production.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('f6100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'f6-agent@test.invalid', '', now(), now(), now()),
  ('f6100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'f6-manager@test.invalid', '', now(), now(), now()),
  ('f6100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'f6-unscoped@test.invalid', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.agent_scopes (user_id, agent_id, is_manager)
values
  ('f6100000-0000-4000-8000-000000000001', 'f6-agent-a', false),
  ('f6100000-0000-4000-8000-000000000002', 'f6-manager-scope', true);

insert into public.cmp_invoices (
  id, invoice_number, company_name, amount, status, sync_run_id, agent_id
) values
  ('F6-RLS-AGENT-A', 'F6-A', 'F6 Agent A', 10, 'pending', gen_random_uuid(), 'f6-agent-a'),
  ('F6-RLS-AGENT-B', 'F6-B', 'F6 Agent B', 20, 'pending', gen_random_uuid(), 'f6-agent-b');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f6100000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select count(*) from public.cmp_invoices where id like 'F6-RLS-%') <> 1
     or not exists (select 1 from public.cmp_invoices where id = 'F6-RLS-AGENT-A') then
    raise exception 'agent must read only invoices in its own scope';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f6100000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.cmp_invoices where id like 'F6-RLS-%') <> 2 then
    raise exception 'manager must read invoices across agent scopes';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f6100000-0000-4000-8000-000000000003', true);
do $$
begin
  if (select count(*) from public.cmp_invoices where id like 'F6-RLS-%') <> 0 then
    raise exception 'user without an agent scope must read no CMP invoices';
  end if;
end;
$$;

rollback;
