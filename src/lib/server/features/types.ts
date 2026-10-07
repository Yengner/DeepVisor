import type { PerformanceSummaryDailyRow } from '../repositories/performanceSummary/shared';
import type { DigestTrendSnapshot, TrackingConfidence } from '../intelligence/types';

export const FEATURE_SCHEMA_VERSION = 1 as const;

export interface MetaDeliveryUnit {
  platform: 'meta';
  entityType: 'adset';
  businessId: string;
  adAccountId: string;
  adsetId: string;
  currency: string;
}

/** One normalized, unsplit daily fact per ad set, in the ad account's calendar. */
export interface MetaDeliveryDailyRow extends PerformanceSummaryDailyRow {
  adset_id: string;
}

export interface FeatureMetrics {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  linkClicks: number | null;
  results: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  costPerResult: number | null;
  /** Impressions / sum of daily reach; not deduplicated window frequency. */
  frequency: number | null;
}

export interface FeatureWindow {
  sinceDay: string;
  untilDay: string;
  expectedDays: number;
  observedDays: number;
  activeDays: number;
  missingDays: number;
  metrics: FeatureMetrics;
  dataSufficiency: {
    status: 'sufficient' | 'insufficient';
    reasons: Array<'missing_days' | 'missing_metrics' | 'too_few_active_days' | 'low_signal'>;
  };
}

export interface FeatureComparison {
  comparable: boolean;
  spend: DigestTrendSnapshot | null;
  results: DigestTrendSnapshot | null;
  costPerResult: DigestTrendSnapshot | null;
  deliveryTrend: 'up' | 'down' | 'flat' | 'unknown';
  efficiencyTrend: 'improving' | 'declining' | 'stable' | 'unknown';
}

/** JSON-only representation. Schema version covers formulas, thresholds and semantics. */
export interface FeatureSnapshot {
  schemaVersion: typeof FEATURE_SCHEMA_VERSION;
  deliveryUnit: MetaDeliveryUnit;
  asOfDay: string;
  resultDefinition: 'leads_plus_messages_plus_calls';
  frequencyBasis: 'summed_daily_reach';
  windows: {
    recent7d: FeatureWindow;
    previous7d: FeatureWindow;
    recent30d: FeatureWindow;
    previous30d: FeatureWindow;
  };
  comparisons: { recent7d: FeatureComparison; recent30d: FeatureComparison };
  trackingConfidence: {
    level: TrackingConfidence | 'unknown';
    basis: 'assessment_conversion_signal_heuristic';
    window: 'recent30d';
  };
  creativeFatigue: {
    elevatedFrequency: boolean | null;
    threshold: number;
    window: 'recent7d';
  };
}
