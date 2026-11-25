import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ existing: null as Record<string, unknown> | null, update: vi.fn(), insert: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/actions/app/context', () => ({ getRequiredAppContext: async () => ({ user: { id: 'user' }, businessId: 'business' }) }));
vi.mock('@/lib/server/actions/app/selection', () => ({ resolveCurrentSelection: async () => ({ selectedPlatformId: 'integration', selectedAdAccountId: 'account' }) }));
vi.mock('@/lib/server/campaigns/drafts', async original => ({
  ...(await original<typeof import('@/lib/server/campaigns/drafts')>()),
  getCampaignDraftById: async () => m.existing,
  createCampaignDraft: m.insert,
}));
vi.mock('@/lib/server/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const row = table === 'platform_integrations'
        ? { id: 'integration', business_id: 'business', platform_id: 'meta', status: 'connected', platforms: { key: 'meta' } }
        : { id: 'account', business_id: 'business', platform_id: 'meta' };
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row, error: null }), update: m.update };
      return query;
    },
  }),
}));

import { POST } from './route';

const save = (body: unknown) => POST({ json: async () => body } as unknown as NextRequest);

describe('draft saving after the smart builder was retired', () => {
  beforeEach(() => { m.existing = null; m.update.mockReset(); m.insert.mockReset(); });

  it('does not accept a new smart draft', async () => {
    const response = await save({ payloadJson: { mode: 'smart', form: {} } });
    expect(response.status).toBe(400);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('never overwrites a stored smart draft with a manual one', async () => {
    m.existing = { id: 'draft', platform_integration_id: 'integration', ad_account_id: 'account', payload_json: { mode: 'smart', form: { budget: 32 } } };
    const response = await save({ draftId: 'draft', payloadJson: { mode: 'manual', form: {} } });
    expect(response.status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
  });
});
