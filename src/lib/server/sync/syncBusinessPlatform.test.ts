import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  tables: [] as string[],
  synced: vi.fn(),
  failed: vi.fn(),
  metaSync: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      m.tables.push(table);
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: { id: 'integration', business_id: 'business', platform_id: 'platform', status: 'connected', access_token_secret_id: 'secret', integration_details: {}, platforms: { key: 'meta' } },
          error: null,
        }),
      };
      return query;
    },
  }),
}));
vi.mock('@/lib/server/repositories/business_data_policies/getBusinessDataPolicy', () => ({
  getOrCreateBusinessDataPolicy: async () => ({ daily_history_days: 90 }),
  clampHistoryDays: (days: number) => days,
}));
vi.mock('@/lib/server/integrations/service', () => ({
  resolveIntegrationAccessToken: async () => 'token',
  getPrimaryAdAccountSelection: () => ({ externalAccountId: 'act_1' }),
  markIntegrationSynced: m.synced,
  markIntegrationError: m.failed,
}));
vi.mock('./meta/syncMetaBusinessPlatform', () => ({ syncMetaBusinessPlatform: m.metaSync }));

import { syncBusinessPlatform } from './syncBusinessPlatform';

const run = () => syncBusinessPlatform({ businessId: 'business', integrationId: 'integration', trigger: 'manual_refresh' });

describe('full platform sync', () => {
  beforeEach(() => {
    m.tables.length = 0;
    m.synced.mockReset();
    m.failed.mockReset();
    m.metaSync.mockReset();
    m.metaSync.mockResolvedValue({ coverageStartDate: '2026-11-01', coverageEndDate: '2026-11-24', adAccounts: 1 });
  });

  it('marks saved Meta data as synced without running any follow-on processing', async () => {
    const summary = await run();
    expect(summary.coverageEndDate).toBe('2026-11-24');
    expect(m.synced).toHaveBeenCalledOnce();
    expect(m.failed).not.toHaveBeenCalled();
    // The wrapper itself only resolves the integration; facts are written by the Meta sync.
    expect(m.tables).toEqual(['platform_integrations']);
  });

  it('records a failed Meta read as an integration error', async () => {
    m.metaSync.mockRejectedValue(new Error('Meta read failed'));
    await expect(run()).rejects.toThrow('Meta read failed');
    expect(m.failed).toHaveBeenCalledWith(expect.anything(), 'integration', 'Meta read failed');
    expect(m.synced).not.toHaveBeenCalled();
  });
});
