# CMP automation (operator workstation)

The CMP worker runs locally because it uses the operator's authenticated Chrome session. The flow is `server/cmpRunner.js` -> `run_cmp_bot.ps1` -> `cmp_invoice_extractor.py` -> `POST /api/cmp/ingest` -> transactional Supabase RPC.

## Install and run

1. For a clean local schema and SQL contracts, use the separate `codex/db-baseline` branch/PR. Never run its fixtures against production.
2. Install Python packages with `python -m pip install -r automation/requirements.txt`.
3. Configure the backend values in root `.env` or `server/.env` using placeholders from `.env.example`. Do not put service-role keys in Vite variables.
4. Start the API (`cd server; npm start`) and frontend (`npm run dev`).
5. Trigger a sync from the local app. The worker attaches to the configured Chrome debugger/profile; do not start another CMP run while one is already active.

## Data and recovery

`cmp_invoices` is an append-preserving invoice history, not a table replaced on each scrape. Ingest always upserts rows actually observed. The dashboard reads rows marked `is_current=true`; reconciliation marks absent rows non-current and records `closed_at`, never deletes them. `cmp_sync_runs` stores run metadata.

All invoices with an open balance are retained regardless of age. The invoice-date window applies only to paid/closed invoices: fast 15 days, normal 120 days, deep 365 days. The windows do not hide old open or overdue balances.

An incomplete, failed, empty, or max-pages-truncated scrape cannot reconcile missing rows. If the extractor returns collected rows with `incomplete` status, those observations may be upserted while previously current-but-unseen rows remain current. If an exception interrupts scraping before it returns those rows, the error path reports a failed empty run and leaves the current snapshot untouched. Fix the scrape problem and run it again; a later complete, non-truncated, non-empty run with coverage at or above `CMP_RECONCILE_MIN_RATIO` can reconcile its verified agent/date scope. Do not lower the guard just to force a partial scrape through.

Set `CMP_INGEST_DRY_RUN=true` for a read-only preview. It still needs the extracted CMP payload and reports how many currently-current rows in that run's scope would close; it does not upsert invoice rows or write a `cmp_sync_runs` record. Inspect the preview before switching dry-run off for a real sync.

The runner generates a `run_id` and passes it to the extractor. Status JSON and log lines/files are associated with that run. Starting a new run resets live phase, error, page and row progress. The UI keeps `Last successful sync` separate from `Last run error`. Status older than `STATUS_MAX_AGE_MIN` (default 60 minutes), or belonging to another active `run_id`, is ignored as live progress.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `CMP_INGEST_SECRET` | Required bearer secret for local ingest/runner; use at least 32 random bytes | unset, worker/API fail closed |
| `BIND_HOST` | Backend bind address | `127.0.0.1` |
| `CMP_RECONCILE_MIN_RATIO` | Minimum extracted/current coverage before reconciliation | `0.5` |
| `CMP_INGEST_DRY_RUN` | Preview without database writes | `false` |
| `STATUS_MAX_AGE_MIN` | Maximum age of live runner status | `60` |
| `CMP_HISTORY_DAYS` | Paid/closed invoice history window; runner sets by mode | `15` / `120` / `365` |
| `CMP_MAX_PAGES` | Pagination safety limit; reaching it marks the run truncated | runner sets by mode |
| `CMP_SYNC_MODE` | Run coverage label (`fast`, `normal`, `deep`) | runner sets it |
| `CMP_USER_DATA_DIR`, `CMP_PROFILE_DIR` | Chrome profile when not attaching to a debugger | workstation-specific |
| `CMP_DEBUGGER_ADDRESS` | Existing Chrome remote-debugging address | optional |

Keep secrets only in local `.env` files, which are ignored by Git. Example files contain placeholders only.

The `codex/db-baseline` PR contains a self-contained Supabase local project, bootstrap migration, and schema/RLS/reconciliation SQL contracts. It is tested independently from this runner/docs change.
