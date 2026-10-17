import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
vi.mock('server-only', () => ({}));
vi.mock('../../supabase/server', () => ({ createSupabaseClient: vi.fn() }));
import { createSupabaseClient } from '../../supabase/server';
import { buildReportPayload, getReportFilterOptions } from './buildReportPayload';
import { loadReportSurfaces } from './surfaces';
import { parseReportQueryInput } from '../../reports/query';
import { reportCsvRows } from './buildReportCsvRows';
import { buildReportPdfPayload } from './buildReportPdfPayload';
import { reportMetricValue } from '@/lib/shared/reports/metrics';

const transport = vi.fn<typeof fetch>();
const client = createClient<Database>('https://isolated.example.test', 'test', {
  auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport },
});
const metrics = { spend: 20, impressions: 1000, clicks: 10, inline_link_clicks: 8, leads: 2, messages: 1, calls: 1, reach: 500, currency_code: 'USD' };
const account = { id: 'account', business_id: 'business', platform_id: 'meta', external_account_id: 'act_1', name: 'Account', status: 'active', currency_code: 'USD', timezone: 'America/New_York' };
const campaign = { id: 'campaign-internal', ad_account_id: 'account', external_id: 'campaign', name: 'Archived history', status: 'ARCHIVED', objective: 'LEADS' };
const adset = { id: 'set', ad_account_id: 'account', campaign_external_id: 'campaign', external_id: 'set-external', name: 'Old ad set', status: 'PAUSED', optimization_goal: 'LEADS' };
const ad = { id: 'ad', ad_account_id: 'account', adset_external_id: 'set-external', external_id: 'ad-external', name: 'Old ad', status: 'PAUSED', creative_id: null };
const snapshot = (overrides: Record<string, unknown> = {}) => ({ ...metrics, ad_account_id: 'account', entity_id: 'set', entity_level: 'adset', adset_id: 'set', ad_id: null,
  first_day: '2026-01-01', last_day: '2026-01-14', day: '2026-01-14', breakdown_type: 'age_gender', dimension_1_key: 'age', dimension_1_value: '25-34', dimension_2_key: 'gender', dimension_2_value: 'female', ...overrides });
