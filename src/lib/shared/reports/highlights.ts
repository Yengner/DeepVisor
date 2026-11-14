import type { ReportBreakdownRow, ReportPayload } from '@/lib/server/reports/types';
import { advertisingGroups, advertisingMetricValue, sortAdvertising } from './advertising';
import { buildSnapshotBreakdown, snapshotWindows } from './breakdowns';
import { buildTimeAnalysis } from './timeAnalysis';
import { segmentLabel } from './labels';

/**
 * Overview highlights. Each one reuses the section's own calculation and only selects from it,
 * so a highlight can never disagree with the section it links to. Insufficient evidence yields
 * null (the card says so) rather than a weak "winner".
 */

export interface SegmentShare { label: string; value: number; share: number }
export interface SnapshotHighlight { dimension: string; window: string; total: number; segments: SegmentShare[] }

/** Minimum observed dates in a slot before it can be called the busiest hour. */
export const MIN_HOUR_OBSERVATIONS = 2;

/** Spend shares within one snapshot dimension and measurement window (the first, as the section defaults). */
export function snapshotShares(payload: ReportPayload, dimension: string, limit = 3): SnapshotHighlight | null {
  if (!payload.surface.isMeta) return null;
  const window = snapshotWindows(payload.surface, dimension)[0];
  if (!window || window === 'Coverage unknown') return null;
  const model = buildSnapshotBreakdown(payload.surface, dimension, 'spend', window);
  const measured = model.items.filter((item): item is typeof item & { value: number } => item.value != null && item.value > 0);
  const total = measured.reduce((sum, item) => sum + item.value, 0);
  if (!measured.length || total <= 0) return null;
  return {
    dimension,
    window,
    total,
    segments: measured.slice(0, limit).map(item => ({ label: segmentLabel(dimension, item.label), value: item.value, share: item.value / total })),
  };
}

/** Top selected-scope advertising by results, falling back to spend when no results were recorded. */
export function topAdvertising(payload: ReportPayload, limit = 3): { metric: 'conversion' | 'spend'; rows: ReportBreakdownRow[] } {
  const rows = advertisingGroups(payload)[0]?.rows ?? [];
  const currency = payload.meta.currencyCode;
  const hasResults = rows.some(row => (advertisingMetricValue(row, 'conversion', currency) ?? 0) > 0);
  const metric = hasResults ? 'conversion' : 'spend';
  return { metric, rows: sortAdvertising(rows, metric, false, '', currency).slice(0, limit) };
}

/** Busiest advertiser-local hour by average clicks per observed date. Requires a verified timezone. */
export function busiestHour(payload: ReportPayload) {
  if (!payload.meta.timezone || !payload.surface.hourlyTrendExpanded.length) return null;
  const cells = buildTimeAnalysis(payload.surface, 'clicks', 'average', payload.meta.currencyCode)
    .filter(cell => cell.value != null && cell.value > 0 && cell.observations >= MIN_HOUR_OBSERVATIONS);
  if (!cells.length) return null;
  const best = cells.reduce((top, cell) => (cell.value! > top.value! ? cell : top));
  return { day: best.day, hour: best.hour, value: best.value!, observations: best.observations };
}
