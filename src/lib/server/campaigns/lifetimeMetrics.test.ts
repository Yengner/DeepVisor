import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/supabase/server', () => ({ createSupabaseClient: vi.fn() }));
import { createSupabaseClient } from '@/lib/server/supabase/server';
import { getCampaignLifetimeIncludingZeros } from '../repositories/campaigns/getCampaignsMetrics';
import { getAdSetsLifetimeIncludingZeros } from '../repositories/adsets/getAdSetsMetrics';
import { getAdsLifetimeIncludingZeros } from '../repositories/ads/getAdsMetrics';
import { readAllPages } from '../repositories/utils';
import { formatRecordedCurrency } from '@/components/campaigns/metrics';
import { creativeFixture } from './exploration/fixtures';

const performance = { spend: 60, impressions: 1000, clicks: 30, inline_link_clicks: 20,
  leads: 2, messages: 1, calls: 3, reach: 800, first_day: '2026-10-01', last_day: '2026-10-19' };
const dimensions = [
  { id: 'measured', external_id: 'measured-external', campaign_external_id: 'measured-external', adset_external_id: 'measured-external', ad_account_id: 'account', name: 'Measured', status: 'ACTIVE', creative_id: 'creative-1' },
  { id: 'missing', external_id: 'missing-external', campaign_external_id: 'measured-external', adset_external_id: 'measured-external', ad_account_id: 'account', name: 'No observations', status: 'PAUSED', creative_id: null },
];
beforeEach(() => {
  const client = { from(table: string) {
    const rows = table === 'ad_creatives' ? [creativeFixture()] : table.endsWith('_dims') ? dimensions : [{ ...performance, campaign_id: 'measured', adset_id: 'measured', ad_id: 'measured' }];
    const query = { select: () => query, eq: () => query, in: (column: string) => {
      if (table === 'ad_creatives') expect(column).toBe('platform_creative_id');
      return query;
    }, order: () => query, range: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve) };
    return query;
  } };
  vi.mocked(createSupabaseClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createSupabaseClient>>);
});
it('uses the persisted creative key and shared resolver for ad previews', async () => {
  const rows = await getAdsLifetimeIncludingZeros('account');
  expect(rows[0].creativePreview?.image).toBe('https://images.example.test/colour.jpg');
});
it.each([
  ['campaign', () => getCampaignLifetimeIncludingZeros('account')],
  ['ad set', () => getAdSetsLifetimeIncludingZeros('account')],
  ['ad', () => getAdsLifetimeIncludingZeros('account')],
] as const)('%s lifetime rows retain calls, distinguish missing observations, and withhold unverified unique reach', async (_name, load) => {
  const rows = await load();
  expect(rows.find(r => r.id === 'measured-external')).toMatchObject({ calls: 3, leads: 2, messages: 1, spend: '60.00', metricsAvailable: true, reach: null, frequency: null });
  expect(rows.find(r => r.id === 'missing-external')).toMatchObject({ metricsAvailable: false, cpc: null, cpm: null, ctr: null, reach: null });
});
it('does not turn undefined costs or currency into zero/USD', () => {
  expect(formatRecordedCurrency(null, 'USD')).toBe('—');
  expect(formatRecordedCurrency(12, null)).toBe('—');
  expect(formatRecordedCurrency(0, 'USD')).toBe('$0.00');
});
it('traverses a large table without duplicates and rejects failed later pages', async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
  expect(await readAllPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }))).toEqual(rows);
  await expect(readAllPages(async (from, to) => ({ data: rows.slice(from, to + 1), error: from ? new Error('unavailable') : null }))).rejects.toThrow('unavailable');
});
