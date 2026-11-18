import { describe, expect, it } from 'vitest';
import {
  CMP_STALE_AFTER_MS,
  countRowsRefreshedByRun,
  countStaleOpenCmpInvoices,
  getInvoiceFreshness
} from './cmpFreshness';

const now = Date.parse('2026-11-18T18:00:00.000Z');

describe('CMP invoice freshness', () => {
  it('marks an open invoice stale only after 72 hours without verification', () => {
    const justUnder = getInvoiceFreshness({ remainingAmount: 20, syncedAt: new Date(now - CMP_STALE_AFTER_MS + 1).toISOString() }, now);
    const justOver = getInvoiceFreshness({ remainingAmount: 20, syncedAt: new Date(now - CMP_STALE_AFTER_MS - 1).toISOString() }, now);

    expect(justUnder.isStale).toBe(false);
    expect(justOver.isStale).toBe(true);
  });

  it('treats open invoices with no valid CMP timestamp as unverified', () => {
    expect(getInvoiceFreshness({ amount: 10 }, now)).toMatchObject({
      isOpen: true,
      isUnverified: true,
      isStale: true
    });
    expect(getInvoiceFreshness({ remainingAmount: 0 }, now).isStale).toBe(false);
  });

  it('does not mark a settled invoice stale even when its last sync is old', () => {
    const freshness = getInvoiceFreshness({
      status: 'paid',
      remainingAmount: 0,
      syncedAt: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()
    }, now);

    expect(freshness.isOpen).toBe(false);
    expect(freshness.isStale).toBe(false);
  });

  it('counts distinct invoices seen in the selected runner run', () => {
    expect(countRowsRefreshedByRun([
      { id: 'a', syncRunId: 'run-1' },
      { id: 'a', syncRunId: 'run-1' },
      { id: 'b', syncRunId: 'run-2' },
      { id: 'c', syncRunId: 'run-1' }
    ], 'run-1')).toBe(2);
    expect(countStaleOpenCmpInvoices([
      { id: 'open-stale', remainingAmount: 2, syncedAt: new Date(now - CMP_STALE_AFTER_MS - 1).toISOString() },
      { id: 'paid-old', remainingAmount: 0, syncedAt: new Date(now - CMP_STALE_AFTER_MS * 3).toISOString() }
    ], now)).toBe(1);
  });
});
