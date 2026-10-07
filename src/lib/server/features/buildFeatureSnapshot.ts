import {
  aggregatePerformanceSummaryRows,
  deriveSummaryMetricFields,
} from '../repositories/performanceSummary/shared';
import {
  computeTrackingConfidence,
  computeTrendSnapshot,
  ELEVATED_FREQUENCY_THRESHOLD,
} from '../intelligence/assessments/metrics';
import {
  FEATURE_SCHEMA_VERSION,
  type FeatureComparison,
  type FeatureSnapshot,
  type FeatureWindow,
  type MetaDeliveryDailyRow,
  type MetaDeliveryUnit,
} from './types';

const metricKeys = [
  'spend', 'reach', 'impressions', 'clicks', 'inline_link_clicks', 'leads', 'messages', 'calls',
] as const;

function validateDay(day: string): void {
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
    throw new Error(`Invalid feature day: ${day}`);
  }
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildWindow(rows: MetaDeliveryDailyRow[], untilDay: string, days: number): FeatureWindow {
  const sinceDay = addDays(untilDay, 1 - days);
  const selected = rows.filter((row) => row.day >= sinceDay && row.day <= untilDay);
  const totals = aggregatePerformanceSummaryRows(selected);
  const derived = deriveSummaryMetricFields(totals);
  const known = (...keys: typeof metricKeys[number][]) =>
    selected.length > 0 && selected.every((row) => keys.every((key) => row[key] != null));
  const resultsKnown = known('leads', 'messages', 'calls');
  const metrics: FeatureWindow['metrics'] = {
    spend: known('spend') ? totals.spend : null,
    impressions: known('impressions') ? totals.impressions : null,
    clicks: known('clicks') ? totals.clicks : null,
    linkClicks: known('inline_link_clicks') ? totals.inlineLinkClicks : null,
    results: resultsKnown ? derived.conversion : null,
    ctr: known('clicks', 'impressions') && totals.impressions > 0 ? derived.ctr : null,
    cpc: known('spend', 'clicks') && totals.clicks > 0 ? derived.cpc : null,
    cpm: known('spend', 'impressions') && totals.impressions > 0 ? derived.cpm : null,
    costPerResult: known('spend') && resultsKnown && derived.conversion > 0 ? derived.cost_per_result : null,
    frequency: known('impressions', 'reach') && totals.reach > 0 ? derived.frequency : null,
  };
  if (Object.values(metrics).some((value) => value !== null && !Number.isFinite(value))) {
    throw new Error('Feature metric aggregation overflow');
  }
  const activeDays = selected.filter((row) => (row.spend ?? 0) > 0 || (row.impressions ?? 0) > 0).length;
  const reasons: FeatureWindow['dataSufficiency']['reasons'] = [];
  if (selected.length < days) reasons.push('missing_days');
  if ([metrics.spend, metrics.impressions, metrics.clicks, metrics.results].some((value) => value === null)) {
    reasons.push('missing_metrics');
  }
  if (activeDays < 4) reasons.push('too_few_active_days');
  // Match existing daily trend signal floors; coverage is additionally required for comparisons.
  if ((metrics.spend ?? 0) < 40 && (metrics.impressions ?? 0) < 600 && (metrics.results ?? 0) < 2) {
    reasons.push('low_signal');
  }
  return {
    sinceDay, untilDay, expectedDays: days, observedDays: selected.length,
    activeDays, missingDays: days - selected.length, metrics,
    dataSufficiency: { status: reasons.length ? 'insufficient' : 'sufficient', reasons },
  };
}

function compareWindows(current: FeatureWindow, previous: FeatureWindow): FeatureComparison {
  const comparable = current.dataSufficiency.status === 'sufficient' && previous.dataSufficiency.status === 'sufficient';
  const compare = (currentValue: number | null, previousValue: number | null) => {
    if (!comparable || currentValue === null || previousValue === null) return null;
    const trend = computeTrendSnapshot({ currentValue, previousValue });
    // A zero baseline has an absolute change but no mathematically defined percentage.
    return { ...trend, deltaPercent: previousValue > 0 ? trend.deltaPercent : null };
  };
  const spend = compare(current.metrics.spend, previous.metrics.spend);
  const results = compare(current.metrics.results, previous.metrics.results);
  const costPerResult = compare(current.metrics.costPerResult, previous.metrics.costPerResult);
  return {
    comparable, spend, results, costPerResult,
    deliveryTrend: spend?.direction ?? 'unknown',
    efficiencyTrend: costPerResult?.direction === 'down' ? 'improving'
      : costPerResult?.direction === 'up' ? 'declining'
        : costPerResult?.direction === 'flat' ? 'stable' : 'unknown',
  };
}

/** Pure calculation: caller supplies account-scoped daily facts and an explicit cutoff. */
export function buildFeatureSnapshot(input: {
  deliveryUnit: MetaDeliveryUnit;
  asOfDay: string;
  rows: readonly MetaDeliveryDailyRow[];
}): FeatureSnapshot {
  validateDay(input.asOfDay);
  const unit = input.deliveryUnit;
  if (unit.platform !== 'meta' || unit.entityType !== 'adset' ||
      [unit.businessId, unit.adAccountId, unit.adsetId, unit.currency].some((value) => !value?.trim())) {
    throw new Error('Feature snapshots require a Meta ad set, business, ad account and currency');
  }
  const days = new Set<string>();
  for (const row of input.rows) {
    validateDay(row.day);
    if (row.adset_id !== unit.adsetId) throw new Error('Feature row belongs to a different ad set');
    if (days.has(row.day)) throw new Error(`Duplicate daily feature row: ${row.day}`);
    days.add(row.day);
    for (const key of metricKeys) {
      const value = row[key];
      if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        throw new Error(`Invalid feature metric: ${key}`);
      }
    }
  }
  // Stable summation order makes shuffled input produce identical snapshots.
  const rows = [...input.rows].sort((a, b) => a.day.localeCompare(b.day));
  const recent7d = buildWindow(rows, input.asOfDay, 7);
  const previous7d = buildWindow(rows, addDays(input.asOfDay, -7), 7);
  const recent30d = buildWindow(rows, input.asOfDay, 30);
  const previous30d = buildWindow(rows, addDays(input.asOfDay, -30), 30);
  const tracking = recent30d.metrics;
  const trackingKnown = recent30d.dataSufficiency.status === 'sufficient' &&
    tracking.results !== null && tracking.linkClicks !== null && tracking.clicks !== null;
  return {
    schemaVersion: FEATURE_SCHEMA_VERSION,
    deliveryUnit: { ...unit },
    asOfDay: input.asOfDay,
    resultDefinition: 'leads_plus_messages_plus_calls',
    frequencyBasis: 'summed_daily_reach',
    windows: { recent7d, previous7d, recent30d, previous30d },
    comparisons: {
      recent7d: compareWindows(recent7d, previous7d),
      recent30d: compareWindows(recent30d, previous30d),
    },
    trackingConfidence: {
      level: trackingKnown ? computeTrackingConfidence({
        conversion: tracking.results!, linkClicks: tracking.linkClicks!, clicks: tracking.clicks!,
      }) : 'unknown',
      basis: 'assessment_conversion_signal_heuristic',
      window: 'recent30d',
    },
    creativeFatigue: {
      elevatedFrequency: recent7d.dataSufficiency.status === 'sufficient' && recent7d.metrics.frequency !== null
        ? recent7d.metrics.frequency >= ELEVATED_FREQUENCY_THRESHOLD : null,
      threshold: ELEVATED_FREQUENCY_THRESHOLD,
      window: 'recent7d',
    },
  };
}