let snapshots: ReturnType<typeof snapshot>[];
let hourlyRows: Record<string, unknown>[];
let failAudience = false, failHourly = false, failMetrics = false, omitDay = false;
const rpcCalls: Record<string, unknown>[] = [];
const surfaceInput = { adsetInternalIds: ['set'], adInternalIds: [], adScopeOnly: false, isMeta: true, dateFrom: '2026-01-10', dateTo: '2026-01-11', timezone: 'America/New_York' };
const query = () => parseReportQueryInput('business', { ad_account_id: 'account', date_from: '2026-01-10', date_to: '2026-01-11', compare: 'previous_period' });
const options = { includeSurface: false, includeRanking: false, includeActiveDates: false, includeBreakdown: false };
beforeEach(() => {
  snapshots = [snapshot()]; hourlyRows = []; rpcCalls.length = 0;
  failAudience = failHourly = failMetrics = omitDay = false;
  vi.mocked(createSupabaseClient).mockResolvedValue(client);
  transport.mockImplementation(async (url, init) => {
    const u = new URL(String(url)), p = u.searchParams, table = u.pathname.split('/').at(-1);
    const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
    if (table === 'business_profiles') { expect(p.get('id')).toBe('eq.business'); return reply({ id: 'business', business_name: 'Test' }); }
    if (table === 'platform_integrations') {
      expect(p.get('business_id')).toBe('eq.business');
      if (p.get('id')) return reply(p.get('id') === 'eq.platform' ? { platform_id: 'meta' } : null);
      return reply([{ id: 'platform', platform_id: 'meta', status: 'connected', platforms: { key: 'meta', name: 'Meta' } }]);
    }
    if (table === 'ad_accounts') { expect(p.get('business_id')).toBe('eq.business'); return reply([account]); }
    if (['campaign_dims', 'adset_dims', 'ad_dims'].includes(table!)) {
      expect(p.get('ad_account_id')).toBe('in.(account)');
      return reply(table === 'campaign_dims' ? [campaign] : table === 'adset_dims' ? [adset] : [ad]);
    }
    if (table === 'get_report_metric_rows') {
      const args = JSON.parse(String(init?.body)); rpcCalls.push(args);
      expect(args.p_ad_account_ids).toEqual(['account']);
      if (failMetrics) return reply({ message: 'unavailable' }, 503);
      const days = [args.p_date_from, args.p_date_to];
      return reply(days.filter((d, i) => (!omitDay || i === 0) && days.indexOf(d) === i).map(day => ({ ...metrics, day })));
    }
    if (table === 'get_report_breakdown_rows') return reply([{ ...metrics, entity_external_id: 'campaign', entity_id: 'campaign-internal', entity_name: 'Archived history', entity_level: 'campaign', ad_account_id: 'account', start_date: '2026-01-10', end_date: '2026-01-11' }]);
    if (table === 'meta_audience_breakdowns_daily') {
      expect(p.get('adset_id')).toBe('in.(set)');
      if (failAudience) return reply({ message: 'audience unavailable' }, 503);
      const offset = Number(p.get('offset') ?? 0), limit = Number(p.get('limit') ?? 1000);
      return reply(snapshots.slice(offset, offset + limit));
    }
    if (table === 'meta_hourly_performance') {
      expect(p.get('time_basis')).toBe('eq.advertiser');
      expect(p.getAll('day')).toEqual(['gte.2026-01-10', 'lte.2026-01-11']);
      expect(p.get('adset_id')).toBe('in.(set)');
      if (failHourly) return reply({ message: 'hourly unavailable' }, 503);
      const level = p.get('entity_level')?.slice(3);
      return reply(hourlyRows.filter(r => r.entity_level === level));
    }
    if (table === 'trend_findings') return reply([]);
    throw new Error(`Unexpected request: ${table}`);
  });
});
describe('report repository correctness', () => {
  it('honors account date ranges and loads matching previous series without Max mode', async () => {
    const payload = await buildReportPayload(query(), client, options);
    expect(payload.query).toMatchObject({ dateFrom: '2026-01-10', dateTo: '2026-01-11', rangeMode: 'date_range', compareMode: 'previous_period' });
    expect(payload.meta.timezone).toBe('America/New_York');
    expect(payload.summary).toMatchObject({ spend: 40, conversion: 8, ctr: 1, costPerResult: 5 });
    expect(payload.comparison.previousSeries).toHaveLength(2);
    expect(payload.comparison.previousDateFrom).toBe('2026-01-08');
    expect(rpcCalls).toHaveLength(2);
    expect(reportMetricValue(payload.summary, 'reach')).toBeNull();
  });
  it('disables deltas for holes in either period without fabricating zero days', async () => {
    omitDay = true;
    const payload = await buildReportPayload(query(), client, options);
    expect(payload.meta.coverage?.state).toBe('partial');
    expect(payload.series).toHaveLength(1);
    expect(payload.comparison.previousTotals).toBeNull();
    expect(payload.kpis.every(k => k.deltaPercent == null)).toBe(true);
  });
  it('keeps failed core reads as errors rather than zero performance', async () => {
    failMetrics = true;
    await expect(buildReportPayload(query(), client, options)).rejects.toBeDefined();
  });
  it('preserves archived entities in historical filter options', async () => {
    const filters = await getReportFilterOptions(query());
    expect(filters.campaigns).toContainEqual({ id: 'campaign', parentId: 'account', label: 'Archived history' });
    expect(filters.ads[0].id).toBe('ad-external');
  });
  it('rejects foreign accounts before metric reads', async () => {
    await expect(buildReportPayload({ ...query(), adAccountIds: ['foreign'] }, client, options)).rejects.toThrow('not authorized');
    expect(rpcCalls).toHaveLength(0);
  });
  it('rejects foreign platform selection rather than widening to all accounts', async () => {
    await expect(buildReportPayload({ ...query(), platformIntegrationId: 'foreign' }, client, options)).rejects.toThrow('not authorized');
    expect(rpcCalls).toHaveLength(0);
  });
  it('rejects unknown entity selection before metric reads', async () => {
    await expect(buildReportPayload({ ...query(), scope: 'ad', adIds: ['foreign'] }, client, options)).rejects.toThrow('not authorized');
    expect(rpcCalls).toHaveLength(0);
  });
  it('uses the same dates and available values for PDF and CSV contracts', async () => {
    const payload = await buildReportPdfPayload(query(), client);
    expect(payload.query.dateFrom).toBe('2026-01-10');
    const rows = reportCsvRows(payload);
    expect(rows[0]).toMatchObject({ report_date_from: '2026-01-10', report_date_to: '2026-01-11', account_timezone: 'America/New_York', reach: '', frequency: '', spend: 20, ctr: 1 });
  });
});
describe('snapshot and hourly repositories', () => {
  it('keeps measurement boundaries distinct from selected dates and timestamp metadata', async () => {
    snapshots = [snapshot({ first_day: null, last_day: null, created_at: '2026-01-01', updated_at: '2026-01-14' })];
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.coverage?.age_gender.state).toBe('unknown');
    expect(surface.audienceBreakdowns.ageGender[0].spend).toBe(20);
  });
  it('verifies numerical audience, geography, placement and device aggregates', async () => {
    snapshots = [snapshot(), snapshot({ dimension_2_value: 'male', spend: 80, impressions: 3000, clicks: 90 }),
      snapshot({ breakdown_type: 'country', dimension_1_value: 'US' }),
      snapshot({ breakdown_type: 'region', dimension_1_value: 'New York' }),
      snapshot({ breakdown_type: 'publisher_platform', dimension_1_value: 'instagram', publisher_platform: 'instagram' }),
      snapshot({ breakdown_type: 'impression_device', dimension_1_value: 'iphone', impression_device: 'iphone' })];
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.audienceBreakdowns.ageGender.reduce((sum, r) => sum + r.spend, 0)).toBe(100);
    expect(surface.audienceBreakdowns.geo.map(r => r.shareOfSpend)).toEqual([100, 100]);
    expect(surface.platformBreakdowns.publisherPlatforms[0]).toMatchObject({ clicks: 10, ctr: 1, spend: 20 });
    expect(surface.platformBreakdowns.impressionDevices[0]).toMatchObject({ clicks: 10, ctr: 1, spend: 20 });
    expect(surface.unavailableMetrics?.publisher_platform.conversion).toBeTruthy();
    expect(surface.coverage?.age_gender).toMatchObject({ dateFrom: '2026-01-01', dateTo: '2026-01-14' });
  });
  it('does not add parent and child measurements', async () => {
    snapshots.push(snapshot({ entity_level: 'ad', entity_id: 'ad', ad_id: 'ad' }));
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.audienceBreakdowns.ageGender[0].spend).toBe(20);
    const adSurface = await loadReportSurfaces(client, { ...surfaceInput, adScopeOnly: true, adInternalIds: ['ad'] });
    expect(adSurface.audienceBreakdowns.ageGender[0].spend).toBe(20);
  });
  it('paginates snapshots rather than silently stopping at 1000 records', async () => {
    snapshots = Array.from({ length: 1001 }, (_, i) => snapshot({ dimension_1_value: `band-${i}` }));
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.audienceBreakdowns.ageGender).toHaveLength(1001);
  });
  it('keeps snapshot failure distinct from empty and preserves hourly observations', async () => {
    failAudience = true;
    hourlyRows = [{ ...metrics, entity_level: 'adset', adset_id: 'set', day: '2026-01-10', hour_of_day: 12 }];
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.coverage?.age_gender.state).toBe('error');
    expect(surface.hourlyTrendExpanded[0]).toMatchObject({ spend: 20, clicks: 10, results: 4, ctr: 1 });
  });
  it('keeps hourly failure separate from valid snapshots', async () => {
    failHourly = true;
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.coverage?.hourly.state).toBe('error');
    expect(surface.audienceBreakdowns.ageGender).toHaveLength(1);
  });
  it('avoids parent/child double counting in the same hourly slot', async () => {
    hourlyRows = ['adset', 'ad'].map(entity_level => ({ ...metrics, entity_level, adset_id: 'set', ad_id: entity_level === 'ad' ? 'ad' : null, day: '2026-01-10', hour_of_day: 12 }));
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.hourlyTrendExpanded[0]).toMatchObject({ spend: 20, results: 4, impressions: 1000 });
  });
});

