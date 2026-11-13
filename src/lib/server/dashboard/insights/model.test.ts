import { describe, expect, it } from 'vitest';
import { normalize, aggregate, selectRows, livePerformance, learningLabel, advertisingMetrics, deliveredToday } from './model';
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
    const hourly = normalize([{date_start:'2026-11-01',publisher_platform:'facebook',spend:'2',clicks:'1',impressions:'10'}], 'USD',true,false);
    expect(aggregate(hourly,'USD')).toMatchObject({spend:2,results:null,costPerResult:null,ctr:10});
    const view=livePerformance(rows,'facebook','7d','2026-11-01','USD');
    expect(view.points[0].spend).toBeNull(); expect(view.points.at(-1)?.spend).toBe(20);
    expect(aggregate(rows,'EUR').spend).toBeNull();
  });
  it('treats omitted actions as zero results when actions were requested', () => {
    const daily = normalize([
      { adset_id: 'one', date_start: '2026-11-01', publisher_platform: 'facebook', spend: '12', impressions: '300', clicks: '6', actions: [{ action_type: 'lead', value: '2' }] },
      { adset_id: 'one', date_start: '2026-11-01', publisher_platform: 'instagram', spend: '4', impressions: '90', clicks: '1' },
      { adset_id: 'one', date_start: '2026-11-02', publisher_platform: 'facebook', spend: '9', impressions: '200', clicks: '3' },
    ], 'USD');
    expect(daily[1]).toMatchObject({ leads: 0, messages: 0, calls: 0 });
    const view = livePerformance(daily, 'combined', '7d', '2026-11-03', 'USD');
    expect(view.points.find(p => p.day === '2026-11-01')).toMatchObject({ spend: 16, results: 2 });
    expect(view.points.find(p => p.day === '2026-11-02')).toMatchObject({ spend: 9, results: 0, costPerResult: 12.5 }); // running 25 / 2
    // No delivery rows: a gap, not a zero.
    expect(view.points.find(p => p.day === '2026-11-03')).toMatchObject({ spend: null, results: null });
    expect(view.metrics).toMatchObject({ spend: 25, results: 2 });
  });
  it('plots cost per result as a running ratio across zero-result days', () => {
    const daily = normalize([
      { adset_id: 'one', date_start: '2026-11-01', publisher_platform: 'facebook', spend: '10', impressions: '100', clicks: '2' },
      { adset_id: 'one', date_start: '2026-11-02', publisher_platform: 'facebook', spend: '20', impressions: '100', clicks: '2', actions: [{ action_type: 'lead', value: '2' }] },
      { adset_id: 'one', date_start: '2026-11-03', publisher_platform: 'facebook', spend: '15', impressions: '100', clicks: '2' },
      { adset_id: 'one', date_start: '2026-11-05', publisher_platform: 'facebook', spend: '15', impressions: '100', clicks: '2', actions: [{ action_type: 'lead', value: '1' }] },
    ], 'USD');
    const cost = (day: string) => livePerformance(daily, 'combined', '7d', '2026-11-05', 'USD').points.find(p => p.day === day)?.costPerResult;
    expect(cost('2026-11-01')).toBeNull(); // no results yet
    expect(cost('2026-11-02')).toBe(15); // 30 / 2
    expect(cost('2026-11-03')).toBe(22.5); // 45 / 2, zero-result day stays on the line
    expect(cost('2026-11-04')).toBeNull(); // no delivery: gap
    expect(cost('2026-11-05')).toBe(20); // 60 / 3
  });
  it('detects delivery today from loaded insights, per platform', () => {
    const daily = normalize([
      { adset_id: 'one', date_start: '2026-11-02', publisher_platform: 'instagram', spend: '3', impressions: '40', clicks: '1' },
      { adset_id: 'one', date_start: '2026-11-02', publisher_platform: 'facebook', spend: '0', impressions: '0', clicks: '0' },
      { adset_id: 'one', date_start: '2026-11-01', publisher_platform: 'facebook', spend: '8', impressions: '90', clicks: '2' },
    ], 'USD');
    expect(deliveredToday(daily, 'combined', '2026-11-02')).toBe(true);
    expect(deliveredToday(daily, 'instagram', '2026-11-02')).toBe(true);
    expect(deliveredToday(daily, 'facebook', '2026-11-02')).toBe(false); // only zero delivery today
    expect(deliveredToday(daily, 'combined', '2026-11-03')).toBe(false);
    expect(deliveredToday(null, 'combined', '2026-11-02')).toBe(false); // unavailable is not live
  });
  it('plots idle days as gaps instead of zero results', () => {
    const idle = normalize([{ adset_id: 'one', date_start: '2026-11-01', publisher_platform: 'facebook', spend: '0', impressions: '0', clicks: '0' }], 'USD');
    const view = livePerformance(idle, 'combined', '7d', '2026-11-01', 'USD');
    expect(view.points.at(-1)).toMatchObject({ spend: null, results: null, ctr: null });
  });
  it('rejects malformed metrics and never infers learning completion from delivery', () => {
    expect(() => normalize([{date_start:'2026-11-01',publisher_platform:'facebook',spend:'bad',clicks:'1',impressions:'2'}],'USD')).toThrow();
    expect(learningLabel({status:'ACTIVE'})).toBe('Unavailable');
    expect(learningLabel({status:'LEARNING_LIMITED'})).toBe('Learning limited');
    expect(learningLabel({status:'SUCCESS'})).toBe('Learning complete');
  });
  it('bounds assistant width to available desktop space', () => {
    expect(assistantWidth(100,1200)).toBe(320);
    // Keeps at least 720px of main content: 1200 - 720 = 480 (under half of 1200).
    expect(assistantWidth(1000,1200)).toBe(480);
    // Wide screens are capped at half the available width.
    expect(assistantWidth(2000,2400)).toBe(1200); expect(assistantWidth(Infinity,1352)).toBe(632);
    // Narrow screens keep the 320px minimum (the KPI grid reflows instead of truncating).
    expect(assistantWidth(500,800)).toBe(320);
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
