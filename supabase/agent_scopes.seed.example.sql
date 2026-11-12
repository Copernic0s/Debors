-- Example only. Replace both placeholders with verified values before running.
-- Keep real user UUIDs and agent assignments out of the repository.
-- A manager should receive one row with is_manager = true. Agent users receive
-- one row per exact agent_id value stored on cmp_invoices.
-- Run as a trusted database administrator; never expose service-role credentials.

-- insert into public.agent_scopes (user_id, agent_id, is_manager)
-- values ('<AUTH_USER_UUID>', '<EXACT_AGENT_ID_FROM_CLIENT_BY_AGENT>', false)
-- on conflict (user_id, agent_id) do update
-- set is_manager = excluded.is_manager;

-- Manager example:
-- insert into public.agent_scopes (user_id, agent_id, is_manager)
-- values ('<AUTH_USER_UUID>', '__manager__', true)
-- on conflict (user_id, agent_id) do update set is_manager = true;
