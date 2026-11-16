import { describe, expect, it } from 'vitest';
import { getCmpSyncStalenessWarning } from './cmpSyncWarning';

describe('CMP sync staleness banner', () => {
  const lastSuccessfulSync = { timestamp: '2026-11-16T11:00:00.000Z' };
  const lastRunError = { failureReason: 'mfa_required' };

  it('shows after eight elapsed hours during the Bogota work window on weekdays', () => {
    const result = getCmpSyncStalenessWarning(
      { lastSuccessfulSync, lastRunError },
      new Date('2026-11-16T20:00:00.000Z')
    );
    expect(result).toEqual({ timestamp: lastSuccessfulSync.timestamp, failureReason: 'mfa_required' });
  });

  it('does not show at or before the eight-hour threshold', () => {
    expect(getCmpSyncStalenessWarning(
      { lastSuccessfulSync }, new Date('2026-11-16T19:00:00.000Z')
    )).toBeNull();
  });

  it('does not show outside the weekday 7:00-20:00 Bogota window', () => {
    const status = { lastSuccessfulSync: { timestamp: '2026-11-16T01:00:00.000Z' } };
    expect(getCmpSyncStalenessWarning(status, new Date('2026-11-16T11:30:00.000Z'))).toBeNull();
    expect(getCmpSyncStalenessWarning(status, new Date('2026-11-15T20:00:00.000Z'))).toBeNull();
  });

  it('uses a stable fallback when no failure reason has been recorded', () => {
    const result = getCmpSyncStalenessWarning(
      { lastSuccessfulSync }, new Date('2026-11-16T20:00:00.000Z')
    );
    expect(result.failureReason).toBe('not_recorded');
  });
});
