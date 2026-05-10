import { describe, it, expect } from 'vitest';
import { parseMoneyValue, roundMoney, formatCurrency } from './moneyUtils';

describe('parseMoneyValue', () => {
  it('should return number for numeric input', () => {
    expect(parseMoneyValue(100)).toBe(100);
  });

  it('should parse currency strings', () => {
    expect(parseMoneyValue('$1,234.56')).toBe(1234.56);
    expect(parseMoneyValue('1000')).toBe(1000);
  });

  it('should handle empty/null values', () => {
    expect(parseMoneyValue('')).toBeNaN();
    expect(parseMoneyValue(null)).toBeNaN();
  });

  it('should handle different decimal separators', () => {
    expect(parseMoneyValue('1,234.56')).toBe(1234.56);
    expect(parseMoneyValue('1.234,56')).toBe(1234.56);
  });
});

describe('roundMoney', () => {
  it('should round to 2 decimal places', () => {
    expect(roundMoney(10.555)).toBe(10.56);
    expect(roundMoney(10.554)).toBe(10.55);
  });

  it('should return NaN for invalid input', () => {
    expect(roundMoney('invalid')).toBeNaN();
  });
});

describe('formatCurrency', () => {
  it('should format as USD currency', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle null/undefined', () => {
    expect(formatCurrency(null)).toBe('$0.00');
    expect(formatCurrency()).toBe('$0.00');
  });
});