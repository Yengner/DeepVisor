import 'server-only';
import type { createSupabaseClient } from '@/lib/server/supabase/server';
import type { Database } from '@/lib/shared/types/supabase';
import type { DashboardAudienceMetricRow, DashboardTrendPoint } from '@/lib/server/dashboard/types';
import type { ReportSurfaceContext } from '@/lib/server/reports/types';
import { buildAudienceBreakdowns, buildPlatformBreakdowns } from '@/lib/server/dashboard/buildPayload';
import { aggregateReportMetrics, reportMetricValue } from '@/lib/shared/reports/metrics';
import { dailyCoverage, snapshotCoverage } from '@/lib/shared/reports/coverage';
import { chunkArray } from '../utils';

type Client = Awaited<ReturnType<typeof createSupabaseClient>>;
type AudienceRow = Database['public']['Views']['meta_audience_breakdowns_daily']['Row'];
type SurfaceInput = {
  adsetInternalIds: string[]; adInternalIds: string[]; adScopeOnly: boolean;
  isMeta: boolean; dateFrom: string; dateTo: string; timezone: string | null;
};
const dimensions = ['publisher_platform', 'platform_position', 'impression_device', 'age_gender', 'country', 'region', 'dma'];
const deliveryOnly = ['publisher_platform', 'platform_position', 'impression_device'];

