# Repository Working Rules

## Safety

- Never start, stop, or trigger the CMP scraper (`run_cmp_bot.ps1`, `/api/cmp/run`) unless Andres explicitly requests it.
- Never read, print, edit, or commit `.env` or `server/.env`. Use only placeholder values in examples.
- Never apply SQL to remote Supabase without explicit approval. Version migrations and test against a local database first.
- Never delete rows from `cmp_invoices`; snapshot reconciliation must use explicit current/closed markers and reject incomplete runs.
- Never stage local browser profiles, downloaded data, generated reports, or unrelated pre-existing worktree changes.

## Engineering

- Keep money in integer cents for calculations; convert to currency units only at display boundaries.
- Add focused tests with any financial, access-control, or ingest behavior change.
- Update `progress.md` in every implementation commit and push each verified commit to the active work branch.
- Review `git status` before staging and stage explicit file paths only.

## Verification

```powershell
npm run test:run
npm run build
cd server
npm test
```

Run Python extractor unit tests from `automation` with `python -m unittest test_cmp_agent_scope`.

## Supabase

- Apply migrations in timestamp order only after local PostgreSQL/RLS validation.
- Provision `agent_scopes` privately with verified Auth user UUIDs and exact normalized `agent_id` values; do not commit real user assignments.
- `agent_id = null` is intentionally manager-only. Never infer an agent for a company with conflicting assignments.
