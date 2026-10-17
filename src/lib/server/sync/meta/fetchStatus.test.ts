import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./client', () => ({fetchMetaCollection: vi.fn(),fetchMetaObject:vi.fn(),getBackfillDateRange:vi.fn()}));
import { fetchMetaCollection, fetchMetaObject } from './client';
import { fetchMetaAdsetSeeds, fetchMetaAdCreativeSeeds } from './fetch';
it('requests large thumbnails for individual creatives and collection fallback', async () => {
  vi.mocked(fetchMetaObject).mockResolvedValue({ id: '1', video_id: '2', thumbnail_url: 'https://media.test/large' });
  const rows = await fetchMetaAdCreativeSeeds({accessToken: 'private', adAccountExternalId: 'act_a', creativeExternalIds: ['1']});
  expect(fetchMetaObject).toHaveBeenCalledWith(expect.objectContaining({params: expect.objectContaining({thumbnail_width:800,thumbnail_height:800})}));
  expect(rows[0]).toMatchObject({videoId:'2', thumbnailUrl:'https://media.test/large'});
  vi.mocked(fetchMetaCollection).mockResolvedValue([]);
  await fetchMetaAdCreativeSeeds({accessToken: 'private', adAccountExternalId: 'act_a'});
  expect(fetchMetaCollection).toHaveBeenLastCalledWith(expect.objectContaining({path:'act_a/adcreatives',params:expect.objectContaining({thumbnail_width:800,thumbnail_height:800})}));
});
it('persists Meta effective status rather than configured status or delivery statistics', async () => {
  vi.mocked(fetchMetaCollection).mockResolvedValue([
    {id:'a',campaign_id:'c',status:'ACTIVE',effective_status:'ACTIVE'},
    {id:'b',campaign_id:'c',status:'ACTIVE',effective_status:'CAMPAIGN_PAUSED'},
    {id:'d',campaign_id:'c',status:'PAUSED',effective_status:'PAUSED'},
  ]);
  const rows = await fetchMetaAdsetSeeds({accessToken:'private',adAccountExternalId:'act_a'});
  expect(rows.map(r=>r.status)).toEqual(['active','campaign_paused','paused']);
});
