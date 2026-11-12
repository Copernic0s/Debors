# CMP database and RLS operations

## Local contracts

Use only a disposable local Supabase database for resets and fixtures. Never run the contract fixture scripts against production.

1. Run `npx supabase db reset` from the repository root.
2. Run `tests/cmp_schema_contract.sql` and `tests/cmp_agent_rls.sql`.
3. Run `tests/cmp_snapshot_reconciliation.sql`.
4. Run `tests/cmp_rls_transition.ps1` in PowerShell to verify the open -> guarded activation -> scoped access -> rollback transition for both invoices and PDFs.

The open production-equivalent policy identifiers are `cmp_invoices_read_authenticated` and `cmp_invoice_pdfs_read_authenticated`. The latter is the canonical PDF policy name; if production confirms a different name, update it consistently in the bootstrap and the two manual activation scripts. The bucket is private (`cmp-invoices`); the open policy mirrors its currently verified authenticated SELECT behavior.

`20261112213000_cmp_agent_rls.sql` is additive. PostgreSQL combines applicable permissive policies with OR, so the scoped policies do not narrow access while the open policies exist. Do not treat this migration as activation. `activate_agent_rls.sql` is a separately approved manual cutover and refuses to run until at least one manager scope exists. `rollback_agent_rls.sql` restores the open reads.

## Reconciliation scope

The RPC `public.apply_cmp_sync_run` reconciles only rows satisfying all of these predicates:

```sql
i.is_current
and i.agent_id = any(v_scope_agent_ids)
and i.last_seen_sync_run_id is distinct from p_run_id
and not (i.id = any(v_invoice_ids))
and (lower(coalesce(i.status, 'pending')) <> 'paid' or i.invoice_date >= p_cutoff_date)
```

This means every non-paid/open invoice in the run's agent scope is eligible regardless of age; paid invoices are eligible only when their invoice date is on/after the run cutoff. A paid invoice before the cutoff is outside the reconciliation scope even if its remaining amount is inconsistent. The same predicate feeds the dry-run candidate set and the update. The RPC never deletes invoice rows.

Reconciliation also requires `status = complete`, `truncated = false`, `rows_extracted > 0`, a non-empty agent scope, and extracted rows meeting `CMP_RECONCILE_MIN_RATIO` of current rows inside that exact scope. Incomplete, failed, truncated, empty, or under-covered runs still upsert received rows but do not close absent rows. Replaying a `run_id` is an idempotent no-op. A row seen again is upserted and restored to `is_current = true`, with `closed_at = null`, including old open invoices.

Dry-run (`p_dry_run = true`) performs no writes and returns `rowsThatWouldClose`, `amountThatWouldClose` (sum of `coalesce(remaining_amount, amount, 0)`), counts and amounts split into paid and non-paid rows, plus eligibility, scope size, cutoff, and skip reason.

## Remote rollout order (documentation only)

Do not run this sequence without a reviewed production change window. No remote SQL is applied by these instructions.

1. Back up `cmp_invoices` to a dated backup table and verify its row count.
2. Apply `20261112205608_cmp_invoice_financial_and_snapshot_fields.sql` (205608). It adds `agent_id`, financial columns, and snapshot fields; financial values use unbounded `numeric NOT NULL DEFAULT 0`.
3. Apply `20261112213000_cmp_agent_rls.sql` (213000). It is additive and creates `agent_scopes`, helper functions, and scoped invoice/PDF policies. Open policies remain in place, so access does not narrow.
4. Apply `20261112214000_cmp_snapshot_reconciliation.sql` (214000). It uses `agent_id` introduced by 205608; it does not depend on `agent_scopes` or helper functions created only by 213000. Applying 213000 first is still the documented rollout order so the scoped policies are ready before activation.
5. Seed `agent_scopes` and verify at least one correct `is_manager = true` user before activation.
6. Backfill `agent_id` using a dry-run first; verify the number of null, ambiguous, and changed rows before writing.
7. Run the RPC dry-run for a representative complete snapshot. Review would-close count, total outstanding amount, paid/non-paid breakdown, cutoff, and scope. Abort if the result is unexpected.
8. After a complete, non-truncated sync and access review, manually run `activation/activate_agent_rls.sql`. This removes only the two open policies. Verify the final policy listing and test agent, manager, unscoped-user, invoice, and PDF access.
9. Keep `activation/rollback_agent_rls.sql` ready. Run it manually to restore authenticated open reads if access is incorrect; verify the policy listing afterward.

Never run the activation script before manager and agent scopes and the `agent_id` backfill have been verified. The migration itself intentionally does not activate agent isolation.
