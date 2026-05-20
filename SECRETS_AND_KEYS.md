# Secrets / Keys (Debors)

This project uses environment variables for Supabase and local automation.

## Which keys exist?

1. `VITE_SUPABASE_ANON_KEY` (Frontend)
   - Public key used by the browser app.
   - Expected to be present in Vercel Environment Variables.
   - Can be rotated if accidentally shared.

2. `SUPABASE_SERVICE_ROLE_KEY` (Local backend only)
   - Secret key.
   - Never put it in `VITE_*` variables, never commit it, never expose it to the browser.
   - Use only in local `.env` (repo root) and/or `server/.env`.

3. `CMP_INGEST_SECRET` (Optional)
   - If set, protects the local endpoint `/api/cmp/ingest`.
   - Keep it local (root `.env` or `server/.env`) and do not commit it.

## Where do I put them?

1. Local development (your PC)
   - Copy `.env.example` to `.env` in the repo root and fill values.
   - Optionally, copy `server/.env.example` to `server/.env` instead.

2. Vercel
   - Add the following in Vercel Project -> Environment Variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_API_URL` (only if the frontend needs a hosted API)

## Rotation checklist

If a key was pasted in chat, screenshots, or committed:

1. Rotate/revoke the key in Supabase.
2. Update it in:
   - your local `.env` (repo root) and/or `server/.env`
   - Vercel Environment Variables (for `VITE_SUPABASE_ANON_KEY`)
3. Redeploy Vercel if needed.

