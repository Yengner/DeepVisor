import { describe, expect, it } from 'vitest';
import { normalize, aggregate, selectRows, livePerformance, learningLabel, advertisingMetrics } from './model';
import { dayInZone, periodRange } from '../overview/model';
import { assistantWidth } from '@/components/layout/assistantSizing';
const rows = normalize([
  { adset_id: 'one', date_start: '2026-11-01', publisher_platform: 'facebook', spend: '20', impressions: '100', clicks: '10', actions: [{ action_type: 'lead', value: '2' }] },
  { adset_id: 'one', date_start: '2026-11-01', publisher_platform: 'instagram', spend: '10', impressions: '400', clicks: '10', actions: [{ action_type: 'lead', value: '1' }] },
], 'USD');
describe('Meta dashboard observations', () => {
  it('uses account-local calendar boundaries across daylight saving', () => {
    expect(dayInZone('2026-11-02T02:00:00Z', 'America/New_York')).toBe('2026-11-01');
    expect(periodRange('today','2026-11-01')).toMatchObject({ since:'2026-11-01', until:'2026-11-01' });
    expect(periodRange('7d','2026-11-01')).toMatchObject({ since:'2026-10-26' });
    expect(periodRange('30d','2026-11-01')).toMatchObject({ since:'2026-10-03' });
  });
  it('isolates platforms and recomputes ratios from compatible totals', () => {
    expect(aggregate(selectRows(rows,'facebook','today','2026-11-01'),'USD')).toMatchObject({ spend:20, results:2, ctr:10 });
    expect(aggregate(rows,'USD')).toMatchObject({ spend:30, results:3, ctr:4, costPerResult:10, reach:null });
  });
  it('preserves gaps and unknown conversions without erasing hourly spend', () => {
    const hourly = normalize([{date_start:'2026-11-01',publisher_platform:'facebook',spend:'2',clicks:'1',impressions:'10'}], 'USD',true);
    expect(aggregate(hourly,'USD')).toMatchObject({spend:2,results:null,costPerResult:null,ctr:10});
    const view=livePerformance(rows,'facebook','7d','2026-11-01','USD');
    expect(view.points[0].spend).toBeNull(); expect(view.points.at(-1)?.spend).toBe(20);
    expect(aggregate(rows,'EUR').spend).toBeNull();
  });
  it('rejects malformed metrics and never infers learning completion from delivery', () => {
    expect(() => normalize([{date_start:'2026-11-01',publisher_platform:'facebook',spend:'bad',clicks:'1',impressions:'2'}],'USD')).toThrow();
    expect(learningLabel({status:'ACTIVE'})).toBe('Unavailable');
    expect(learningLabel({status:'LEARNING_LIMITED'})).toBe('Learning limited');
    expect(learningLabel({status:'SUCCESS'})).toBe('Learning complete');
  });
  it('bounds assistant width to available desktop space', () => {
    expect(assistantWidth(100,1200)).toBe(320); expect(assistantWidth(1000,1200)).toBe(600);
    expect(assistantWidth(500,800)).toBe(400);
  });
});

it('never exposes combined-only alternative breakdowns in a platform selection', () => {
 const alternative = rows.map(r => ({ ...r, publisher: 'combined-only' }));
 expect(selectRows(alternative,'facebook','today','2026-11-01')).toEqual([]);
 expect(selectRows(alternative,'combined','today','2026-11-01')).toHaveLength(2);
});

it('joins creative cards by native Meta ID and preserves evidence health without mutating saved metrics', () => {
 const item = { id: 'one', name: 'Ad set', level: 'adset' as const, delivery: 'ACTIVE', state: 'Healthy' as const, metrics: aggregate([], 'USD'), media: [], complete: false, deltas: {}, leader: false, tied: false };
 const filtered = advertisingMetrics([item], rows, 'facebook', 'today', '2026-11-01', 'USD');
 expect(filtered[0].metrics.spend).toBe(20); expect(filtered[0].state).toBe('Healthy');
 expect(item.metrics.spend).toBeNull();
 expect(advertisingMetrics([item], null, 'facebook', 'today', '2026-11-01', 'USD')[0].metrics.spend).toBeNull();
 expect(advertisingMetrics([item], null, 'combined', 'today', '2026-11-01', 'USD')[0]).toBe(item);
});
