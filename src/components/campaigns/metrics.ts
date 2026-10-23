import { formatCurrencyAmount } from '@/lib/shared/utils/currency';

/** Missing evidence or currency is not an observed zero or an assumed USD amount. */
export function formatRecordedCurrency(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null || !Number.isFinite(value) || !currency || !/^[A-Z]{3}$/.test(currency) || currency === 'MIXED') return '—';
  return formatCurrencyAmount(value, currency);
}
