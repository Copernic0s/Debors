export const fetchCmpInvoices = async (supabase) => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('cmp_invoices')
    .select('*')
    .order('invoice_date', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load CMP invoices');
  }

  return data || [];
};

export const fetchCmpSyncMeta = async (supabase) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('cmp_invoices')
    .select('synced_at, sync_run_id')
    .order('synced_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0];
};

export const openCmpInvoicePdf = async (supabase, row) => {
  const path = String(row?.pdfStoragePath || row?.pdf_storage_path || '').trim();
  if (!supabase || !path) {
    throw new Error('PDF is not available for this invoice yet');
  }

  const { data, error } = await supabase.storage
    .from('cmp-invoices')
    .createSignedUrl(path, 60 * 15);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not open invoice PDF');
  }

  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
};

export const requestCmpInvoicePdf = async (runnerApiBase, row) => {
  if (!runnerApiBase) {
    throw new Error('PDF fetching requires the local CMP runner');
  }

  const response = await fetch(`${runnerApiBase}/api/cmp/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNumber: row?.invoiceNumber,
      companyName: row?.company || row?.clientName,
      invoiceId: row?.id
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Could not request invoice PDF');
  }
  return payload;
};

export const queueCmpInvoicePdf = async (supabase, row) => {
  if (!supabase) {
    throw new Error('Supabase client is required to queue PDF download');
  }

  const invoiceNumber = String(row?.invoiceNumber || '').trim();
  if (!invoiceNumber) {
    throw new Error('Invoice number is required to queue PDF download');
  }

  const { data, error } = await supabase
    .from('cmp_invoices')
    .update({
      pdf_status: 'queued',
      pdf_error: null
    })
    .eq('invoice_number', invoiceNumber);

  if (error) {
    throw new Error(error.message || 'Failed to queue PDF download');
  }

  return data;
};
