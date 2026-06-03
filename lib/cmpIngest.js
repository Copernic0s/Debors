import { createClient } from '@supabase/supabase-js';

const buildRowId = (companyName, invoiceNumber) => {
  const company = String(companyName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const invoice = String(invoiceNumber || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `CMP-${company}-${invoice}`;
};

export const ingestCmpSnapshot = async ({ invoices = [], syncRunId }, env = process.env) => {
  const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for CMP ingest');
  }

  if (!Array.isArray(invoices)) {
    throw new Error('invoices must be an array');
  }

  const runId = String(syncRunId || crypto.randomUUID());
  const syncedAt = new Date().toISOString();

  const rows = invoices
    .filter((item) => item?.companyName && item?.invoiceNumber)
    .map((item) => ({
      id: buildRowId(item.companyName, item.invoiceNumber),
      invoice_number: String(item.invoiceNumber).trim(),
      company_name: String(item.companyName).trim(),
      amount: Number(item.amount) || 0,
      invoice_date: item.invoiceDate || null,
      due_date: item.dueDate || null,
      status: String(item.status || 'pending').toLowerCase(),
      cmp_status_raw: item.cmpStatusRaw || null,
      sync_run_id: runId,
      synced_at: syncedAt,
      total_amount: Number(item.totalAmount) !== undefined ? Number(item.totalAmount) : (Number(item.amount) || 0),
      remaining_amount: Number(item.remainingAmount) !== undefined ? Number(item.remainingAmount) : (Number(item.amount) || 0),
      total_paid: Number(item.totalPaid) !== undefined ? Number(item.totalPaid) : 0,
      billing_type: item.billingType || null
    }));

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (rows.length === 0) {
    return { syncRunId: runId, count: 0, syncedAt };
  }

  const chunkSize = 500;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error: insertError } = await supabase.from('cmp_invoices').upsert(chunk);
    if (insertError) {
      throw new Error(`Failed to upsert cmp_invoices: ${insertError.message}`);
    }
  }

  return { syncRunId: runId, count: rows.length, syncedAt };
};

export const verifyCmpIngestSecret = (req, env = process.env) => {
  const expected = String(env.CMP_INGEST_SECRET || '').trim();
  if (!expected) return true;
  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token === expected;
};
