import { createClient } from '@supabase/supabase-js';

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const readBody = async (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const normalizeMatchKey = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|limited|ltd)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const expectedSecret = process.env.CMP_UPLOAD_SECRET;
  const auth = req.headers.authorization || '';
  const gotSecret = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';

  if (!expectedSecret || gotSecret !== expectedSecret) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  try {
    const raw = await readBody(req);
    const payload = raw ? JSON.parse(raw) : null;
    const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];

    if (items.length === 0) {
      return json(res, 400, { error: 'No items provided' });
    }

    const nowIso = new Date().toISOString();
    const upserts = items
      .map((row) => {
        const company = String(row?.client_name || row?.company || '').trim();
        if (!company) return null;
        const companyKey = String(row?.company_key || '').trim() || normalizeMatchKey(company);
        if (!companyKey) return null;
        const amount = row?.amount === null || row?.amount === undefined ? null : Number(row.amount);
        return {
          company_key: companyKey,
          company,
          invoice_id: row?.invoice_id ? String(row.invoice_id).trim() : null,
          amount: Number.isFinite(amount) ? amount : null,
          captured_at: row?.last_update ? new Date(row.last_update).toISOString() : nowIso,
          source: row?.source ? String(row.source).trim() : 'cmp_scraper'
        };
      })
      .filter(Boolean);

    const { error } = await supabase.from('cmp_invoices').upsert(upserts, { onConflict: 'company_key' });
    if (error) throw error;

    return json(res, 200, { ok: true, count: upserts.length });
  } catch (error) {
    return json(res, 500, { error: error?.message || 'Unknown error' });
  }
}

