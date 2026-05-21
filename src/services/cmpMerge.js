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

    return {
      id: String(row.id || `CMP-INV-${companyKey}-${row.invoice_number}`),
      invoiceNumber: String(row.invoice_number || '').trim(),
      company,
      clientName: company,
      agentId: meta.agentId,
      billingCycle: meta.billingCycle,
      amount: Number(row.amount) || 0,
      dueDate: row.due_date || '',
      status: String(row.status || 'pending').toLowerCase(),
      weekLabel: 'CMP',
      source: 'cmp',
      invoiceDate: row.invoice_date || null,
      cmpStatusRaw: row.cmp_status_raw || null,
      syncedAt: row.synced_at || null,
      pdfStoragePath: row.pdf_storage_path || null,
      pdfStatus: row.pdf_status || (row.pdf_storage_path ? 'available' : 'missing'),
      pdfDownloadedAt: row.pdf_downloaded_at || null,
      pdfError: row.pdf_error || null
    };
  });
};

export const mergeZohoWithCmpRows = (zohoRows, cmpDebtorRows) => {
  const cmpCompanies = new Set(
    cmpDebtorRows.map((row) => normalizeMatchKey(row.company || row.clientName)).filter(Boolean)
  );

  const cmpInvoiceKeys = new Set(
    cmpDebtorRows
      .map((row) => {
        const companyKey = normalizeMatchKey(row.company || row.clientName);
        const invoiceKey = normalizeMatchKey(row.invoiceNumber);
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

    const invoiceKey = `${companyKey}|${normalizeMatchKey(row.invoiceNumber)}`;
    if (row.invoiceNumber && cmpInvoiceKeys.has(invoiceKey)) {
      return false;
    }

    if (row.source === 'debt' || row.invoiceNumber) {
      return false;
    }

    return true;
  });

  return [...cmpDebtorRows, ...filteredZoho];
};
