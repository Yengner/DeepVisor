import { requiredMetric, actionMetric } from '../../sync/meta/normalization';
import { shiftDay } from '../overview/model';
import type { Metrics, Summary } from '../../campaigns/exploration/types';
import type { ControlPerformance } from '../overview/controlModel';
import { periodRange } from '../overview/model';
import type { DailyRow, Period } from '../overview/types';
export type Publisher = 'combined' | 'facebook' | 'instagram';
export const publisher = (value?: string): Publisher => value === 'facebook' || value === 'instagram' ? value : 'combined';
export type Insight = Omit<DailyRow, 'leads' | 'messages' | 'calls' | 'inline_link_clicks'> & { inline_link_clicks: number | null; leads: number | null; messages: number | null; calls: number | null } & { externalId: string; publisher: string; label: string };
export type MetaRow = { adset_id?: string; date_start?: string; date_stop?: string; publisher_platform?: string; age?: string; gender?: string; hourly_stats_aggregated_by_advertiser_time_zone?: string; spend?: string; impressions?: string; clicks?: string; actions?: Array<{ action_type?: string; value?: string }> };
export function normalize(rows: MetaRow[], currency: string, hourly = false): Insight[] {
  return rows.map(r => {
    if ((r.date_stop && r.date_stop !== r.date_start) || !r.date_start || !/^\d{4}-\d{2}-\d{2}$/.test(r.date_start) || !r.publisher_platform) throw new Error('Invalid Insights scope');
    const actions = r.actions;
    return { entity_id: r.adset_id ?? 'account', externalId: r.adset_id ?? '', day: r.date_start, currency_code: currency,
      publisher: r.publisher_platform, label: hourly ? r.hourly_stats_aggregated_by_advertiser_time_zone ?? 'Unknown hour' : [r.age, r.gender].filter(Boolean).join(' · '),
      spend: requiredMetric(r.spend), impressions: requiredMetric(r.impressions), clicks: requiredMetric(r.clicks), reach: null, inline_link_clicks: null,
      leads: hourly || actions === undefined ? null : actionMetric(actions, ['onsite_conversion.lead_grouped', 'lead', 'offsite_conversion.fb_pixel_lead']),
      messages: hourly || actions === undefined ? null : actionMetric(actions, ['onsite_conversion.messaging_conversation_started_7d']),
      calls: hourly || actions === undefined ? null : actionMetric(actions, ['onsite_conversion.phone_call_click', 'phone_call']) };
  });
}
export function selectRows(rows: Insight[], platform: Publisher, period: Period, today: string) {
  const range = periodRange(period, today);
  return rows.filter(r => (platform === 'combined' || r.publisher === platform) && r.day >= range.since && r.day <= range.until);
}
export function groups(rows: Insight[], currency: string) {
  const grouped = new Map<string, Insight[]>();
  for (const row of rows) grouped.set(row.label, [...grouped.get(row.label) ?? [], row]);
  return [...grouped].map(([label, items]) => ({ label, ...aggregate(items, currency) }));
}
export function learningLabel(value: unknown): string {
  const state = value && typeof value === 'object' ? (value as Record<string, unknown>).status : null;
  return state === 'LEARNING' ? 'Learning' : state === 'LEARNING_LIMITED' ? 'Learning limited' : state === 'SUCCESS' ? 'Learning complete' : 'Unavailable';
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
    points.push({ ...aggregate(selectRows(rows, platform, '30d', today).filter(r => r.day === day), currency), day, current: day === today });
  }
  return { metrics: aggregate(selectRows(rows, platform, period, today), currency), points, currency, deltas: {}, comparison: null, partial: true };
}

/** Explorer summaries use external Meta IDs, not database dimension UUIDs. */
export function advertisingMetrics(items: Summary[], daily: Insight[] | null, platform: Publisher, period: Period, today: string, currency: string | null): Summary[] {
  if (daily === null && platform === 'combined') return items;
  const rows = selectRows(daily ?? [], platform, period, today);
  const observed = new Set(rows.map(r => r.externalId));
  return items.filter(item => platform === 'combined' || daily === null || observed.has(item.id))
    .map(item => ({ ...item, metrics: aggregate(rows.filter(r => r.externalId === item.id), currency), deltas: {} }));
}
