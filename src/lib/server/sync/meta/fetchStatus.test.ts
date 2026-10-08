import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./client', () => ({fetchMetaCollection: vi.fn(),fetchMetaObject:vi.fn(),getBackfillDateRange:vi.fn()}));
import { fetchMetaCollection } from './client';
import { fetchMetaAdsetSeeds } from './fetch';
it('persists Meta effective status rather than configured status or delivery statistics', async () => {
  vi.mocked(fetchMetaCollection).mockResolvedValue([
    {id:'a',campaign_id:'c',status:'ACTIVE',effective_status:'ACTIVE'},
    {id:'b',campaign_id:'c',status:'ACTIVE',effective_status:'CAMPAIGN_PAUSED'},
    {id:'d',campaign_id:'c',status:'PAUSED',effective_status:'PAUSED'},
  ]);
  const rows = await fetchMetaAdsetSeeds({accessToken:'private',adAccountExternalId:'act_a'});
  expect(rows.map(r=>r.status)).toEqual(['active','campaign_paused','paused']);
});
