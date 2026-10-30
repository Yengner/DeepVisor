import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./client', () => ({fetchMetaCollection: vi.fn(),fetchMetaObject:vi.fn(),getBackfillDateRange:vi.fn()}));
import { fetchMetaCollection, fetchMetaObject } from './client';
import { fetchMetaAdsetSeeds, fetchMetaAdCreativeSeeds, fetchMetaAdsetPerformanceSeeds, fetchMetaAdsetAudienceBreakdownSeeds, fetchMetaAdAudienceBreakdownSeeds } from './fetch';
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

it('normalizes delivery zero without borrowing action clicks and preserves missing reach', async()=>{
 vi.mocked(fetchMetaCollection).mockResolvedValue([{adset_id:'1',date_start:'2026-10-29',spend:'0',impressions:'0',clicks:'0',inline_link_clicks:'0',actions:[{action_type:'link_click',value:'4'}]}]);
 const rows=await fetchMetaAdsetPerformanceSeeds({accessToken:'test-only',adAccountExternalId:'act_1',dateRange:{since:'2026-10-29',until:'2026-10-29'}});
 expect(rows[0]).toMatchObject({spend:0,inlineLinkClicks:0,reach:null});
 vi.mocked(fetchMetaCollection).mockResolvedValue([{adset_id:'1',date_start:'2026-10-29',spend:'invalid',impressions:'0',clicks:'0'}]);
 await expect(fetchMetaAdsetPerformanceSeeds({accessToken:'test-only',adAccountExternalId:'act_1',dateRange:{since:'2026-10-29',until:'2026-10-29'}})).rejects.toThrow('Invalid Meta metric');
});
it('distinguishes unsupported audience dimensions from operational failures',async()=>{
 const input={accessToken:'test-only',adAccountExternalId:'act_1',allowedBreakdowns:['age_gender']};
 vi.mocked(fetchMetaCollection).mockRejectedValue(new Error('Breakdown not supported'));
 expect(await fetchMetaAdsetAudienceBreakdownSeeds(input)).toEqual([]);
 vi.mocked(fetchMetaCollection).mockRejectedValue(new Error('Permission denied'));
 await expect(fetchMetaAdsetAudienceBreakdownSeeds(input)).rejects.toThrow('Meta audience age_gender unavailable');
});

it('omits standalone placement and DMA requests at both entity levels while fetching other audience data', async () => {
 vi.mocked(fetchMetaCollection).mockClear().mockResolvedValue([]);
 const input = {accessToken:'test-only',adAccountExternalId:'act_1',dateRange:{since:'2026-10-29',until:'2026-10-29'}};
 await fetchMetaAdsetAudienceBreakdownSeeds(input);
 await fetchMetaAdAudienceBreakdownSeeds(input);
 const requests = vi.mocked(fetchMetaCollection).mock.calls.map(([request]) => request.params);
 expect(requests).toHaveLength(10);
 expect(requests.some(params => ['platform_position','dma'].includes(String(params?.breakdowns)))).toBe(false);
 for (const level of ['adset', 'ad']) {
  expect(requests).toContainEqual(expect.objectContaining({level,breakdowns:'publisher_platform'}));
  expect(requests).toContainEqual(expect.objectContaining({level,breakdowns:'age,gender'}));
 }
 vi.mocked(fetchMetaCollection).mockClear();
 await fetchMetaAdsetAudienceBreakdownSeeds({...input,allowedBreakdowns:['platform_position','dma']});
 await fetchMetaAdAudienceBreakdownSeeds({...input,allowedBreakdowns:['platform_position','dma']});
 expect(fetchMetaCollection).not.toHaveBeenCalled();
});
