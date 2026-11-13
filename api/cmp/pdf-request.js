import { createClient } from '@supabase/supabase-js';
import pdfAuthorization from '../../server/cmpPdfAuthorization.cjs';

const { canAccessCmpInvoicePdf } = pdfAuthorization;

const jsonError = (res, status, message) => {
  return res.status(status).json({ error: message });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed');
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) {
    return jsonError(
      res,
      500,
      'Missing Supabase service credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.'
    );
  }

  const authHeader = String(req.headers.authorization || '');
  const accessToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  if (!accessToken) {
    return jsonError(res, 401, 'Authentication is required');
  }

  const invoiceId = String(req.body?.invoiceId || '').trim();
  if (!invoiceId) {
    return jsonError(res, 400, 'invoiceId is required');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return jsonError(res, 401, 'Invalid session');
  }

  const [{ data: invoices, error: invoiceError }, { data: scopes, error: scopeError }, { data: viewer, error: viewerError }] = await Promise.all([
    supabase.from('cmp_invoices').select('id, invoice_number, company_name, agent_id').eq('id', invoiceId).limit(1),
    supabase.from('agent_scopes').select('agent_id, is_manager').eq('user_id', userData.user.id),
    supabase.from('cmp_billing_viewers').select('user_id').eq('user_id', userData.user.id).limit(1)
  ]);

  if (invoiceError || scopeError || viewerError) {
    return jsonError(res, 500, 'Could not verify CMP PDF permissions');
  }

  const invoice = invoices?.[0];
  if (!invoice) {
    return jsonError(res, 404, 'Invoice was not found in CMP invoices');
  }

  if (!canAccessCmpInvoicePdf({
    scopes: scopes || [],
    invoiceAgentId: invoice.agent_id,
    isBillingViewer: Boolean(viewer?.length)
  })) {
    return jsonError(res, 403, 'You are not allowed to request this invoice PDF');
  }

  const requestedAt = new Date().toISOString();
  const queueUpdate = async (includeRequestedAt) => {
    const update = {
      pdf_status: 'queued',
      pdf_error: null
    };
    if (includeRequestedAt) {
      update.pdf_requested_at = requestedAt;
    }

    return supabase
      .from('cmp_invoices')
      .update(update)
      .eq('id', invoice.id)
      .select(includeRequestedAt
        ? 'invoice_number, company_name, pdf_status, pdf_requested_at'
        : 'invoice_number, company_name, pdf_status');
  };

  let { data, error } = await queueUpdate(true);
  if (error && String(error.message || '').includes('pdf_requested_at')) {
    ({ data, error } = await queueUpdate(false));
  }

  if (error) {
    return jsonError(res, 500, error.message || 'Failed to queue PDF download');
  }

  if (!data?.length) {
    return jsonError(res, 404, 'Invoice was not found in CMP invoices');
  }

  return res.status(200).json({ ok: true, invoice: data[0] });
}
