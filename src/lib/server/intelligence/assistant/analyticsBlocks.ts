import { analyticsBlockSchema, type AnalyticsBlock } from '@/lib/shared/assistant/analytics';
import { asRecord } from '@/lib/shared/utils/format';
/** Visuals come only from server tool results, never from model-authored numbers or markup. */
export function analyticsBlock(name: string, args: unknown, result: unknown): AnalyticsBlock | null {
  if (asRecord(args).visual !== true) return null;
  const data = asRecord(result), range = asRecord(data.range), previous = asRecord(range.previous);
  if (data.unavailable && typeof data.unavailable === 'string') return null;
  const scope = `${range.dateFrom}–${range.dateTo} · ${data.platform ?? 'combined'} · ${data.currency ?? 'Currency unknown'} · ${data.timezone}`;
  const items = Array.isArray(data.cards) ? data.cards : Array.isArray(data.rankings) ? data.rankings.map(row => {
    const item = asRecord(row);
    return { label: String(item.name ?? item.externalId ?? 'Saved entity'), value: `${String(data.metric)}: ${item.value}`, change: null };
  }) : [];
  if (!items.length) return null;
  const trend = Array.isArray(data.daily) ? data.daily.map(point => { const p = asRecord(point); return { day: p.day, value: p.spend }; }) : [];
  const parsed = analyticsBlockSchema.safeParse({ title: name === 'getPerformanceRankings' ? 'Observed performance ranking' : 'Account performance', scope,
    note: `${previous.dateFrom ? `Baseline: ${previous.dateFrom}–${previous.dateTo}. ` : ''}${data.observedAt ? `Oldest observation: ${data.observedAt}. ` : 'Observation freshness unavailable. '}${data.stale ? 'Stored data may be stale. ' : ''}${data.limitation ?? ''}`, items, trend });
  return parsed.success ? parsed.data : null;
}
