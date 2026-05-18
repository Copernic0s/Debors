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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const expectedSecret = process.env.TRACKER_UPLOAD_SECRET;
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

    const upserts = items
      .map((row) => {
        const id = row?.id ? String(row.id).trim() : '';
        const company = String(row?.company || '').trim();
        if (!id || !company) return null;

        const dateValue = row?.date ? String(row.date).trim() : '';
        const parsedDate = dateValue ? new Date(dateValue) : null;
        const dateIso = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : null;

        return {
          id,
          created_by: row?.created_by ? String(row.created_by).trim().toLowerCase() : null,
          date: dateIso,
          company,
          agent: row?.agent ? String(row.agent).trim() : null,
          task: row?.task ? String(row.task).trim() : null,
          status: row?.status ? String(row.status).trim() : null,
          notes: row?.notes ? String(row.notes).trim() : null
        };
      })
      .filter(Boolean);

    const { error } = await supabase.from('tracker_entries').upsert(upserts, { onConflict: 'id' });
    if (error) throw error;

    return json(res, 200, { ok: true, count: upserts.length });
  } catch (error) {
    return json(res, 500, { error: error?.message || 'Unknown error' });
  }
}

