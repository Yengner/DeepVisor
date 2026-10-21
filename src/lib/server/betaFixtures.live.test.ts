import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
import { businesses, AS_OF, dayAt, uid } from '../../../scripts/beta-fixtures/fixture';
vi.mock('server-only', () => ({}));
vi.mock('./supabase/server', () => ({ createSupabaseClient: vi.fn(), createServerClient: vi.fn() }));
vi.mock('./supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('./actions/app/context', () => ({ getRequiredAppContext: vi.fn() }));
vi.mock('./actions/app/selection', () => ({ resolveCurrentSelection: vi.fn() }));
vi.mock('./dashboard/cache', () => ({ getCachedAdAccountShellData: vi.fn(), getCachedPlatformDetails: vi.fn() }));
import { createSupabaseClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { buildReportPayload } from './repositories/reports/buildReportPayload';
import { parseReportQueryInput } from './reports/query';
import { loadOverviewDaily, loadOverviewEntities } from './dashboard/overview/load';
import { reportMetricValue } from '@/lib/shared/reports/metrics';

const enabled = process.env.DEEPVISOR_FIXTURES === 'gkdyyjqepzayjdpvqnja';
describe.skipIf(!enabled)('real Supabase fixture application loaders (explicit opt-in)', () => {
  let client: SupabaseClient<Database>;
  beforeAll(async () => {
    expect(process.env.NODE_ENV).not.toBe('production');
    expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe('gkdyyjqepzayjdpvqnja.supabase.co');
    const state = JSON.parse(readFileSync(new URL('../../../.env.beta-fixtures.json', import.meta.url), 'utf8'));
    client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithPassword({ email: state.users.a.email, password: state.users.a.password });
    if (error) throw new Error(error.message);
    vi.mocked(createSupabaseClient).mockResolvedValue(client);
    // Exercise the server loader with an ordinary client as an additional RLS check.
    vi.mocked(createAdminClient).mockReturnValue(client);
  }, 30000);
  afterAll(async () => { await client?.auth.signOut(); });
  it('loads five ad sets and uses ad-set metrics with no delivery today', async () => {
    const entities = await loadOverviewEntities(businesses[0].id, businesses[0].accountId);
    expect(entities).toHaveLength(5);
    const rows = await loadOverviewDaily(businesses[0].id, businesses[0].accountId, AS_OF);
    const recent = rows.filter(r => r.day >= dayAt(-7) && r.day <= dayAt(-1));
    expect(recent.reduce((s,r)=>s+Number(r.spend),0)).toBe(994);
    expect(recent.reduce((s,r)=>s+Number(r.leads)+Number(r.messages)+Number(r.calls),0)).toBe(109);
    expect(rows.filter(r=>r.day===AS_OF).every(r=>r.spend===0)).toBe(true);
    expect(await loadOverviewDaily(businesses[0].id,businesses[1].accountId,AS_OF)).toEqual([]);
  }, 30000);
  it('loads Reports with exact totals, honest reach, and labeled mixed snapshots', async () => {
    const query = parseReportQueryInput(businesses[0].id, { ad_account_id: businesses[0].accountId, date_from: dayAt(-7), date_to: dayAt(-1), compare: 'previous_period' });
    const report = await buildReportPayload(query);
    expect(report.summary.spend).toBe(994);
    expect(report.summary.conversion).toBe(109);
    expect(reportMetricValue(report.summary,'reach')).toBeNull();
    expect(report.surface.coverage?.age_gender.basis).toBe('snapshot');
    expect(report.surface.coverage?.age_gender.state).toBe('mixed');
    expect(report.surface.coverage?.hourly.state).toBe('partial');
  }, 30000);
  it('rejects foreign/invalid account IDs in the real Reports loader', async () => {
    for (const account of [businesses[1].accountId, uid('invalid-account')]) {
      await expect(buildReportPayload(parseReportQueryInput(businesses[0].id, { ad_account_id: account, date_from: dayAt(-7), date_to: dayAt(-1) }))).rejects.toThrow();
    }
  }, 30000);
});
