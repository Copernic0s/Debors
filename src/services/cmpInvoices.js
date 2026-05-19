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
