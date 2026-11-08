import 'server-only';
import { readAudienceSnapshot } from '@/lib/server/sync/resources/snapshots';
import { zodResponsesFunction } from 'openai/helpers/zod';
import { isReportDate, shiftReportDay } from '@/lib/shared/reports/dates';
import { analyticsArguments, analyticsRange, performanceAnswer, observationCoverage, values, windowRows, type AnalyticsArguments, type AnalyticsRow } from './analyticsModel';
import { AssistantError, type AssistantAccess } from './access';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { aggregateReportMetrics, reportMetricValue } from '@/lib/shared/reports/metrics';
import { selectAudienceLevel } from '@/lib/server/repositories/reports/surfaces';
import { buildSnapshotBreakdown, snapshotWindows } from '@/lib/shared/reports/breakdowns';
import type { ReportSurfaceContext } from '@/lib/server/reports/types';
import { buildTimeAnalysis } from '@/lib/shared/reports/timeAnalysis';
import { listActiveTrendFindingViews } from '@/lib/server/intelligence/repositories/trendFindings';
import { learningLabel } from '@/lib/server/dashboard/insights/model';
import { asRecord } from '@/lib/shared/utils/format';

export const analyticsNames = ['getAccountPerformance', 'getPerformanceRankings', 'getPerformanceBreakdown', 'getStoredFindings'] as const;
export const analyticsTools = analyticsNames.map(name => zodResponsesFunction({ name, parameters: analyticsArguments,
  description: name === 'getAccountPerformance' ? 'Stored period metrics, daily averages, previous-period comparisons and daily trends. Today uses seven completed baseline days with 8 PM eligibility. Account or an entity; native entityId optional. Platform-specific daily data may be unavailable.'
    : name === 'getPerformanceRankings' ? 'Top/bottom saved campaign, adset or ad observations for a period and metric. Coverage and outcome compatibility gate rankings. Learning is an ad-set state, not proof of poor performance.'
    : name === 'getPerformanceBreakdown' ? 'Stored publisher, demographic, placement, geographic snapshots or advertiser-local hourly metrics. Prefer exact requested coverage; otherwise return the latest dated snapshot with its actual coverage. Explain the date difference, summarize available segments, and never call fallback data the requested period or infer historical comparisons. Never apportions combined data.'
    : 'Stored intelligence findings for the selected account and dates; findings are observations, not permission to act.',
}));
const limitPage = (from: number) => { if (from >= 10000) throw new AssistantError('This lookup exceeds 10,000 observations. Narrow the dates or select one entity.'); };
async function dailyRows(scope: AssistantAccess, args: AnalyticsArguments, from: string, to: string) {
  return readAllPages((start, end) => {
    limitPage(start);
    let query = scope.db.from('report_entity_daily_v').select('entity_id,entity_external_id,entity_name,objective,day,spend,impressions,clicks,inline_link_clicks,leads,messages,calls,reach,currency_code,updated_at')
      .eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id)
      .eq('entity_level', args.level === 'account' ? 'adset' : args.level).gte('day', from).lte('day', to);
    if (args.entityId) query = query.eq('entity_external_id', args.entityId);
    return query.order('entity_id').order('day').range(start, end);
  }, { nullDataError: 'Daily reporting is unavailable.' });
}
export async function readAnalytics(name: string, raw: unknown, scope: AssistantAccess) {
  const args = analyticsArguments.parse(raw);
  const now = new Date(), timezone = scope.account.timezone;
  const range = analyticsRange(args, timezone, now);
  const metadata = { source: 'Stored Meta reporting; no live Meta requests', range, timezone, currency: scope.account.currency_code, platform: args.platform, account: scope.account.name };
  if (name === 'getStoredFindings') {
    if (args.platform !== 'combined') return { ...metadata, unavailable: 'Stored findings are not publisher-filtered. Ask for combined findings.' };
    const findings = await listActiveTrendFindingViews(scope.db, { businessId: scope.businessId, adAccountId: scope.account.id, dateFrom: range.dateFrom, dateTo: range.dateTo });
    return { ...metadata, findings: findings.slice(0, 8), totalFindings: findings.length, limitation: 'Findings retain their own evidence dates and confidence. They do not authorize actions or prove causality.' };
  }
  if (name === 'getPerformanceBreakdown') return breakdown(scope, args, metadata);
  // The stored daily reporting view has no publisher_platform dimension. Never substitute combined totals.
  if (args.platform !== 'combined') return { ...metadata, unavailable: 'Publisher-filtered daily history is not exposed by this assistant tool. Use getPerformanceBreakdown with publisher_platform for available exact-window delivery snapshots, or request combined daily metrics.' };
  const rows = await dailyRows(scope, args, name === 'getAccountPerformance' ? args.period === 'today' ? shiftReportDay(range.today, -13) : range.previous.dateFrom : range.dateFrom, range.dateTo);
  if (name === 'getAccountPerformance') return { ...metadata, ...performanceAnswer(rows.filter(r => r.day && r.day >= range.previous.dateFrom), args, timezone!, scope.account.currency_code, now), contextPeriods: args.period === 'today' ? [{ period: '7d', data: { ...metadata, ...performanceAnswer(rows, { ...args, period: '7d' }, timezone!, scope.account.currency_code, now) } }] : [], delivery: args.entityId ? await deliveryContext(scope, args) : null };
  if (name !== 'getPerformanceRankings') throw new AssistantError('Unknown analytics tool.');
  if (args.level === 'account') return { ...metadata, unavailable: 'Choose campaign, adset or ad for rankings.' };
  const grouped = new Map<string, AnalyticsRow[]>();
  for (const row of windowRows(rows, range)) if (row.entity_id) grouped.set(row.entity_id, [...grouped.get(row.entity_id) ?? [], row]);
  const candidates = [...grouped].map(([id, records]) => {
    const totals = aggregateReportMetrics(records), coverage = observationCoverage(records, range);
    const results = ['leads', 'messages', 'calls'].filter(key => (totals[key as 'leads'] ?? 0) > 0).join('+');
    return { id, name: records[0].entity_name, externalId: records[0].entity_external_id, objective: records[0].objective, resultDefinition: results || 'No observed results', coverage, metrics: values(totals), value: coverage.complete && !coverage.duplicate && records.every(r => r.currency_code === scope.account.currency_code) ? reportMetricValue(totals, args.metric) : null };
  });
  const compatible = !['conversion', 'costPerResult'].includes(args.metric) || new Set(candidates.map(r => `${r.objective}:${r.resultDefinition}`)).size <= 1;
  const eligible = compatible ? candidates.filter(r => r.value !== null).sort((a, b) => (args.order === 'lowest' ? 1 : -1) * (a.value! - b.value!) || a.id.localeCompare(b.id)).slice(0, 5) : [];
  const ids = eligible.map(r => r.id);
  const entities = ids.length ? await scope.db.from('ad_entities').select('id,raw,creative_external_id,parent_external_id,updated_at,status').eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).eq('entity_level', args.level).in('id', ids) : { data: [], error: null };
  if (entities.error) throw new AssistantError('Entity context is unavailable.', 503);
  return { ...metadata, observedAt: oldest(rows), metric: args.metric, order: args.order, eligibleCount: candidates.filter(r => r.value !== null).length,
    rankings: eligible.map(row => { const entity = entities.data?.find(e => e.id === row.id); return { ...row, creativeId: entity?.creative_external_id, currentStatus: entity?.status ?? null, statusObservedAt: entity?.updated_at ?? null, metaLearning: args.level === 'adset' ? learningLabel(asRecord(entity?.raw).learning_stage_info) : 'Learning applies to the parent ad set; inspect it separately.' }; }),
    unavailable: !compatible ? 'Mixed objectives or result definitions cannot form a result-efficiency ranking. Choose leads, messages or calls explicitly, or narrow the entity scope.' : !eligible.length ? 'No entities have complete observed daily coverage and a valid metric denominator.' : null,
    limitation: 'Observed metric ordering, not a health score or causal creative ranking. Missing entity-days exclude a candidate. Low volume, learning, current status and historical performance are separate. Results are actions, not bookings.',
  };
}
async function breakdown(scope: AssistantAccess, args: AnalyticsArguments, metadata: AnalyticsMetadata) {
  if (args.level !== 'account' || args.entityId) return { ...metadata, unavailable: 'Breakdown tools currently support account scope only.' };
  if (args.dimension === 'hourly') {
    if (args.platform !== 'combined') return { ...metadata, unavailable: 'Stored hourly observations have no publisher dimension.' };
    const rows = await readAllPages((from, to) => {
      limitPage(from);
      return scope.db.from('meta_hourly_performance').select('day,hour_of_day,entity_id,spend,impressions,clicks,inline_link_clicks,leads,messages,calls,currency_code,updated_at').eq('ad_account_id', scope.account.id).eq('entity_level', 'adset').eq('time_basis', 'advertiser').gte('day', metadata.range.dateFrom).lte('day', metadata.range.dateTo).order('entity_id').order('day').order('hour_of_day').range(from, to);
    }, { nullDataError: 'Hourly data unavailable' });
    const keys = rows.map(r => `${r.entity_id}:${r.day}:${r.hour_of_day}`);
    if (new Set(keys).size !== keys.length) return { ...metadata, unavailable: 'Overlapping hourly observations.' };
    const groups = new Map<string, typeof rows>();
    rows.forEach(r => { const key = `${r.day}:${r.hour_of_day}`; groups.set(key, [...groups.get(key) ?? [], r]); });
    const hourlyTrendExpanded = [...groups.values()].map(items => {
      const totals = aggregateReportMetrics(items.map(r => ({ ...r, currency_code: r.currency_code === scope.account.currency_code ? r.currency_code : null })));
      return { dayKey: items[0].day, hourOfDay: items[0].hour_of_day, spend: reportMetricValue(totals, 'spend'), impressions: reportMetricValue(totals, 'impressions'), clicks: reportMetricValue(totals, 'clicks'), results: reportMetricValue(totals, 'conversion'), inlineLinkClicks: reportMetricValue(totals, 'linkClicks') };
    });
    if (['leads', 'messages', 'calls'].includes(args.metric)) return { ...metadata, unavailable: 'Choose results or a delivery metric for this hourly view.' };
    const cells = buildTimeAnalysis({ hourlyTrendExpanded }, args.metric as 'spend', 'total', scope.account.currency_code);
    return { ...metadata, metric: args.metric, mode: 'total', cells: cells.filter(c => c.observations > 0), observedAt: oldest(rows), limitation: 'Observed advertiser-local hours only; absent hours are missing, not zero. Totals across observed dates, not daily averages. High spend or impressions does not establish an optimal hour.' };
  }
  const saved = await readAudienceSnapshot(scope.db, { businessId: scope.businessId, accountId: scope.account.id, breakdown: args.dimension, since: metadata.range.dateFrom, until: metadata.range.dateTo });
  const rows = saved?.rows ?? await readAllPages((from, to) => {
    limitPage(from);
    return scope.db.from('meta_audience_breakdowns_daily').select('*').eq('ad_account_id', scope.account.id).eq('breakdown_type', args.dimension).order('entity_id').order('dimension_1_value').order('dimension_2_value').range(from, to);
  }, { nullDataError: 'Breakdown data unavailable' });
  // Filter publisher and measurement window before resolving parent/child overlap.
  // An older parent snapshot must not suppress a newer child observation.
  const scoped = args.platform === 'combined' ? rows : rows.filter(r => r.publisher_platform === args.platform);
  const dated = scoped.filter(r => r.first_day && r.last_day && isReportDate(r.first_day) && isReportDate(r.last_day) && r.first_day <= r.last_day);
  const windows = [...new Set(dated.map(r => `${r.first_day} / ${r.last_day}`))].sort((a,b) => b.split(' / ')[1].localeCompare(a.split(' / ')[1]) || b.localeCompare(a));
  const availableWindows = windows.slice(0, 12);
  const requestedWindow = `${metadata.range.dateFrom} / ${metadata.range.dateTo}`;
  const chosen = saved ? `${saved.batch.coverage_start} / ${saved.batch.coverage_end}` : windows.includes(requestedWindow) ? requestedWindow : windows[0];
  const matchesRequestedPeriod = chosen === requestedWindow;
  const [dateFrom, dateTo] = chosen?.split(' / ') ?? [];
  const snapshotCoverage = chosen ? { dateFrom, dateTo, matchesRequestedPeriod, selection: matchesRequestedPeriod ? 'exact' : 'latest_available' } : null;
  const selected = selectAudienceLevel(dated.filter(r => r.first_day === dateFrom && r.last_day === dateTo), { adScopeOnly: false, adInternalIds: [] });
  if (selected.some(r => r.currency_code !== scope.account.currency_code)) return { ...metadata, unavailable: 'Snapshot currency does not match the selected account.' };
  const snapshotKeys = selected.map(r => `${r.entity_id}:${r.breakdown_type}:${r.dimension_1_value}:${r.dimension_2_value}`);
  if (new Set(snapshotKeys).size !== snapshotKeys.length) return { ...metadata, unavailable: 'Overlapping snapshot observations.' };
  const deliveryOnly = ['publisher_platform', 'platform_position'].includes(args.dimension);
  const surface = { measurements: selected.map(row => {
    const totals = aggregateReportMetrics([row]);
    return { entityId: row.entity_id, entityLevel: row.entity_level === 'ad' ? 'ad' as const : 'adset' as const, breakdownType: args.dimension, dimension1: { key: row.dimension_1_key ?? '', value: row.dimension_1_value ?? 'Unknown' }, dimension2: { key: row.dimension_2_key ?? '', value: row.dimension_2_value ?? '' }, dateFrom: row.first_day, dateTo: row.last_day, currencyCode: row.currency_code, values: { ...values(totals), ...(deliveryOnly ? { conversion: null, costPerResult: null } : {}) } };
  }) } as ReportSurfaceContext;
  if (['leads', 'messages', 'calls'].includes(args.metric)) return { ...metadata, unavailable: 'This breakdown exposes results only where supported; separate action metrics are unavailable.' };
  const window = snapshotWindows(surface, args.dimension)[0];
  return { ...metadata, requestedRange: metadata.range,
    range: snapshotCoverage ? { ...metadata.range, dateFrom, dateTo, partial: dateTo === metadata.range.today } : metadata.range,
    snapshotCoverage, availableWindows, observedAt: oldest(selected), metric: args.metric,
    coverageNotice: snapshotCoverage && !matchesRequestedPeriod ? `Audience snapshot: ${dateFrom}–${dateTo}. This describes the latest available coverage, not the requested ${metadata.range.dateFrom}–${metadata.range.dateTo}.` : null,
    breakdown: window ? buildSnapshotBreakdown(surface, args.dimension, args.metric as 'spend', window).items.slice(0, 20) : [],
    unavailable: saved?.batch.row_count === 0 ? 'Meta returned no observations for this measured snapshot window. This is not a zero-valued audience.' : !window ? 'No dated snapshot is available for this account, dimension and publisher. Unknown coverage cannot be assigned to the requested dates.' : deliveryOnly && ['conversion', 'costPerResult'].includes(args.metric) ? 'This source contains delivery metrics only.' : null,
    limitation: 'Snapshot data; the actual measurement dates are in snapshotCoverage. Summarize available segments using those dates even when the requested period is unavailable. Do not infer audience changes or a historical comparison from this snapshot. Top 20 segments by the selected metric. Delivery publisher is not necessarily the contact destination. Reach and frequency unavailable across overlapping audiences.',
  };
}
function oldest(rows: Array<{ updated_at: string | null }>) { return rows.length && rows.every(r => r.updated_at) ? rows.map(r => r.updated_at!).sort()[0] : null; }
type AnalyticsMetadata = { source: string; range: ReturnType<typeof analyticsRange>; timezone: string | null; currency: string | null; platform: AnalyticsArguments['platform']; account: string | null };

async function deliveryContext(scope: AssistantAccess, args: AnalyticsArguments) {
  const { data, error } = await scope.db.from('ad_entities').select('external_id,entity_level,status,raw,parent_external_id,updated_at').eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).eq('entity_level', args.level).eq('external_id', args.entityId!).maybeSingle();
  if (error) throw new AssistantError('Delivery context unavailable.', 503);
  if (!data) return { unavailable: 'Entity not found in this account.' };
  let parent = data.entity_level === 'adset' ? data : null;
  if (data.entity_level === 'ad' && data.parent_external_id) {
    const result = await scope.db.from('ad_entities').select('external_id,entity_level,status,raw,parent_external_id,updated_at').eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).eq('entity_level', 'adset').eq('external_id', data.parent_external_id).maybeSingle();
    if (result.error) throw new AssistantError('Parent learning context unavailable.', 503);
    parent = result.data;
  }
  return { status: data.status, observedAt: data.updated_at, learningAdset: parent?.external_id ?? null, metaLearning: learningLabel(asRecord(parent?.raw).learning_stage_info), learningObservedAt: parent?.updated_at ?? null, limitation: 'Saved current-delivery snapshot, separate from period performance. Unknown native learning is not completion or failure. No progress percentage is inferred.' };
}
