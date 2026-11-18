import { describe, expect, it, vi } from 'vitest';
import { loadDashboardDataSources } from './dashboardDataSources';

describe('loadDashboardDataSources', () => {
  it('loads CMP and preserves cached Zoho data when WorkDrive fails', async () => {
    const workDriveError = new Error('WorkDrive unavailable');
    const cachedZoho = {
      debtors: [{ id: 'cached' }],
      clientsByAgent: [{ company: 'Acme', agentId: 'Angee Rincon' }],
      trackerLogs: null
    };
    const loadCmp = vi.fn(async () => ({ rows: [{ id: 'cmp-1' }], expected: 1 }));

    const result = await loadDashboardDataSources({
      loadZoho: async () => { throw workDriveError; },
      loadCmp,
      previousZoho: cachedZoho
    });

    expect(result.zoho).toBe(cachedZoho);
    expect(result.zohoError).toBe(workDriveError);
    expect(result.cmp.rows).toEqual([{ id: 'cmp-1' }]);
    expect(result.cmpError).toBeNull();
    expect(loadCmp).toHaveBeenCalledOnce();
  });

  it('loads CMP without any prior Zoho rows', async () => {
    const result = await loadDashboardDataSources({
      loadZoho: async () => { throw new Error('offline'); },
      loadCmp: async () => ({ rows: [{ id: 'cmp-1' }], expected: 1 })
    });

    expect(result.cmp).toEqual({ rows: [{ id: 'cmp-1' }], expected: 1 });
    expect(result.zoho.debtors).toEqual([]);
  });
});
