import { normalizeMatchKey } from '../utils/normalizers';
import { normalizeBillingCycle } from '../constants/billingCycles';

const buildAgentAndCycleLookup = (clientsByAgent) => {
  const lookup = new Map();
  (clientsByAgent || []).forEach((row) => {
    const key = normalizeMatchKey(row.company);
    if (!key) return;
    lookup.set(key, {
      agentId: String(row.agentId || 'Unassigned').trim() || 'Unassigned',
      billingCycle: normalizeBillingCycle(row.billingCycle)
    });
  });
  return lookup;
};

export const mapCmpInvoicesToDebtorRows = (cmpInvoices, clientsByAgent) => {
  const metaByCompany = buildAgentAndCycleLookup(clientsByAgent);

  return (cmpInvoices || []).map((row) => {
    const company = String(row.company_name || '').trim();
    const companyKey = normalizeMatchKey(company);
    const meta = metaByCompany.get(companyKey) || { agentId: 'Unassigned', billingCycle: undefined };

    const pdfStoragePath = row.pdf_storage_path || null;

    return {
      id: String(row.id || `CMP-INV-${companyKey}-${row.invoice_number}`),
      invoiceNumber: String(row.invoice_number || '').trim(),
      company,
      clientName: company,
      agentId: meta.agentId,
      billingCycle: meta.billingCycle,
      amount: Number(row.amount) || 0,
      totalAmount: row.total_amount !== undefined && row.total_amount !== null ? Number(row.total_amount) : (Number(row.amount) || 0),
      remainingAmount: row.remaining_amount !== undefined && row.remaining_amount !== null ? Number(row.remaining_amount) : (Number(row.amount) || 0),
      totalPaid: Number(row.total_paid) || 0,
      billingType: row.billing_type || null,
      dueDate: row.due_date || '',
      status: String(row.status || 'pending').toLowerCase(),
      weekLabel: 'CMP',
      source: 'cmp',
      invoiceDate: row.invoice_date || null,
      cmpStatusRaw: row.cmp_status_raw || null,
      syncedAt: row.synced_at || null,
      pdfStoragePath,
      pdfStatus: pdfStoragePath ? 'available' : (row.pdf_status || 'missing'),
      pdfDownloadedAt: row.pdf_downloaded_at || null,
      pdfRequestedAt: row.pdf_requested_at || null,
      pdfError: row.pdf_error || null
    };
  });
};

export const mergeZohoWithCmpRows = (zohoRows, cmpDebtorRows) => {
  const cmpCompanies = new Set(
    cmpDebtorRows.map((row) => normalizeMatchKey(row.company || row.clientName)).filter(Boolean)
  );

  const normalizeInvoiceNum = (inv) => {
    return String(inv || '')
      .trim()
      .toLowerCase()
      .replace(/^inv[-_]*/i, '')
      .replace(/^0+/, '')
      .replace(/[^a-z0-9]/g, '');
  };

  const cmpInvoiceKeys = new Set(
    cmpDebtorRows
      .map((row) => {
        const companyKey = normalizeMatchKey(row.company || row.clientName);
        const invoiceKey = normalizeInvoiceNum(row.invoiceNumber);
        return companyKey && invoiceKey ? `${companyKey}|${invoiceKey}` : '';
      })
      .filter(Boolean)
  );

  const filteredZoho = (zohoRows || []).filter((row) => {
    const companyKey = normalizeMatchKey(row.company || row.clientName);
    if (!cmpCompanies.has(companyKey)) return true;

    if (String(row.id || '').startsWith('CS-')) {
      const hasCmpForCompany = cmpDebtorRows.some(
        (cmpRow) => normalizeMatchKey(cmpRow.company) === companyKey
      );
      return !hasCmpForCompany;
    }

    const invoiceKey = `${companyKey}|${normalizeInvoiceNum(row.invoiceNumber)}`;
    if (row.invoiceNumber && cmpInvoiceKeys.has(invoiceKey)) {
      return false;
    }

    // Keep unique Zoho invoices (where the normalized invoice number doesn't match CMP)
    if (row.invoiceNumber) {
      return true;
    }

    // If it's a debt row but has no invoice number, discard it if we already have CMP invoices for this company to avoid duplicate placeholders/empty entries
    if (row.source === 'debt') {
      return false;
    }

    return true;
  });

  return [...cmpDebtorRows, ...filteredZoho];
};
