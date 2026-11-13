-- Grant all-invoice read access without manager or PDF permissions.
-- Run manually only after confirming the intended Auth account exists.
do $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = 'guidiana.puentes@theunitedtransports.com';

  if target_user_id is null then
    raise exception 'Billing viewer provisioning aborted: Guidiana Auth user was not found.';
  end if;

  insert into public.cmp_billing_viewers (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;
end;
$$;
