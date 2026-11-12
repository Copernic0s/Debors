import { describe, expect, it } from 'vitest';
import { companyProfileRowMatchesWeek } from './companyProfile';
import { sortInvoicesNewestFirst } from './invoiceFinancials';

describe('company profile invoice scope', () => {
  it('keeps CMP invoices visible when a weekly Zoho filter is selected', () => {
    expect(companyProfileRowMatchesWeek({ source: 'cmp', weekLabel: 'CMP' }, '2026-45')).toBe(true);
    expect(companyProfileRowMatchesWeek({ source: 'zoho', weekLabel: '2026-44' }, '2026-45')).toBe(false);
    expect(companyProfileRowMatchesWeek({ source: 'zoho', weekLabel: '2026-45' }, '2026-45')).toBe(true);
  });

  it('orders mixed invoice date formats by parsed date newest first', () => {
    const rows = [
      { id: 'older', invoiceDate: '2026-01-02' },
      { id: 'newest', invoiceDate: '2026-11-12T10:30:00Z' },
      { id: 'middle', invoiceDate: '2026-05-01T00:00:00-05:00' }
    ];

    expect(sortInvoicesNewestFirst(rows).map(({ id }) => id)).toEqual(['newest', 'middle', 'older']);
  });
});
