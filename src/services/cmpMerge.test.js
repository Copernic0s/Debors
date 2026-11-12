import { describe, expect, it } from 'vitest';
import { mapCmpInvoicesToDebtorRows, mergeZohoWithCmpRows } from './cmpMerge';

describe('CMP agent attribution', () => {
  it('prefers the agent scope persisted on the invoice row', () => {
    const [invoice] = mapCmpInvoicesToDebtorRows([
      { id: '1', company_name: 'Acme LLC', invoice_number: 'INV-1', agent_id: 'jose rivera' }
    ], [
      { company: 'Acme LLC', agentId: 'another agent' }
    ]);

    expect(invoice.agentId).toBe('jose rivera');
  });

  it('keeps ambiguous or missing assignments unassigned for scoped access', () => {
    const [invoice] = mapCmpInvoicesToDebtorRows([
      { id: '1', company_name: 'Acme LLC', invoice_number: 'INV-1', agent_id: null }
    ], []);

    expect(invoice.agentId).toBe('Unassigned');
  });
});

describe('CMP and Zoho merge', () => {
  it('deduplicates normalized invoice numbers for the same company but keeps distinct Zoho invoices', () => {
    const cmpRows = mapCmpInvoicesToDebtorRows([
      { id: 'cmp-1', company_name: 'Acme LLC', invoice_number: 'INV-001' }
    ], []);
    const merged = mergeZohoWithCmpRows([
      { id: 'zoho-duplicate', company: 'ACME, LLC', invoiceNumber: '001', source: 'debt' },
      { id: 'zoho-unique', company: 'Acme LLC', invoiceNumber: 'INV-002', source: 'debt' },
      { id: 'unrelated', company: 'Other LLC', invoiceNumber: '001', source: 'debt' }
    ], cmpRows);

    expect(merged.map(({ id }) => id)).toEqual(['cmp-1', 'zoho-unique', 'unrelated']);
  });
});
