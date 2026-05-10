# Debors

Operational dashboard for debtor tracking, invoice follow-up, and support workflow visibility.

Debors was built to reduce manual operational work across collections and support processes. It centralizes portfolio visibility by agent, keeps invoice status and debt tracking in one place, and adds automation support for environments where direct API access is limited or unavailable.

## Why this project exists

Teams working across spreadsheets, shared workbooks, and internal platforms were spending too much time on repetitive tasks:

- validating invoice amounts manually
- checking portfolio status by agent
- tracking overdue balances
- following support tasks and callbacks
- reconciling data across multiple operational sources

Debors turns those fragmented workflows into a single operational interface with synced debtor data, editable invoice details, support follow-ups, and automation-assisted extraction.

## What Debors does

- Syncs debtor and portfolio data from a Zoho workbook ingestion flow
- Displays debtor dashboards and agent-level operational views
- Supports invoice editing and manual operational overrides
- Tracks support follow-ups and shared team state
- Applies access control by user profile and portfolio scope
- Persists shared operational state with Supabase
- Includes Python + Selenium automation for invoice lookup in CMP when no direct integration is available

## Core features

### Dashboard and debtor operations

- Active debt, overdue debt, collection effectiveness, and client visibility
- Searchable and editable debtor list
- Company profile modal with invoice breakdown
- Manual invoice entry and quick debt adjustments

### Portfolio visibility

- Portfolio scoping by agent
- Shared company overrides and team state
- Manager analytics and aggregated operational views

### Support workflow tracking

- Follow-up tracking for operational support tasks
- Shared comments, status handling, and ownership visibility
- SLA-oriented workflow support for callback and follow-up monitoring

### Automation

- Selenium-based CMP extractor under [automation/cmp_invoice_extractor.py](/C:/Users/AndresMendez/Downloads/Debors-main/Debors/automation/cmp_invoice_extractor.py)
- Reads client targets from the Zoho workbook or a local file
- Extracts invoice identifiers and amounts for downstream reconciliation
- Built to run locally when corporate network constraints limit system integrations

## Tech stack

- Frontend: React 19, Vite, styled-components, Recharts, lucide-react
- Data layer: Supabase, Zoho workbook ingestion, JSON interchange
- Automation: Python, Selenium, Pandas, openpyxl
- Deployment: Vercel

## Architecture at a glance

- [src/App.jsx](/C:/Users/AndresMendez/Downloads/Debors-main/Debors/src/App.jsx): app shell, sync orchestration, top-level state
- [src/components](/C:/Users/AndresMendez/Downloads/Debors-main/Debors/src/components): UI modules for dashboard, analytics, invoice entry, tracker, and modal flows
- [src/hooks](/C:/Users/AndresMendez/Downloads/Debors-main/Debors/src/hooks): session, shared state, derived views, manual edits, and overview actions
- [src/services](/C:/Users/AndresMendez/Downloads/Debors-main/Debors/src/services): Zoho ingestion, shared app state, persistence helpers, and activity logging
- [api/debtors.js](/C:/Users/AndresMendez/Downloads/Debors-main/Debors/api/debtors.js): server-side workbook parsing endpoint used by the frontend sync flow
- [automation](/C:/Users/AndresMendez/Downloads/Debors-main/Debors/automation): browser automation scripts for invoice extraction

## Local development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Environment notes

The app expects environment variables for Supabase and may also use deployment-level configuration for API routing.

Typical frontend environment values include:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=...
VITE_OPERATIONS_EMAILS=...
VITE_MANAGER_EMAILS=...
VITE_AGENT_SCOPE_MAP=...
```

## Automation workflow

The CMP extractor can run with either:

- a Zoho workbook input source
- a local CSV or JSON file

Main setup docs live in [automation/README.md](/C:/Users/AndresMendez/Downloads/Debors-main/Debors/automation/README.md).

Typical setup:

```bash
pip install -r automation/requirements.txt
python automation/cmp_invoice_extractor.py
```

## Deployment

This project is configured for Vercel-style routing via [vercel.json](/C:/Users/AndresMendez/Downloads/Debors-main/Debors/vercel.json), including:

- frontend SPA rewrites
- `/api/debtors` backend ingestion route

## Impact

Debors is designed to improve day-to-day operational execution by:

- reducing repetitive invoice validation work
- lowering copy/paste and reconciliation errors
- improving visibility across debtor portfolios
- supporting faster follow-up handling for operational teams
- enabling local-first automation when direct integrations are not practical

## Portfolio note

This repository represents a real operational workflow problem translated into product and automation work: frontend dashboarding, shared state design, role-based visibility, and browser automation for unavailable APIs.
