import { describe, it, expect } from 'vitest';
import { normalizeWeekLabel, normalizeMatchKey, normalizeStatus } from './normalizers';

describe('normalizeWeekLabel', () => {
  it('should extract week numbers', () => {
    expect(normalizeWeekLabel('March 1-7')).toBe('W-1-7');
    expect(normalizeWeekLabel('Mar 15-21')).toBe('W-15-21');
  });

  it('should return lowercase trimmed string', () => {
    expect(normalizeWeekLabel('  Test  ')).toBe('test');
  });

  it('should return unspecified for empty input', () => {
    expect(normalizeWeekLabel('')).toBe('unspecified');
  });
});

describe('normalizeMatchKey', () => {
  it('should remove common suffixes', () => {
    expect(normalizeMatchKey('Acme Corp LLC')).toBe('acme');
    expect(normalizeMatchKey('Test Inc')).toBe('test');
  });

  it('should remove special characters', () => {
    expect(normalizeMatchKey('Company #123')).toBe('company123');
  });

  it('should trim whitespace', () => {
    expect(normalizeMatchKey('  Company  ')).toBe('company');
  });
});

describe('normalizeStatus', () => {
  it('should normalize paid status', () => {
    expect(normalizeStatus('PAID')).toBe('paid');
    expect(normalizeStatus('inactive')).toBe('paid');
  });

  it('should normalize overdue status', () => {
    expect(normalizeStatus('OVERDUE')).toBe('overdue');
  });

  it('should default to pending for unknown', () => {
    expect(normalizeStatus('something')).toBe('pending');
  });
});