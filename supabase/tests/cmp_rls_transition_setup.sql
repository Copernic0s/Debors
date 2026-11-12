insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('f6100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'f6-agent@test.invalid', '', now(), now(), now()),
  ('f6100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'f6-manager@test.invalid', '', now(), now(), now()),
  ('f6100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'f6-unscoped@test.invalid', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.agent_scopes (user_id, agent_id, is_manager)
values ('f6100000-0000-4000-8000-000000000001', 'f6-agent-a', false);

insert into public.cmp_invoices (
  id, invoice_number, company_name, amount, status, sync_run_id, agent_id, pdf_storage_path
) values
  ('F6-RLS-AGENT-A', 'F6-A', 'F6 Agent A', 10, 'pending', gen_random_uuid(), 'f6-agent-a', 'f6-agent-a.pdf'),
  ('F6-RLS-AGENT-B', 'F6-B', 'F6 Agent B', 20, 'pending', gen_random_uuid(), 'f6-agent-b', 'f6-agent-b.pdf')
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name, owner, metadata)
values
  ('cmp-invoices', 'f6-agent-a.pdf', 'f6100000-0000-4000-8000-000000000001', '{}'::jsonb),
  ('cmp-invoices', 'f6-agent-b.pdf', 'f6100000-0000-4000-8000-000000000002', '{}'::jsonb);

select 'transition fixtures ready' as result;
