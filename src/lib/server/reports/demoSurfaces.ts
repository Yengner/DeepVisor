import type { ReportMetricTotals, ReportQueryInput, ReportSurfaceContext, ReportSnapshotMeasurement } from './types';
import { reportDayCount, shiftReportDay } from '@/lib/shared/reports/dates';
/** Explicit synthetic Meta demo data only. No live reporting path calls this builder. */
export function buildDemoSurfaceMeasurements(query: ReportQueryInput, totals: ReportMetricTotals): Pick<ReportSurfaceContext, 'measurements' | 'coverage' | 'hourlyTrendExpanded'> {
  const measurements: ReportSnapshotMeasurement[] = [];
  const coverage: NonNullable<ReportSurfaceContext['coverage']> = {};
  const groups = [
    ['age_gender', 'age', 'gender', [['25-34', 'female'], ['35-44', 'male'], ['45-54', 'female']]],
    ['country', 'country', '', [['US', ''], ['CA', ''], ['GB', '']]],
    ['region', 'region', '', [['California', ''], ['New York', ''], ['Ontario', '']]],
    ['dma', 'dma', '', [['Los Angeles', ''], ['New York', ''], ['San Francisco', '']]],
    ['publisher_platform', 'publisher_platform', '', [['facebook', ''], ['instagram', ''], ['messenger', '']]],
    ['platform_position', 'publisher_platform', 'platform_position', [['facebook', 'feed'], ['instagram', 'reels'], ['instagram', 'story']]],
    ['impression_device', 'impression_device', '', [['iphone', ''], ['android_smartphone', ''], ['desktop', '']]],
  ] as const;
  const shares = [.55, .3, .15];
  for (const [type, key1, key2, labels] of groups) {
    labels.forEach(([value1, value2], i) => {
      const allocate = (v: number) => i < 2 ? Math.floor(v * shares[i]) : v - Math.floor(v * shares[0]) - Math.floor(v * shares[1]);
      const unsupported = ['publisher_platform', 'platform_position', 'impression_device'].includes(type);
      measurements.push({ entityId: 'demo-snapshot', entityLevel: 'adset', breakdownType: type,
        dimension1: { key: key1, value: value1 }, dimension2: { key: key2, value: value2 },
        dateFrom: query.dateFrom, dateTo: query.dateTo, currencyCode: 'USD',
        values: { spend: allocate(totals.spend), impressions: allocate(totals.impressions), clicks: allocate(totals.clicks), conversion: unsupported ? null : allocate(totals.conversion), reach: null },
      });
    });
    coverage[type] = { state: 'available', basis: 'snapshot', dateFrom: query.dateFrom, dateTo: query.dateTo };
  }
  const days = reportDayCount(query.dateFrom, query.dateTo);
  const hourlyTrendExpanded = Array.from({ length: Math.min(days, 90) }, (_, i) => [9, 12, 17].map((hour, h) => {
    const day = shiftReportDay(query.dateFrom, i), weight = [1, 2, 3][h];
    const spend = (10 + i % 7) * weight, impressions = (200 + i % 7 * 20) * weight, clicks = (4 + i % 4) * weight, results = (i % 3) * weight;
    return { label: `${day} ${hour}:00`, dayKey: day, dayOfWeek: (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7, hourOfDay: hour,
      spend, impressions, clicks, results, inlineLinkClicks: clicks / 2, reach: 0, frequency: 0,
      ctr: clicks / impressions * 100, cpc: spend / clicks, cpm: spend / impressions * 1000, costPerResult: results > 0 ? spend / results : 0 };
  })).flat();
  coverage.hourly = { state: 'partial', basis: 'period', dateFrom: hourlyTrendExpanded[0]?.dayKey ?? null, dateTo: hourlyTrendExpanded.at(-1)?.dayKey ?? null };
  return { measurements, coverage, hourlyTrendExpanded };
}
