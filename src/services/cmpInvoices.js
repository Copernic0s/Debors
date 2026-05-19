import { supabase } from '../lib/supabase';

const normalizeMatchKey = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|limited|ltd)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

export const fetchCmpInvoiceCache = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('cmp_invoices')
    .select('company_key,company,invoice_id,amount,captured_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(5000);
  if (error) {
    console.error('[CMP] Failed to fetch cmp_invoices:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
};

export const applyCmpInvoiceOverrides = (rows, cmpItems) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const items = Array.isArray(cmpItems) ? cmpItems : [];
  if (safeRows.length === 0 || items.length === 0) return safeRows;

  const byKey = new Map();
  items.forEach((item) => {
    const companyKey = String(item?.company_key || '').trim() || normalizeMatchKey(item?.company);
    if (!companyKey) return;
    byKey.set(companyKey, item);
  });

  return safeRows.map((row) => {
    const company = String(row?.company || row?.clientName || '').trim();
    if (!company) return row;
    const key = normalizeMatchKey(company);
    const match = byKey.get(key);
    if (!match) return row;

    // Only fill missing invoice fields; never overwrite a sheet-provided invoiceNumber.
    const sheetInvoice = String(row?.invoiceNumber || '').trim();
    const matchInvoice = String(match?.invoice_id || '').trim();
    const nextInvoice = sheetInvoice || matchInvoice;

    // If sheet says $0 but CMP has amount, use CMP amount; do not override non-zero sheet values.
    const rowAmount = Number(row?.amount || 0);
    const cmpAmount = match?.amount === null || match?.amount === undefined ? null : Number(match.amount);
    const nextAmount =
      Number.isFinite(rowAmount) && rowAmount > 0
        ? rowAmount
        : Number.isFinite(cmpAmount)
          ? Number(cmpAmount.toFixed(2))
          : rowAmount;

    return {
      ...row,
      invoiceNumber: nextInvoice,
      amount: nextAmount,
      // Helpful metadata (non-breaking)
      cmpCapturedAt: match?.captured_at || match?.updated_at || null,
      cmpSource: 'cmp'
    };
  });
};

