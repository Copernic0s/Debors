# CMP Bot - Change Log / Runbook Notes (2026-05-20)

This document summarizes the changes made to the CMP scraper/bot and how it works.

## High-level flow

1. Debors UI (localhost) triggers **Sync All**.
2. Local API (`server/`, port 3001) spawns `automation/run_cmp_bot.ps1`.
3. `run_cmp_bot.ps1` launches Chrome **Profile 8** with `--remote-debugging-port=9222`.
4. Python `automation/cmp_invoice_extractor.py` attaches to the Chrome debugger at `localhost:9222`.
5. Python navigates CMP **Invoicing** and scrapes invoice rows.
6. Python POSTs results to `POST /api/cmp/ingest`.
7. Server ingests and writes to Supabase table `cmp_invoices`.
8. Vercel users see updates because the app reads `cmp_invoices` from Supabase.

## Key fixes added

### 1) Correct Chrome profile reuse (PowerShell quoting)
File: `automation/run_cmp_bot.ps1`

- Properly quotes arguments containing spaces:
  - `--user-data-dir="...\\User Data"`
  - `--profile-directory="Profile 8"`
- Prevents Chrome from opening the wrong profile (which looks logged out).

### 2) Stabilize auth when attached to an existing profile (tab switching)
File: `automation/cmp_invoice_extractor.py`

- Adds logic to scan all open tabs and switch to an existing authenticated `/invoicing` tab
  if the current tab is redirected to `/auth`.

### 3) Pagination by URL instead of clicking "Next"
File: `automation/cmp_invoice_extractor.py`

- Uses `?page=N&limit=500` to paginate.
- Avoids brittle selectors on CMP's paging UI.

### 4) Fix "debugger localhost:9222 not reachable"
File: `automation/run_cmp_bot.ps1`

- Ensures Chrome is fully closed before launching with `--remote-debugging-port=9222`.
- This matters because if Chrome is already running, Windows may reuse the existing process
  and Chrome will ignore the remote debugging flag.

### 5) Debugging visibility toggle (show/hide the Chrome window)
File: `automation/run_cmp_bot.ps1`

- Env var: `CMP_SHOW_BROWSER`
  - `true` => visible Chrome window
  - `false` => minimized / off-screen (default)

## Debugging endpoints

- Status: `http://localhost:3001/api/cmp/status`
- Log tail: `http://localhost:3001/api/cmp/log`

If the log appears stale, check `logMtime` in `/api/cmp/status`.

## Common failure modes

1. `/auth` loop:
   - Profile opened without the real session, or session expired.
   - Fix: ensure Profile 8 is used + login once in the automation-launched window.

2. `debugger localhost:9222 not reachable`:
   - Chrome was already running and didn't open 9222.
   - Fix: the script now force-closes Chrome before launching.

3. Page 1 only:
   - Pagination UI changed / click-next was brittle.
   - Fix: pagination by URL was added.

