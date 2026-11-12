import { describe, expect, it } from 'vitest';
import { mapCmpInvoicesToDebtorRows } from './cmpMerge';

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
