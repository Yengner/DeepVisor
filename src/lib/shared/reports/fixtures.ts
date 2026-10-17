/** Isolated synthetic scenarios for tests and local previews. Never used as a live-data fallback. */
import { buildDemoReportPayload, getDemoReportFilterOptions } from '@/lib/server/reports/demo';
import type { ReportPayload, ReportTimeSeriesPoint } from '@/lib/server/reports/types';
import { aggregateReportMetrics, buildReportKpis } from './metrics';
import { shiftReportDay } from './dates';
import { dailyCoverage } from './coverage';

export type ReportFixtureScenario = 'healthy' | 'declining' | 'sparse' | 'mixed' | 'empty' | 'failed' | 'missing-demographics';
export const REPORT_FIXTURE_NOW = new Date('2026-10-15T16:00:00Z');
export function buildReportFixture(scenario: ReportFixtureScenario = 'healthy'): ReportPayload {
  const account = getDemoReportFilterOptions().adAccounts[0];
  const payload = buildDemoReportPayload({ businessId: 'isolated-report-fixture', scope: 'ad_account',
    adAccountIds: [account.id], campaignIds: [], adsetIds: [], adIds: [],
    dateFrom: '2026-10-08', dateTo: '2026-10-14', groupBy: 'day', compareMode: 'previous_period',
  }, 'Synthetic fixture · never live', REPORT_FIXTURE_NOW);
  const source = (i: number, prior: boolean) => ({
    spend: prior ? 100 : 100 + i * 20,
    impressions: 1000 + i * 100, clicks: 20 + i * 5, inline_link_clicks: 10 + i * 2,
    leads: prior ? 10 : scenario === 'declining' ? 10 - i : 10 + i * 2,
    messages: 0, calls: 0, currency_code: 'USD',
  });
  const current = Array.from({ length: 7 }, (_, i) => source(i, false));
  const prior = Array.from({ length: 7 }, (_, i) => source(i, true));
  const series = (rows: typeof current, start: string): ReportTimeSeriesPoint[] => rows.map((row, i) => {
    const day = shiftReportDay(start, i);
    return { ...aggregateReportMetrics([row]), key: day, label: day, startDate: day, endDate: day };
  });
  payload.series = series(current, '2026-10-08');
  payload.summary = aggregateReportMetrics(current);
  payload.comparison = { previousDateFrom: '2026-10-01', previousDateTo: '2026-10-07',
    previousSeries: series(prior, '2026-10-01'), previousTotals: aggregateReportMetrics(prior) };
  // Keep the fixture hierarchy internally consistent with its series.
  payload.breakdown.rows = [{ ...payload.summary, id: 'fixture-campaign', name: 'Synthetic acquisition', level: 'campaign',
    status: 'PAUSED', primaryContext: account.label, secondaryContext: null, startDate: '2026-10-08', endDate: '2026-10-14' }];
  payload.breakdown.chart = [{ id: 'fixture-campaign', label: 'Synthetic acquisition', spend: payload.summary.spend, conversion: payload.summary.conversion, clicks: payload.summary.clicks }];
  payload.ranking = { topAdAccountCampaigns: payload.breakdown.rows, topAdAccountAdsets: [], topAdAccountAds: [], sameCampaignAdsets: [], sameAdsetAds: [] };
  payload.activeDates = null;
  const slice = (key: string, spend: number, impressions: number, clicks: number, results: number) => ({
    key, label: key, spend, impressions, clicks, results, ctr: clicks / impressions * 100,
    costPerResult: spend / results, shareOfSpend: spend / 1120,
  });
  payload.surface.audienceBreakdowns = { state: 'available', ageGender: [
    { ...slice('Female 25-34', 800, 6000, 180, 80), kind: 'age_gender', secondaryLabel: 'female' },
    { ...slice('Male 35-44', 320, 3100, 65, 32), kind: 'age_gender', secondaryLabel: 'male' },
  ], geo: [
    { ...slice('California', 800, 6000, 180, 80), kind: 'geo', secondaryLabel: 'region' },
    { ...slice('New York', 320, 3100, 65, 32), kind: 'geo', secondaryLabel: 'region' },
  ] };
  payload.surface.platformBreakdowns = { state: 'available', publisherPlatforms: [
    { ...slice('facebook', 800, 6000, 180, 0), costPerResult: 0, kind: 'publisher_platform' },
    { ...slice('instagram', 320, 3100, 65, 0), costPerResult: 0, kind: 'publisher_platform' },
  ], placements: [], impressionDevices: [
    { ...slice('mobile', 900, 7000, 200, 0), costPerResult: 0, kind: 'impression_device' },
    { ...slice('desktop', 220, 2100, 45, 0), costPerResult: 0, kind: 'impression_device' },
  ] };
  payload.surface.coverage = Object.fromEntries(['age_gender', 'geo', 'publisher_platform', 'impression_device'].map(key => [key,
    { state: 'available', basis: 'snapshot', dateFrom: '2026-10-01', dateTo: '2026-10-07' }]));
  payload.surface.hourlyTrendExpanded = [9, 17].map((hour, i) => ({
    label: `2026-10-08 ${hour}:00`, dayKey: '2026-10-08', dayOfWeek: 4, hourOfDay: hour,
    spend: 20 + i * 10, results: 2 + i * 2, clicks: 10 + i * 10, inlineLinkClicks: 5 + i * 5,
    impressions: 500, reach: 0, ctr: (10 + i * 10) / 500 * 100,
    cpc: (20 + i * 10) / (10 + i * 10), cpm: (20 + i * 10) / 500 * 1000,
    frequency: 0, costPerResult: (20 + i * 10) / (2 + i * 2),
  }));
  payload.surface.coverage.hourly = { state: 'partial', basis: 'period', dateFrom: '2026-10-08', dateTo: '2026-10-08' };
  if (scenario === 'sparse') {
    payload.series = payload.series.filter((_, i) => i !== 2 && i !== 4);
    payload.summary = aggregateReportMetrics(current.filter((_, i) => i !== 2 && i !== 4));
    payload.comparison.previousTotals = null;
    payload.comparison.previousSeries = [];
    payload.comparison.disabledReason = 'Incomplete daily coverage; comparison is unavailable.';
  }
  if (scenario === 'mixed') {
    const unavailable = { spend: 'Mixed currencies.', costPerResult: 'Mixed currencies.', cpc: 'Mixed currencies.', cpm: 'Mixed currencies.' };
    payload.meta.currencyCode = 'MIXED';
    payload.summary.unavailable = { ...payload.summary.unavailable, ...unavailable };
    payload.series.forEach(p => { p.unavailable = { ...p.unavailable, ...unavailable }; });
  }
  if (scenario === 'empty' || scenario === 'failed') {
    payload.series = []; payload.summary = aggregateReportMetrics([]);
    payload.comparison.previousTotals = null; payload.comparison.previousSeries = [];
    payload.comparison.disabledReason = scenario === 'failed' ? 'Report measurements could not be loaded.' : 'No measurements for this selection.';
    payload.breakdown.rows = []; payload.breakdown.chart = [];
    payload.ranking.topAdAccountCampaigns = [];
    payload.surface.audienceBreakdowns = { state: 'syncing', ageGender: [], geo: [] };
    payload.surface.platformBreakdowns = { state: 'syncing', publisherPlatforms: [], placements: [], impressionDevices: [] };
    payload.surface.hourlyTrendExpanded = [];
    payload.surface.coverage = { age_gender: { state: scenario === 'failed' ? 'error' : 'empty', basis: 'snapshot', dateFrom: null, dateTo: null } };
  }
  if (scenario === 'missing-demographics') {
    payload.surface.audienceBreakdowns = { state: 'syncing', ageGender: [], geo: [] };
    payload.surface.coverage.age_gender = { state: 'unknown', basis: 'snapshot', dateFrom: null, dateTo: null };
  }
  payload.meta.coverage = dailyCoverage(payload.series.map(p => p.startDate), payload.query.dateFrom, payload.query.dateTo);
  if (scenario === 'failed') payload.meta.coverage.state = 'error';
  if (payload.breakdown.rows.length) Object.assign(payload.breakdown.rows[0], payload.summary);
  payload.kpis = buildReportKpis({ totals: payload.summary, previousTotals: payload.comparison.previousTotals, currencyCode: payload.meta.currencyCode });
  // Structured snapshot fixtures retain independent measurement boundaries and source nulls.
  payload.surface.measurements = [
    ...payload.surface.audienceBreakdowns.ageGender.map(row => ({ row, type: 'age_gender', key1: 'age', value1: row.label.split(' ').at(-1)!, key2: 'gender', value2: row.secondaryLabel ?? 'unknown' })),
    ...payload.surface.audienceBreakdowns.geo.map(row => ({ row, type: 'region', key1: 'region', value1: row.label, key2: '', value2: '' })),
    ...payload.surface.platformBreakdowns.publisherPlatforms.map(row => ({ row, type: 'publisher_platform', key1: 'publisher_platform', value1: row.label, key2: '', value2: '' })),
    ...payload.surface.platformBreakdowns.impressionDevices.map(row => ({ row, type: 'impression_device', key1: 'impression_device', value1: row.label, key2: '', value2: '' })),
  ].map(({ row, type, key1, value1, key2, value2 }) => ({
    entityId: 'fixture-set', entityLevel: 'adset' as const, breakdownType: type,
    dimension1: { key: key1, value: value1 }, dimension2: { key: key2, value: value2 },
    dateFrom: '2026-10-01', dateTo: '2026-10-07', currencyCode: 'USD',
    values: { spend: row.spend, impressions: row.impressions, clicks: row.clicks, conversion: ['publisher_platform', 'impression_device'].includes(type) ? null : row.results, reach: null },
  }));
  if (!['empty', 'failed', 'missing-demographics'].includes(scenario)) {
    payload.surface.measurements.push(...payload.surface.measurements.filter(r => r.breakdownType === 'region').map((r, i) => ({ ...r, breakdownType: 'country', dimension1: { key: 'country', value: i ? 'CA' : 'US' } })));
    payload.surface.measurements.push(...payload.surface.measurements.filter(r => r.breakdownType === 'publisher_platform').map(r => ({ ...r, breakdownType: 'platform_position', dimension2: { key: 'platform_position', value: 'feed' } })));
  }
  for (const type of ['region', 'country', 'platform_position']) {
    payload.surface.coverage![type] = { state: payload.surface.measurements.some(r => r.breakdownType === type) ? 'available' : 'empty', basis: 'snapshot', dateFrom: '2026-10-01', dateTo: '2026-10-07' };
  }
  if (!['empty', 'failed'].includes(scenario)) {
    const campaign = payload.breakdown.rows[0];
    campaign.drilldownLabel = 'Ad sets';
    campaign.drilldownHref = `/reports?demo=1&campaign_id=fixture-campaign&date_from=${payload.query.dateFrom}&date_to=${payload.query.dateTo}`;
    payload.ranking.sameCampaignAdsets = [{ ...campaign, id: 'fixture-set', name: 'Synthetic prospecting', level: 'adset', drilldownLabel: 'Ads', drilldownHref: `/reports?demo=1&adset_id=fixture-set&date_from=${payload.query.dateFrom}&date_to=${payload.query.dateTo}` }];
    payload.ranking.topAdAccountAds = [0, 1].map(i => {
      const portion = (value: number) => i === 0 ? Math.floor(value * .6) : value - Math.floor(value * .6);
      const metrics = aggregateReportMetrics([{ spend: portion(payload.summary.spend), impressions: portion(payload.summary.impressions), clicks: portion(payload.summary.clicks), inline_link_clicks: portion(payload.summary.linkClicks), leads: portion(payload.summary.conversion), messages: 0, calls: 0, currency_code: 'USD' }]);
      return { ...campaign, ...metrics, id: `fixture-ad-${i}`, name: `Synthetic creative ${i + 1}`, level: 'ad' as const, primaryContext: 'Synthetic prospecting', secondaryContext: 'Synthetic acquisition',
        creativePreview: { image: `https://fixtures.invalid/reports/creative-${i}.png`, fallbackImage: null, kind: 'image' as const },
        creativeContext: 'Isolated creative preview fixture', drilldownLabel: 'Ad report', drilldownHref: `/reports?demo=1&ad_id=fixture-ad-${i}&date_from=${payload.query.dateFrom}&date_to=${payload.query.dateTo}` };
    });
    payload.findings = [{ id: 'fixture-finding', findingType: 'efficiency_drop_vs_delivery', severity: 'warning', confidence: 'medium', status: 'active',
      title: 'Synthetic efficiency observation', summary: 'Saved fixture evidence for historical review.', reason: 'This synthetic observation exercises the evidence inspector.',
      adsetId: 'fixture-set', campaignId: 'fixture-campaign', detectedAt: '2026-10-14T16:00:00Z', firstDetectedAt: '2026-10-14T16:00:00Z', lastDetectedAt: '2026-10-14T16:00:00Z', resolvedAt: null, dismissedAt: null, convertedToQueueAt: null,
      metricSnapshot: { periodStart: '2026-10-01', periodEnd: '2026-10-07', spend: 700, results: 70, costPerResult: 10, ctr: 2.5, occurrenceCount: 7 },
      actionLabel: null, actionHref: null, reportHref: '/reports?demo=1&date_from=2026-10-01&date_to=2026-10-07' }];
  }
  return payload;
}
