# Local CMP database baseline

Use this sequence only against a disposable local PostgreSQL/Supabase database. Do not run the fixture scripts against production.

1. Apply `cmp_invoices.sql` to create the base CMP schema.
2. Apply every file under `migrations/` in ascending timestamp order.
3. Run `tests/cmp_schema_contract.sql` to verify the resulting schema and current-row default.
4. Run `tests/cmp_agent_rls.sql` to verify agent, manager, and unscoped reads.
5. Run `tests/cmp_snapshot_reconciliation.sql` to verify snapshot close guards and dry-run behavior.

The RLS and reconciliation scripts run inside a transaction and roll back their fixtures. The schema contract is read-only. Before using a local reset command, confirm its database URL points to the disposable local instance. This repository does not currently include `supabase/config.toml`; until that is added, apply the SQL files explicitly to a local PostgreSQL instance.

PowerShell example after setting `DATABASE_URL` to a local-only connection string:

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/cmp_invoices.sql
Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | ForEach-Object {
  psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName
}
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/cmp_schema_contract.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/cmp_agent_rls.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/tests/cmp_snapshot_reconciliation.sql
```
