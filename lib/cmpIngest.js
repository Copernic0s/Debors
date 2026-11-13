import { createClient } from '@supabase/supabase-js';
import { randomUUID, timingSafeEqual } from 'node:crypto';

export const MIN_INGEST_SECRET_LENGTH = 32;

export const getConfiguredIngestSecret = (env = process.env) => {
  const secret = String(env.CMP_INGEST_SECRET || '').trim();
  return secret.length >= MIN_INGEST_SECRET_LENGTH ? secret : null;
};

const buildRowId = (companyName, invoiceNumber) => {
  const company = String(companyName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const invoice = String(invoiceNumber || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `CMP-${company}-${invoice}`;
};

const finiteAmountOr = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
};

export const mapCmpInvoiceRows = (invoices, runId, syncedAt) => invoices
  .filter((item) => item?.companyName && item?.invoiceNumber)
  .map((item) => {
    const amount = finiteAmountOr(item.amount, 0);
    return {
      id: buildRowId(item.companyName, item.invoiceNumber),
      invoice_number: String(item.invoiceNumber).trim(),
      company_name: String(item.companyName).trim(),
      agent_id: String(item.agentId || '').trim() || null,
      amount,
      invoice_date: item.invoiceDate || null,
      due_date: item.dueDate || null,
      status: String(item.status || 'pending').toLowerCase(),
      cmp_status_raw: item.cmpStatusRaw || null,
      sync_run_id: runId,
      synced_at: syncedAt,
      total_amount: finiteAmountOr(item.totalAmount, amount),
      remaining_amount: finiteAmountOr(item.remainingAmount, amount),
      total_paid: finiteAmountOr(item.totalPaid, 0),
      billing_type: item.billingType || null
    };
  });

export const ingestCmpSnapshot = async ({
  invoices = [], syncRunId, startedAt, runStatus, mode, pagesScraped,
  rowsExtracted, truncated, cutoffDate, scopeAgentIds, dryRun = false
}, env = process.env) => {
  const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for CMP ingest');
  }

  if (!Array.isArray(invoices)) {
    throw new Error('invoices must be an array');
  }

  const runId = String(syncRunId || randomUUID());
  const syncedAt = new Date().toISOString();
  const rows = mapCmpInvoiceRows(invoices, runId, syncedAt);
  const pageCount = Number(pagesScraped);
  const extractedCount = Number(rowsExtracted ?? rows.length);
  const coveredAgentIds = Array.isArray(scopeAgentIds)
    ? [...new Set(scopeAgentIds.map((value) => String(value ?? '').trim()).filter(Boolean))]
    : [];
  if (!Number.isInteger(pageCount) || pageCount < 0
      || !Number.isInteger(extractedCount) || extractedCount !== rows.length) {
    throw new Error('Invalid CMP run page or invoice counts');
  }
  const ratioValue = Number(env.CMP_RECONCILE_MIN_RATIO || 0.5);
  if (!Number.isFinite(ratioValue) || ratioValue < 0 || ratioValue > 1) {
    throw new Error('CMP reconciliation ratio must be between 0 and 1');
  }
  if (!['complete', 'incomplete', 'failed'].includes(runStatus)) {
    throw new Error('CMP run status is required');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cutoffDate || ''))) {
    throw new Error('CMP run cutoff date is required');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await supabase.rpc('apply_cmp_sync_run', {
    p_run_id: runId,
    p_started_at: startedAt || null,
    p_rows: rows,
    p_status: runStatus,
    p_mode: mode || 'unknown',
    p_pages_scraped: pageCount,
    p_rows_extracted: extractedCount,
    p_truncated: truncated === true,
    p_cutoff_date: cutoffDate,
    p_scope_agent_ids: coveredAgentIds,
    p_reconcile_min_ratio: ratioValue,
    p_dry_run: dryRun === true
  });
  if (error) throw new Error(`CMP snapshot transaction failed: ${error.message}`);

  return {
    syncRunId: runId,
    count: dryRun === true ? 0 : rows.length,
    syncedAt,
    ...data
  };
};

export const verifyCmpIngestSecret = (req, env = process.env) => {
  const expected = getConfiguredIngestSecret(env);
  if (!expected) return false;
  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  return tokenBuffer.length === expectedBuffer.length && timingSafeEqual(tokenBuffer, expectedBuffer);
};