describe('incomplete measurements', () => {
  it('does not convert missing demographic results into observed zero results', async () => {
    snapshots = [snapshot({ leads: null })];
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.measurements?.[0].values.conversion).toBeNull();
    expect(surface.measurements?.[0].values.spend).toBe(20);
    expect(surface.unavailableMetrics?.age_gender.conversion).toBeTruthy();
  });
  it('retains valid delivery metrics when snapshot currencies differ', async () => {
    snapshots = [snapshot(), snapshot({ currency_code: 'EUR', dimension_2_value: 'male' })];
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.unavailableMetrics?.age_gender.spend).toBeTruthy();
    expect(surface.measurements?.map(row => row.values.impressions)).toEqual([1000, 1000]);
    expect(surface.measurements?.map(row => row.currencyCode)).toEqual(['USD', 'EUR']);
  });
  it('marks a partially measured hourly slot unavailable rather than adding only known children', async () => {
    hourlyRows = [
      { ...metrics, entity_level: 'ad', adset_id: 'set', ad_id: 'one', day: '2026-01-10', hour_of_day: 12 },
      { ...metrics, entity_level: 'ad', adset_id: 'set', ad_id: 'two', clicks: null, day: '2026-01-10', hour_of_day: 12 },
    ];
    const surface = await loadReportSurfaces(client, surfaceInput);
    expect(surface.hourlyTrendExpanded).toEqual([]);
    expect(surface.coverage?.hourly.state).toBe('partial');
  });
});
