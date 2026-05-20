const { createClient } = require('@supabase/supabase-js');

const buildRowId = (companyName, invoiceNumber) => {
  const company = String(companyName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const invoice = String(invoiceNumber || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `CMP-${company}-${invoice}`;
};

const ingestCmpSnapshot = async ({ invoices = [], syncRunId, isFastSync }) => {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for CMP ingest');
  }

  const runId = String(syncRunId || require('crypto').randomUUID());
  const syncedAt = new Date().toISOString();

  const rows = (invoices || [])
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
      synced_at: syncedAt
    }));

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // We no longer delete all cmp_invoices before inserting to prevent leaving the database empty on errors.
  // Instead, we will do an upsert, and then clean up any older records that weren't in this sync run.

  if (rows.length > 0) {
    const chunkSize = 500;
    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize);
      const { error: insertError } = await supabase.from('cmp_invoices').upsert(chunk);
      if (insertError) {
        throw new Error(`Failed to upsert cmp_invoices: ${insertError.message}`);
      }
    }
  }

  // Preserve all historical invoices in the database to maintain history across sync runs.
  console.log(`[CMP Ingest] Preserved all historical invoices in the database.`);


  return { syncRunId: runId, count: rows.length, syncedAt };
};

const verifyCmpIngestSecret = (req) => {
  const expected = String(process.env.CMP_INGEST_SECRET || '').trim();
  if (!expected) return true;
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token === expected;
};

module.exports = { ingestCmpSnapshot, verifyCmpIngestSecret };
