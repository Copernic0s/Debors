-- Run after the bootstrap and all Supabase migrations in a local database.
-- The transaction is rolled back, so the fixtures never persist.
begin;
set local role service_role;

do $$
declare
  v_agent text := 'f4-test-' || gen_random_uuid()::text;
  v_other_agent text := 'f4-other-' || gen_random_uuid()::text;
  v_run_one uuid := gen_random_uuid();
  v_run_two uuid := gen_random_uuid();
  v_run_incomplete uuid := gen_random_uuid();
  v_run_empty uuid := gen_random_uuid();
  v_run_truncated uuid := gen_random_uuid();
  v_run_fast_one uuid := gen_random_uuid();
  v_run_fast_two uuid := gen_random_uuid();
  v_run_dry uuid := gen_random_uuid();
  v_invoice_a text := 'CMP-F4-' || gen_random_uuid()::text || '-A';
  v_invoice_b text := 'CMP-F4-' || gen_random_uuid()::text || '-B';
  v_fast_open text := 'CMP-F4-' || gen_random_uuid()::text || '-OPEN';
  v_fast_paid text := 'CMP-F4-' || gen_random_uuid()::text || '-PAID';
  v_recent_paid text := 'CMP-F4-' || gen_random_uuid()::text || '-RECENT-PAID';
  v_other text := 'CMP-F4-' || gen_random_uuid()::text || '-OTHER';
  v_preview text := 'CMP-F4-' || gen_random_uuid()::text || '-PREVIEW';
  v_result jsonb;
  v_is_current boolean;
  v_count integer;
