# CMP automation (Andres workstation only)

1. Run SQL in `supabase/cmp_invoices.sql` in Supabase.
2. Install Python deps: `pip install -r automation/requirements.txt`
3. Copy `.env.example` secrets into `server/.env` or root `.env` (service role + `CMP_INGEST_SECRET`).
4. Start API: `cd server && npm install && npm start`
5. Start app: `npm run dev`
6. Click **Sync All** (localhost, Andres user).

Chrome Profile 8 opens minimized on `/invoicing?page=1&limit=500`, scrapes ~60 days, filters `Client BY agent`, replaces `cmp_invoices` in Supabase.
