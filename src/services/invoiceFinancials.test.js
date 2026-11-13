import { describe, expect, it } from 'vitest';
import { aggregateByCompany } from '../hooks/useDebtors';
import { invoiceFinancials, sortInvoicesNewestFirst } from './invoiceFinancials';

describe('invoiceFinancials', () => {
  it('keeps partial invoice totals in integer cents', () => {
    expect(invoiceFinancials({
      status: 'pending',
      totalAmount: 1000,
      totalPaid: 400,
      remainingAmount: 600,
      amount: 600
    })).toEqual({ invoiced: 100000, paid: 40000, due: 60000, financialMismatch: false });
  });

  it('treats a paid invoice as settled and supports legacy Zoho amounts', () => {
    expect(invoiceFinancials({ status: 'paid', totalAmount: 1000, amount: 1000 })).toMatchObject({
      invoiced: 100000,
      paid: 100000,
      due: 0
    });
    expect(invoiceFinancials({ status: 'pending', amount: 0.1 + 0.2 })).toMatchObject({
      invoiced: 30,
      paid: 0,
      due: 30
    });
  });

  it('reports inconsistencies without changing source amounts', () => {
    expect(invoiceFinancials({ totalAmount: 100, totalPaid: 40, remainingAmount: 20 })).toMatchObject({
      invoiced: 10000,
      paid: 4000,
      due: 2000,
      financialMismatch: true
    });
  });

  it('sorts invoice dates newest first with due date fallback', () => {
    const rows = [
      { id: 'older', invoiceNumber: 'INV-1', invoiceDate: '2026-01-01' },
      { id: 'newest', invoiceNumber: 'INV-3', invoiceDate: '2026-03-01' },
      { id: 'middle', invoiceNumber: 'INV-2', dueDate: '2026-02-01' }
    ];

    expect(sortInvoicesNewestFirst(rows).map((row) => row.id)).toEqual(['newest', 'middle', 'older']);
  });
});

describe('aggregateByCompany financial totals', () => {
  it('canonicalizes duplicate active agent spellings and omits inactive agents from the company label', () => {
    const [company] = aggregateByCompany([
      { id: 'one', company: 'Acme LLC', agentId: 'Hector Lomeli', invoiceNumber: 'INV-1', status: 'pending', amount: 100, totalAmount: 100, remainingAmount: 100, dueDate: '2099-01-01' },
      { id: 'two', company: 'Acme LLC', agentId: 'Héctor Lomelí', invoiceNumber: 'INV-2', status: 'pending', amount: 200, totalAmount: 200, remainingAmount: 200, dueDate: '2099-01-02' },
      { id: 'three', company: 'Acme LLC', agentId: 'Francesco Rinaldelli', invoiceNumber: 'INV-3', status: 'pending', amount: 300, totalAmount: 300, remainingAmount: 300, dueDate: '2099-01-03' }
    ]);

    expect(company.agentId).toBe('Hector Lomeli');
    expect(company.totalDue).toBe(600);
  });

  it('sums partial balances and multiple overdue invoices without floating point drift', () => {
    const result = aggregateByCompany([
      { id: 'one', company: 'Acme LLC', invoiceNumber: 'INV-1', status: 'overdue', amount: 600, totalAmount: 1000, remainingAmount: 600, totalPaid: 400, dueDate: '2026-05-01' },
      { id: 'two', company: 'Acme LLC', invoiceNumber: 'INV-2', status: 'overdue', amount: 250.1, totalAmount: 250.1, remainingAmount: 250.1, totalPaid: 0, dueDate: '2026-05-05' },
      { id: 'three', company: 'Acme LLC', invoiceNumber: 'INV-3', status: 'pending', amount: 0.1, totalAmount: 0.1, remainingAmount: 0.1, totalPaid: 0, dueDate: '2099-01-01' },
      { id: 'four', company: 'Acme LLC', invoiceNumber: 'INV-4', status: 'pending', amount: 0.2, totalAmount: 0.2, remainingAmount: 0.2, totalPaid: 0, dueDate: '2099-01-02' }
    ])[0];

    expect(result.totalInvoiced).toBe(1250.4);
    expect(result.totalPaid).toBe(400);
    expect(result.totalDue).toBe(850.4);
    expect(result.totalOverdue).toBe(850.1);
    expect(result.overdueInvoiceCount).toBe(2);
  });
});
