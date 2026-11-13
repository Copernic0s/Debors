import { describe, expect, it } from 'vitest';
import { mapCmpInvoiceRows } from './cmpIngest';

describe('serverless CMP invoice mapping', () => {
  it('defaults omitted financial values and preserves explicit zero balances', () => {
    const rows = mapCmpInvoiceRows([
      { companyName: 'Missing totals LLC', invoiceNumber: 'INV-1', amount: 125.5 },
      { companyName: 'Zero balance LLC', invoiceNumber: 'INV-2', amount: 400, totalAmount: 400, remainingAmount: 0, totalPaid: 400 }
    ], 'run-1', '2026-11-12T00:00:00.000Z');

    expect(rows.map(({ total_amount, remaining_amount, total_paid }) => [total_amount, remaining_amount, total_paid]))
      .toEqual([[125.5, 125.5, 0], [400, 0, 400]]);
  });
});
