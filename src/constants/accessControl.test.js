import { describe, expect, it } from 'vitest';
import { resolveAccessProfile, userCanAccessAgent } from './accessControl';
import { isActiveAgent } from './activeAgents';

describe('Guidiana read-only profile', () => {
  it('shows all agents while keeping the account view-only', () => {
    const profile = resolveAccessProfile({ email: 'Guidiana.Puentes@theunitedtransports.com' });

    expect(profile.role).toBe('viewer');
    expect(profile.agentScope).toContain('guidiana puentes');
    expect(profile.canViewAllData).toBe(true);
    expect(profile.canViewManagerAnalytics).toBe(false);
    expect(profile.canViewInvoiceEntry).toBe(false);
    expect(profile.canEditData).toBe(false);
    expect(profile.canDeleteData).toBe(false);
    expect(profile.canDownloadInvoices).toBe(false);
    expect(userCanAccessAgent(profile, 'Guidiana Puentes')).toBe(true);
    expect(userCanAccessAgent(profile, 'Kevin Ruiz')).toBe(true);
    expect(userCanAccessAgent(profile, 'SAN MIGUEL EXPRESS LLC')).toBe(true);
  });
});

describe('active agent filter', () => {
  it('keeps only the confirmed current roster and normalizes accents', () => {
    expect(isActiveAgent('Héctor Lomelí')).toBe(true);
    expect(isActiveAgent('Francesco Rinaldelli')).toBe(false);
    expect(isActiveAgent('John Escobar')).toBe(false);
  });
});
