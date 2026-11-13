import { shiftDay } from '../overview/model';
import type { Metrics, Summary } from '../../campaigns/exploration/types';
import { chartPoint, runningCostPerResult, type ControlPerformance } from '../overview/controlModel';
import { periodRange } from '../overview/model';
import type { Period } from '../overview/types';
export type Publisher = 'combined' | 'facebook' | 'instagram';
export const publisher = (value?: string): Publisher => value === 'facebook' || value === 'instagram' ? value : 'combined';
export { normalize, learningLabel } from '../../sync/resources/insightModel';
export type { Insight, MetaRow } from '../../sync/resources/insightModel';
import type { Insight } from '../../sync/resources/insightModel';
export function selectRows(rows: Insight[], platform: Publisher, period: Period, today: string) {
  const range = periodRange(period, today);
  return rows.filter(r => (platform === 'combined' || r.publisher === platform) && r.day >= range.since && r.day <= range.until);
}
export function groups(rows: Insight[], currency: string) {
  const grouped = new Map<string, Insight[]>();
  for (const row of rows) grouped.set(row.label, [...grouped.get(row.label) ?? [], row]);
  return [...grouped].map(([label, items]) => ({ label, ...aggregate(items, currency) }));
}
// Keep absent denominators unknown; never interpolate conversion actions or reach.
export function aggregate(rows: Insight[], currency: string | null): Metrics {
  const sum = (key: 'spend' | 'impressions' | 'clicks' | 'leads' | 'messages' | 'calls') => rows.length && rows.every(r => r.currency_code === currency && typeof r[key] === 'number' && Number.isFinite(r[key]) && r[key]! >= 0) ? rows.reduce((n, r) => n + r[key]!, 0) : null;
  const spend = sum('spend'), impressions = sum('impressions'), clicks = sum('clicks');
  const parts = [sum('leads'), sum('messages'), sum('calls')];
  const results = parts.every(p => p !== null) ? parts.reduce<number>((a,b) => a + b!, 0) : null;
  const ratio = (a: number | null, b: number | null, scale = 1) => a !== null && b !== null && b > 0 ? a / b * scale : null;
  return { spend, impressions, clicks, results, ctr: ratio(clicks, impressions, 100), costPerResult: ratio(spend, results), cpc: ratio(spend, clicks), cpm: ratio(spend, impressions, 1000), reach: null, frequency: null };
}
export function livePerformance(rows: Insight[], platform: Publisher, period: Period, today: string, currency: string | null): ControlPerformance {
  const points: ControlPerformance['points'] = [];
  for (let day = periodRange(period === 'today' ? '7d' : period, today).since; day <= today; day = shiftDay(day, 1)) {
    points.push({ ...chartPoint(aggregate(selectRows(rows, platform, '30d', today).filter(r => r.day === day), currency)), day, current: day === today });
  }
  return { metrics: aggregate(selectRows(rows, platform, period, today), currency), points: runningCostPerResult(points), currency, deltas: {}, comparison: null, partial: true };
}

/** True when Meta reported spend or impressions today for the selected platform. */
export function deliveredToday(rows: Insight[] | null, platform: Publisher, today: string) {
  return (rows ?? []).some(r => r.day === today && (platform === 'combined' || r.publisher === platform) &&
    ((r.spend ?? 0) > 0 || (r.impressions ?? 0) > 0));
}

/** Explorer summaries use external Meta IDs, not database dimension UUIDs. */
export function advertisingMetrics(items: Summary[], daily: Insight[] | null, platform: Publisher, period: Period, today: string, currency: string | null): Summary[] {
  if (daily === null && platform === 'combined') return items;
  const rows = selectRows(daily ?? [], platform, period, today);
  const observed = new Set(rows.map(r => r.externalId));
  return items.filter(item => platform === 'combined' || daily === null || observed.has(item.id))
    .map(item => ({ ...item, metrics: aggregate(rows.filter(r => r.externalId === item.id), currency), deltas: {} }));
}
