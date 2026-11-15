import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { periodAggregate } from './surfaces';

const r = (day: string, label: string, publisher: string, spend: number, messages = 0) => ({ day, label, publisher, currency_code: 'USD', spend, impressions: 100, clicks: 2, inline_link_clicks: null, leads: 0, messages, calls: 0 });

describe('periodAggregate', () => {
  it('sums age × gender and Facebook/Instagram over only the days given, keeping the observed span', () => {
    const { rows, days } = periodAggregate(
      [r('2026-11-06', '45-54 · female', 'combined-only', 4, 1), r('2026-11-07', '45-54 · female', 'combined-only', 6), r('2026-11-07', '18-24 · male', 'combined-only', 1)],
      [r('2026-11-06', '', 'facebook', 10), r('2026-11-06', '', 'instagram', 5), r('2026-11-08', '', 'facebook', 3), r('2026-11-08', '', 'combined-only', 99)],
      'acct',
    );
    const women = rows.find(x => x.breakdown_type === 'age_gender' && x.dimension_1_value === '45-54' && x.dimension_2_value === 'female')!;
    expect(women).toMatchObject({ spend: 10, messages: 1, first_day: '2026-11-06', last_day: '2026-11-07', source: 'period' });
    const facebook = rows.find(x => x.breakdown_type === 'publisher_platform' && x.dimension_1_value === 'facebook')!;
    expect(facebook.spend).toBe(13); // combined-only rows are never attributed to a platform
    expect(days).toEqual({ age_gender: ['2026-11-06', '2026-11-07'], publisher_platform: ['2026-11-06', '2026-11-08'] });
  });
  it('returns nothing to replace when no saved days fall in range', () => {
    expect(periodAggregate([], [], 'acct')).toEqual({ rows: [], days: {} });
  });
});
