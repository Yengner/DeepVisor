import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./client', () => ({fetchMetaCollection: vi.fn(),fetchMetaObject:vi.fn(),getBackfillDateRange:vi.fn()}));
import { fetchMetaCollection, fetchMetaObject } from './client';
import { fetchMetaAdsetSeeds, fetchMetaAdCreativeSeeds, fetchMetaAdsetPerformanceSeeds, fetchMetaAdsetAudienceBreakdownSeeds, fetchMetaAdAudienceBreakdownSeeds } from './fetch';
it('requests large thumbnails for individual creatives and collection fallback', async () => {
  vi.mocked(fetchMetaObject).mockResolvedValue({ '1': { id: '1', video_id: '2', thumbnail_url: 'https://media.test/large' } });
  const rows = await fetchMetaAdCreativeSeeds({accessToken: 'private', adAccountExternalId: 'act_a', creativeExternalIds: ['1']});
  expect(fetchMetaObject).toHaveBeenCalledWith(expect.objectContaining({path:'', params: expect.objectContaining({ids:'1',thumbnail_width:800,thumbnail_height:800})}));
  expect(rows[0]).toMatchObject({videoId:'2', thumbnailUrl:'https://media.test/large'});
  vi.mocked(fetchMetaCollection).mockResolvedValue([]);
  await fetchMetaAdCreativeSeeds({accessToken: 'private', adAccountExternalId: 'act_a'});
  expect(fetchMetaCollection).toHaveBeenLastCalledWith(expect.objectContaining({path:'act_a/adcreatives',params:expect.objectContaining({thumbnail_width:800,thumbnail_height:800})}));
});
it('reads creatives 50 per request instead of one request each', async () => {
  vi.mocked(fetchMetaObject).mockReset().mockImplementation(async (input) => Object.fromEntries(String(input.params?.ids).split(',').map(id => [id, { id, image_url: `https://media.test/${id}` }])));
  const ids = Array.from({ length: 120 }, (_, i) => String(i + 1));
  const rows = await fetchMetaAdCreativeSeeds({accessToken: 'private', adAccountExternalId: 'act_a', creativeExternalIds: [...ids, '1']});
  expect(fetchMetaObject).toHaveBeenCalledTimes(3);
  expect(vi.mocked(fetchMetaObject).mock.calls.map(([input]) => String(input.params?.ids).split(',').length)).toEqual([50, 50, 20]);
  expect(rows).toHaveLength(120);
});
it('falls back to single reads for a batch Meta rejects, skipping only the inaccessible creative', async () => {
  vi.mocked(fetchMetaObject).mockReset().mockImplementation(async (input) => {
    if (input.path === '') throw new Error('Unsupported get request: object 2 does not exist');
    if (input.path === '2') throw new Error('Unsupported get request');
    return { id: input.path, image_url: `https://media.test/${input.path}` };
  });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const rows = await fetchMetaAdCreativeSeeds({accessToken: 'private', adAccountExternalId: 'act_a', creativeExternalIds: ['1', '2', '3']});
  expect(rows.map(row => row.externalId)).toEqual(['1', '3']);
  warn.mockRestore();
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
it('requests every audience breakdown together and keeps their result order', async () => {
  let inFlight = 0, peak = 0;
  vi.mocked(fetchMetaCollection).mockReset().mockImplementation(async (input) => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, 5));
    inFlight--;
    const breakdown = String(input.params?.breakdowns);
    return [{ adset_id: 's1', date_start: '2026-11-01', date_stop: '2026-11-07', spend: '1', impressions: '10', reach: '8', clicks: '1', inline_link_clicks: '1', [breakdown.split(',')[0]]: 'x', gender: 'female' }];
  });
  const rows = await fetchMetaAdsetAudienceBreakdownSeeds({ accessToken: 'private', adAccountExternalId: 'act_a' });
  expect(peak).toBe(5);
  expect(rows.map(row => row.breakdownType)).toEqual(['publisher_platform', 'age_gender', 'country', 'region', 'impression_device']);
});
it('lists ad sets with their learning status in the same request', async () => {
  vi.mocked(fetchMetaCollection).mockReset().mockResolvedValue([]);
  await fetchMetaAdsetSeeds({ accessToken: 'private', adAccountExternalId: 'act_a' });
  expect(String(vi.mocked(fetchMetaCollection).mock.calls[0][0].params?.fields)).toContain('learning_stage_info');
});