/** Prefer each ad set's own observations, falling back to its children, never both. */
export function selectAudienceLevel(rows: AudienceRow[], input: Pick<SurfaceInput, 'adScopeOnly' | 'adInternalIds'>): AudienceRow[] {
  if (input.adScopeOnly) return rows.filter(r => r.entity_level === 'ad' && r.ad_id && input.adInternalIds.includes(r.ad_id));
  const parents = new Set(rows.filter(r => r.entity_level === 'adset').map(r => `${r.adset_id}:${r.breakdown_type}`));
  return rows.filter(r => r.entity_level === 'adset' || (r.entity_level === 'ad' && !parents.has(`${r.adset_id}:${r.breakdown_type}`)));
}
async function audienceRows(client: Client, input: SurfaceInput): Promise<AudienceRow[]> {
  const rows: AudienceRow[] = [];
  for (const ids of chunkArray(input.adsetInternalIds, 200)) {
    for (let page = 0; ; page++) {
      const { data, error } = await client.from('meta_audience_breakdowns_daily')
        .select('*').in('adset_id', ids).in('breakdown_type', dimensions)
        .order('entity_id').order('breakdown_type').order('dimension_1_value').order('dimension_2_value')
        .range(page * 1000, page * 1000 + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  return selectAudienceLevel(rows, input);
}
function normalizeAudience(row: AudienceRow): DashboardAudienceMetricRow {
  return {
    entityLevel: row.entity_level === 'ad' ? 'ad' : 'adset',
    adsetInternalId: row.adset_id, adInternalId: row.ad_id,
    breakdownType: row.breakdown_type ?? '',
    dimension1Key: row.dimension_1_key ?? '', dimension1Value: row.dimension_1_value ?? '',
    dimension2Key: row.dimension_2_key ?? '', dimension2Value: row.dimension_2_value ?? '',
    publisherPlatform: row.publisher_platform, platformPosition: row.platform_position, impressionDevice: row.impression_device,
    spend: row.spend ?? 0, impressions: row.impressions ?? 0, clicks: row.clicks ?? 0,
    leads: deliveryOnly.includes(row.breakdown_type ?? '') ? 0 : row.leads ?? 0,
    messages: deliveryOnly.includes(row.breakdown_type ?? '') ? 0 : row.messages ?? 0,
    calls: deliveryOnly.includes(row.breakdown_type ?? '') ? 0 : row.calls ?? 0,
  };
}
export async function loadReportSurfaces(client: Client, input: SurfaceInput): Promise<ReportSurfaceContext> {
  const emptyInput = { isMeta: input.isMeta, hasLiveDelivery: false, audienceRows: [] };
  const result: ReportSurfaceContext = {
    isMeta: input.isMeta, platformBreakdowns: buildPlatformBreakdowns(emptyInput),
    audienceBreakdowns: buildAudienceBreakdowns(emptyInput), hourlyTrendExpanded: [],
    coverage: {}, unavailableMetrics: {},
  };
  if (!input.isMeta) return result;
  const [audience, hourly] = await Promise.allSettled([
    audienceRows(client, input),
    input.timezone ? listReportHourlyTrendRows(client, input) : Promise.resolve({ points: [], incomplete: false, mixedCurrency: false }),
  ]);
  const sourceRows = audience.status === 'fulfilled' ? audience.value : [];
  result.measurements = sourceRows.map(row => {
    const metrics = aggregateReportMetrics([row]);
    const unsupported = deliveryOnly.includes(row.breakdown_type ?? '');
    return {
      entityId: row.entity_id, entityLevel: row.entity_level === 'ad' ? 'ad' : 'adset',
      breakdownType: row.breakdown_type ?? '',
      dimension1: { key: row.dimension_1_key ?? '', value: row.dimension_1_value ?? '' },
      dimension2: { key: row.dimension_2_key ?? '', value: row.dimension_2_value ?? '' },
      dateFrom: row.first_day, dateTo: row.last_day, currencyCode: row.currency_code,
      values: {
        spend: reportMetricValue(metrics, 'spend'), impressions: reportMetricValue(metrics, 'impressions'),
        clicks: reportMetricValue(metrics, 'clicks'), ctr: reportMetricValue(metrics, 'ctr'),
        cpc: reportMetricValue(metrics, 'cpc'), cpm: reportMetricValue(metrics, 'cpm'),
        conversion: unsupported ? null : reportMetricValue(metrics, 'conversion'),
        costPerResult: unsupported ? null : reportMetricValue(metrics, 'costPerResult'),
        reach: null, frequency: null,
      },
    };
  });
  for (const dimension of dimensions) {
    const selected = sourceRows.filter(r => r.breakdown_type === dimension);
    result.coverage![dimension] = audience.status === 'rejected'
      ? { state: 'error', basis: 'snapshot', dateFrom: null, dateTo: null }
      : snapshotCoverage(selected);
    result.unavailableMetrics![dimension] = {
      ...aggregateReportMetrics(selected).unavailable,
      reach: 'Unique reach cannot be summed across entities.', frequency: 'Verified unique reach is unavailable.',
      ...(deliveryOnly.includes(dimension) ? { conversion: 'This source requests delivery metrics only.', costPerResult: 'Attributed results were not requested for this breakdown.' } : {}),
    };
  }
  // Existing builders prefer one level globally. Aggregate each level separately only after
  // eliminating overlapping parent/child records, then treat disjoint rows uniformly.
  const normalized = sourceRows.flatMap(source => {
    const unavailable = result.unavailableMetrics![source.breakdown_type ?? ''] ?? {};
    // Current legacy charts require these three inputs together. Preserve raw nullable
    // measurements above for the focused metric-switching views in subsequent phases.
    if (unavailable.spend || unavailable.impressions || unavailable.clicks) return [];
    const row = normalizeAudience(source);
    return [{ ...row, entityLevel: 'adset' as const,
      leads: unavailable.conversion ? 0 : row.leads,
      messages: unavailable.conversion ? 0 : row.messages,
      calls: unavailable.conversion ? 0 : row.calls,
    }];
  });
  const builderInput = { isMeta: true, hasLiveDelivery: normalized.length > 0, audienceRows: normalized };
  result.platformBreakdowns = buildPlatformBreakdowns(builderInput);
  result.audienceBreakdowns = buildAudienceBreakdowns(builderInput);
  // Geography denominators must stay within one dimension, not country + region + DMA.
  result.audienceBreakdowns.geo = ['country', 'region', 'dma'].flatMap(dimension =>
    buildAudienceBreakdowns({ ...builderInput, audienceRows: normalized.filter(r => r.breakdownType === dimension) }).geo);
  result.hourlyTrendExpanded = hourly.status === 'fulfilled' ? hourly.value.points : [];
  if (hourly.status === 'fulfilled' && hourly.value.mixedCurrency) {
    result.unavailableMetrics!.hourly = { spend: 'A single known currency is required.', cpc: 'A single known currency is required.', cpm: 'A single known currency is required.', costPerResult: 'A single known currency is required.' };
  }
  result.coverage!.hourly = !input.timezone
    ? { state: 'unknown', basis: 'period', dateFrom: null, dateTo: null }
    : hourly.status === 'rejected'
      ? { state: 'error', basis: 'period', dateFrom: null, dateTo: null }
      : dailyCoverage(result.hourlyTrendExpanded.flatMap(r => r.dayKey ? [r.dayKey] : []), input.dateFrom, input.dateTo);
  if (hourly.status === 'fulfilled' && hourly.value.incomplete && result.coverage!.hourly.state !== 'error') result.coverage!.hourly.state = 'partial';
  return result;
}

async function listReportHourlyTrendRows(
  supabase: Client,
  input: {
    adsetInternalIds: string[];
    adInternalIds: string[];
    adScopeOnly: boolean;
    dateFrom: string;
    dateTo: string;
  }
): Promise<{ points: DashboardTrendPoint[]; incomplete: boolean; mixedCurrency: boolean }> {
  if (input.adsetInternalIds.length === 0) {
    return { points: [], incomplete: false, mixedCurrency: false };
  }

  type HourlySelectRow = Pick<
    Database['public']['Views']['meta_hourly_performance']['Row'],
    | 'currency_code'
    | 'adset_id'
    | 'day'
    | 'hour_of_day'
    | 'entity_level'
    | 'ad_id'
    | 'spend'
    | 'reach'
    | 'impressions'
    | 'clicks'
    | 'inline_link_clicks'
    | 'leads'
    | 'messages'
    | 'calls'
  >;

  const selectedAdIds = new Set(input.adInternalIds);
  const fetchRows = async (entityLevel: 'adset' | 'ad') => {
    const rows: HourlySelectRow[] = [];

    for (const chunk of chunkArray(input.adsetInternalIds, 200)) {
      for (let page = 0; ; page++) {
        const { data, error } = await supabase
          .from('meta_hourly_performance')
          .select(
            'currency_code, adset_id, day, hour_of_day, entity_level, ad_id, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls'
          )
          .gte('day', input.dateFrom)
          .lte('day', input.dateTo)
          .eq('time_basis', 'advertiser')
          .eq('entity_level', entityLevel)
          .in('adset_id', chunk)
          .order('day', { ascending: true })
          .order('hour_of_day', { ascending: true }).order('adset_id').order('ad_id')
          .range(page * 1000, page * 1000 + 999);

        if (error) {
          throw error;
        }

        rows.push(...((data ?? []) as HourlySelectRow[]));
        if (!data || data.length < 1000) break;
      }
    }

    return rows;
  };

  const primaryRows = await fetchRows(input.adScopeOnly ? 'ad' : 'adset');
  const childRows = input.adScopeOnly ? [] : await fetchRows('ad');
  const parentKeys = new Set(primaryRows.map(row => `${row.adset_id}:${row.day}:${row.hour_of_day}`));
  const rows = [...primaryRows, ...childRows.filter(row => !parentKeys.has(`${row.adset_id}:${row.day}:${row.hour_of_day}`))];

  const scopedRows = input.adScopeOnly
    ? rows.filter((row) => Boolean(row.ad_id && selectedAdIds.has(row.ad_id)))
    : rows;
  const incompleteSlots = new Set(scopedRows.filter(row =>
    [row.spend, row.impressions, row.clicks, row.inline_link_clicks, row.leads, row.messages, row.calls].some(value => value == null)
  ).map(row => `${row.day}:${row.hour_of_day}`));
  const currencies = new Set(scopedRows.map(row => row.currency_code));
  const mixedCurrency = currencies.size > 1 || currencies.has(null);
  const aggregated = new Map<
    string,
    {
      day: string;
      hour: number;
      spend: number;
      reach: number;
      impressions: number;
      clicks: number;
      inlineLinkClicks: number;
      leads: number;
      messages: number;
      calls: number;
    }
  >();

  for (const row of scopedRows) {
    if (incompleteSlots.has(`${row.day}:${row.hour_of_day}`)) continue;
    const day = row.day;
    const hour = row.hour_of_day ?? -1;

    if (!day || hour < 0 || hour > 23) {
      continue;
    }

    const key = `${day}:${hour}`;
    const current = aggregated.get(key) ?? {
      day,
      hour,
      spend: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
      inlineLinkClicks: 0,
      leads: 0,
      messages: 0,
      calls: 0,
    };

    current.spend += row.spend ?? 0;
    current.reach += row.reach ?? 0;
    current.impressions += row.impressions ?? 0;
    current.clicks += row.clicks ?? 0;
    current.inlineLinkClicks += row.inline_link_clicks ?? 0;
    current.leads += row.leads ?? 0;
    current.messages += row.messages ?? 0;
    current.calls += row.calls ?? 0;
    aggregated.set(key, current);
  }

  const points = Array.from(aggregated.values())
    .sort((left, right) => left.day.localeCompare(right.day) || left.hour - right.hour)
    .map((row) => {
      const results = row.leads + row.messages + row.calls;
      const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
      const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
      const cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;
      const day = new Date(`${row.day}T00:00:00Z`);
      const utcDay = Number.isNaN(day.getTime()) ? null : day.getUTCDay();

      return {
        label: `${row.day} · ${row.hour}`,
        dayKey: row.day,
        dayOfWeek: utcDay == null ? null : utcDay === 0 ? 6 : utcDay - 1,
        hourOfDay: row.hour,
        spend: mixedCurrency ? 0 : row.spend,
        results,
        clicks: row.clicks,
        inlineLinkClicks: row.inlineLinkClicks,
        impressions: row.impressions,
        reach: 0,
        ctr: Number(ctr.toFixed(2)),
        cpc: mixedCurrency ? 0 : cpc,
        cpm: mixedCurrency ? 0 : cpm,
        frequency: 0,
        costPerResult: results > 0 ? Number((row.spend / results).toFixed(2)) : 0,
      } satisfies DashboardTrendPoint;
    });
  return { points, incomplete: incompleteSlots.size > 0, mixedCurrency };
}