begin
  v_result := public.apply_cmp_sync_run(
    v_run_one, now(), jsonb_build_array(
      jsonb_build_object('id', v_invoice_a, 'invoice_number', 'A', 'company_name', 'F4 Test A', 'agent_id', v_agent, 'amount', 100, 'remaining_amount', 100, 'status', 'pending', 'invoice_date', current_date - 400, 'synced_at', now() - interval '5 months'),
      jsonb_build_object('id', v_invoice_b, 'invoice_number', 'B', 'company_name', 'F4 Test B', 'agent_id', v_agent, 'amount', 100, 'remaining_amount', 100, 'status', 'overdue', 'invoice_date', current_date - 400)
    ), 'complete', 'deep', 2, 2, false, current_date - 120, array[v_agent], 0.5, false
  );

  v_result := public.apply_cmp_sync_run(
    v_run_two, now(), jsonb_build_array(
      jsonb_build_object('id', v_invoice_a, 'invoice_number', 'A', 'company_name', 'F4 Test A', 'agent_id', v_agent, 'amount', 125, 'remaining_amount', 125, 'status', 'pending', 'invoice_date', current_date - 400, 'synced_at', now())
    ), 'complete', 'deep', 2, 1, false, current_date - 120, array[v_agent], 0.5, false
  );
  if v_result->>'closedRows' <> '1' then
    raise exception 'complete run should close exactly one missing invoice: %', v_result;
  end if;
  select is_current into v_is_current from public.cmp_invoices where id = v_invoice_b;
  if v_is_current is distinct from false then
    raise exception 'missing invoice was not marked non-current';
  end if;
  if not exists (select 1 from public.cmp_invoices where id = v_invoice_b and closed_at is not null) then
    raise exception 'closed invoice must retain row and closed_at timestamp';
  end if;
  if (select count(*) from public.cmp_invoices where id in (v_invoice_a, v_invoice_b)) <> 2 then
    raise exception 'reconciliation must never delete invoice rows';
  end if;
  if not exists (
    select 1 from public.cmp_invoices
    where id = v_invoice_a and is_current and closed_at is null
      and sync_run_id = v_run_two and amount = 125 and synced_at > now() - interval '1 minute'
  ) then
    raise exception 'reappearing five-month-old PENDING invoice must be refreshed and current';
  end if;

  v_result := public.apply_cmp_sync_run(
    v_run_two, now(), jsonb_build_array(
      jsonb_build_object('id', v_invoice_a, 'invoice_number', 'A', 'company_name', 'F4 Test A', 'agent_id', v_agent, 'amount', 100, 'remaining_amount', 100, 'status', 'pending', 'invoice_date', current_date - 400)
    ), 'complete', 'deep', 2, 1, false, current_date - 120, array[v_agent], 0.5, false
  );
  if v_result->>'idempotentReplay' <> 'true' then
    raise exception 'same run id should be an idempotent no-op: %', v_result;
  end if;

  v_result := public.apply_cmp_sync_run(
    v_run_incomplete, now(), '[]'::jsonb, 'incomplete', 'normal', 4, 0, false,
    current_date - 120, array[v_agent], 0.5, false
  );
  v_result := public.apply_cmp_sync_run(
    v_run_empty, now(), '[]'::jsonb, 'complete', 'normal', 1, 0, false,
    current_date - 120, array[v_agent], 0.5, false
  );
  v_result := public.apply_cmp_sync_run(
    v_run_truncated, now(), '[]'::jsonb, 'complete', 'normal', 10, 0, true,
    current_date - 120, array[v_agent], 0.5, false
  );
  select is_current into v_is_current from public.cmp_invoices where id = v_invoice_a;
  if v_is_current is distinct from true then
    raise exception 'incomplete/empty run closed a current invoice';
  end if;

  insert into public.cmp_invoices (
    id, invoice_number, company_name, agent_id, amount, remaining_amount,
    total_amount, total_paid, invoice_date, status, sync_run_id, synced_at, is_current
  ) values
    (v_fast_open, 'FAST-OPEN', 'F4 Fast Open', v_agent, 50, 50, 50, 0, current_date - 400, 'overdue', v_run_one, now(), true),
    (v_fast_paid, 'FAST-PAID', 'F4 Fast Paid', v_agent, 10, 10, 50, 40, current_date - 400, 'paid', v_run_one, now(), true),
    (v_recent_paid, 'RECENT-PAID', 'F4 Recent Paid', v_agent, 0, 0, 50, 50, current_date - 10, 'paid', v_run_one, now(), true),
    (v_other, 'OTHER', 'F4 Other Agent', v_other_agent, 10, 10, 10, 0, current_date - 400, 'overdue', v_run_one, now(), true),
    (v_preview, 'PREVIEW', 'F4 Preview', v_agent, 10, 10, 10, 0, current_date - 400, 'overdue', v_run_one, now(), true);

  perform public.apply_cmp_sync_run(
    v_run_fast_one, now(), jsonb_build_array(
      jsonb_build_object('id', v_fast_open, 'invoice_number', 'FAST-OPEN', 'company_name', 'F4 Fast Open', 'agent_id', v_agent, 'amount', 50, 'remaining_amount', 50, 'status', 'overdue', 'invoice_date', current_date - 400),
      jsonb_build_object('id', v_fast_paid, 'invoice_number', 'FAST-PAID', 'company_name', 'F4 Fast Paid', 'agent_id', v_agent, 'amount', 10, 'remaining_amount', 10, 'total_amount', 50, 'total_paid', 40, 'status', 'paid', 'invoice_date', current_date - 400),
      jsonb_build_object('id', v_recent_paid, 'invoice_number', 'RECENT-PAID', 'company_name', 'F4 Recent Paid', 'agent_id', v_agent, 'amount', 0, 'remaining_amount', 0, 'total_amount', 50, 'total_paid', 50, 'status', 'paid', 'invoice_date', current_date - 10)
    ), 'complete', 'fast', 1, 3, false, current_date - 15, array[v_agent], 0.5, false
  );
  v_result := public.apply_cmp_sync_run(
    v_run_fast_two, now(), jsonb_build_array(
      jsonb_build_object('id', v_fast_open, 'invoice_number', 'FAST-OPEN', 'company_name', 'F4 Fast Open', 'agent_id', v_agent, 'amount', 50, 'remaining_amount', 50, 'status', 'overdue', 'invoice_date', current_date - 400)
    ), 'complete', 'fast', 1, 1, false, current_date - 15, array[v_agent], 0, false
  );
  select is_current into v_is_current from public.cmp_invoices where id = v_fast_paid;
  if v_is_current is distinct from true then
    raise exception 'fast run closed an old paid invoice outside its date scope';
  end if;
  select is_current into v_is_current from public.cmp_invoices where id = v_recent_paid;
  if v_is_current is distinct from false then
    raise exception 'complete fast run should close missing paid invoice inside the date window';
  end if;
  select is_current into v_is_current from public.cmp_invoices where id = v_other;
  if v_is_current is distinct from true then
    raise exception 'run closed an invoice outside its agent scope';
  end if;
  select is_current into v_is_current from public.cmp_invoices where id = v_recent_paid;
  if v_is_current is distinct from false then
    raise exception 'fast run must not close a paid invoice outside its fast window';
  end if;

  update public.cmp_invoices
  set is_current = true, closed_at = null, last_seen_sync_run_id = null
  where id = v_preview;

  v_result := public.apply_cmp_sync_run(
    v_run_dry, now(), jsonb_build_array(
      jsonb_build_object('id', v_fast_open, 'invoice_number', 'FAST-OPEN', 'company_name', 'F4 Fast Open', 'agent_id', v_agent, 'amount', 50, 'remaining_amount', 50, 'status', 'overdue', 'invoice_date', current_date - 400)
    ), 'complete', 'fast', 1, 1, false, current_date - 15, array[v_agent], 0.5, true
  );
  if v_result->>'rowsThatWouldClose' <> '1'
     or v_result->>'amountThatWouldClose' <> '10'
     or v_result->>'paidRowsThatWouldClose' <> '0'
     or v_result->>'unpaidRowsThatWouldClose' <> '1' then
    raise exception 'dry-run should report one eligible stale invoice: %', v_result;
  end if;
  if exists (select 1 from public.cmp_sync_runs where id = v_run_dry) then
    raise exception 'dry-run wrote a sync run row';
  end if;
  select count(*) into v_count from public.cmp_invoices where id = v_preview and is_current;
  if v_count <> 1 then
    raise exception 'dry-run changed current invoice rows';
  end if;
end;
$$;

rollback;
