import { it, expect } from 'vitest';
import { analyticsBlock } from './analyticsBlocks';
it('renders only validated tool-derived numbers on explicit visual requests', () => {
  const data = { range: { dateFrom: '2026-01-01', dateTo: '2026-01-07' }, currency: 'USD', timezone: 'UTC', cards: [{ label: 'Spend', value: '$70.00', change: null }], daily: [{ day: '2026-01-01', spend: 10 }] };
  expect(analyticsBlock('getAccountPerformance', { visual: false }, data)).toBeNull();
  expect(analyticsBlock('getAccountPerformance', { visual: true }, data)?.items[0].value).toBe('$70.00');
  expect(analyticsBlock('getAccountPerformance', { visual: true }, { ...data, cards: [{ label: 'Bad', value: '<b>bad</b>', change: { value: NaN } }] })).toBeNull();
});
