# CMP automation (Andres workstation only)

1. Create the base schema from `supabase/cmp_invoices.sql`, then apply `supabase/migrations/` in timestamp order. Do not apply migrations remotely without owner approval.
2. Install Python deps: `pip install -r automation/requirements.txt`
3. Copy `.env.example` secrets into `server/.env` or root `.env` (service role + `CMP_INGEST_SECRET`).
4. Start API: `cd server && npm install && npm start`
5. Start app: `npm run dev`
6. Click **Sync All** (localhost, Andres user).

Chrome Profile 8 opens minimized on `/invoicing?page=1&limit=500` and filters the CMP results to `Client BY agent`. Open balances are retained regardless of invoice age; only paid/closed invoices are limited by the selected window (fast 15, normal 120, deep 365 days). The ingest upserts observations and records a run. It never deletes invoice rows.

Reconciliation can mark missing rows non-current only when the run reports `complete`, is not truncated, contains at least one invoice, and meets `CMP_RECONCILE_MIN_RATIO` (default `0.5`) against the previous current rows in the same agent/date scope. Fast runs never close paid invoices outside their 15-day cutoff. Pagination errors and `CMP_MAX_PAGES` exhaustion do not reconcile.

Set `CMP_INGEST_DRY_RUN=true` in the local environment to submit the same extracted scope for a read-only preview. The API reports `rowsThatWouldClose` without upserting invoices or recording a run. Default: `false`. The preview requires an extracted invoice payload; it does not infer unseen invoices from the current table alone.

The extractor sends `run_id`, mode, page count, row count, cutoff, covered agent IDs, `complete`, and `truncated` to the ingest API. If extraction fails, it makes a best-effort failed-run report; failed/incomplete/empty runs cannot close any rows.
