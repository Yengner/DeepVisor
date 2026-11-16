import { describe, expect, it } from 'vitest';
import type { AudienceObservation } from '@/lib/shared/reports/audience';
import type { HourlyObservation } from '@/lib/shared/reports/timeAnalysis';
import { audienceTakeaway, hourTakeaway } from './takeaways';

const audience = (gender: string, age: string, spend: number | null, conversion: number | null) =>
  ({ date: '2026-11-10', gender, age, currencyCode: 'USD', values: { spend, conversion } }) as unknown as AudienceObservation;
const hour = (hourOfDay: number | null, spend: number | null, results: number | null): HourlyObservation =>
  ({ dayKey: '2026-11-10', hourOfDay, spend, results, impressions: null, clicks: null, inlineLinkClicks: null });

describe('audienceTakeaway', () => {
  it('names the lowest cost per result among segments with enough results', () => {
    const t = audienceTakeaway([audience('female', '25-34', 40, 10), audience('male', '35-44', 20, 2), audience('male', '18-24', 5, 1)]);
    expect(t).toEqual({ basis: 'cost', segment: 'Women 25–34', costPerResult: 4, results: 10 });
  });
  it('falls back to the biggest spender when no segment has enough results', () => {
    const t = audienceTakeaway([audience('female', '25-34', 30, null), audience('male', '35-44', 10, null)]);
    expect(t).toEqual({ basis: 'spend', segment: 'Women 25–34', spend: 30, share: 0.75 });
  });
  it('says nothing without spend', () => {
    expect(audienceTakeaway([])).toBeNull();
    expect(audienceTakeaway([audience('female', '25-34', null, null)])).toBeNull();
  });
});

describe('hourTakeaway', () => {
  it('picks the hour with the most results across days', () => {
    expect(hourTakeaway([hour(9, 5, 1), hour(18, 5, 3), { ...hour(18, 2, 1), dayKey: '2026-11-11' }])).toEqual({ basis: 'results', hour: 18, share: 0.8 });
  });
  it('uses spend when results are missing, and skips unknown hours', () => {
    expect(hourTakeaway([hour(9, 6, null), hour(14, 2, null), hour(null, 50, null)])).toEqual({ basis: 'spend', hour: 9, share: 0.75 });
  });
  it('says nothing without observations', () => {
    expect(hourTakeaway(null)).toBeNull();
    expect(hourTakeaway([hour(9, null, null)])).toBeNull();
  });
});
