import { describe, expect, it } from 'vitest';
import { formatCurrencyAmount } from '@/lib/shared/utils/currency';

describe('formatCurrencyAmount', () => {
  it('normalizes currency codes and rounds amounts', () => {
    expect(formatCurrencyAmount(1234.567, ' usd ')).toBe('$1,234.57');
  });

  it.each([null, undefined, NaN, Infinity])('renders invalid or missing amount %s as zero', (value) => {
    expect(formatCurrencyAmount(value, 'USD')).toBe('$0.00');
  });

  it('does not imply a currency for mixed account totals', () => {
    expect(formatCurrencyAmount(1234.5, 'MIXED')).toBe('1,234.50');
  });

  it('falls back to USD for an invalid currency code', () => {
    expect(formatCurrencyAmount(25, 'invalid')).toBe('$25.00');
  });

  it('supports whole-number display without dropping negative amounts', () => {
    expect(formatCurrencyAmount(-25.4, 'USD', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })).toBe('-$25');
  });
});
