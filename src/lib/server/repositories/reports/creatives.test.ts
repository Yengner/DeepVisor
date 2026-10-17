import { expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
vi.mock('server-only', () => ({}));
import { listReportCreatives, reportCreativePreview, type ReportCreative } from './creatives';
it('scopes creative reads to the authorized business/accounts and preserves media fallback ordering', async () => {
  const transport = vi.fn(async (url: RequestInfo | URL) => {
    const params = new URL(String(url)).searchParams;
    expect(params.get('business_id')).toBe('eq.business');
    expect(params.get('ad_account_id')).toBe('in.(account)');
    expect(params.get('platform_creative_id')).toBe('in.(creative)');
    return new Response(JSON.stringify([{ id: 'id', business_id: 'business', ad_account_id: 'account', platform_creative_id: 'creative',
      creative_type: 'video', raw: { deepvisor_video_poster: { uri: 'https://assets.example/large.jpg', width: 1080, height: 1920 } }, thumbnail_url: 'https://assets.example/thumb.jpg' }]));
  });
  const client = createClient<Database>('https://isolated.example.test', 'test', { auth: { persistSession: false }, global: { fetch: transport } });
  const rows = await listReportCreatives(client, { businessId: 'business', adAccountIds: ['account'], platformCreativeIds: ['creative', 'creative'] });
  const media = reportCreativePreview(rows[0]);
  expect(media?.image).toBe('https://assets.example/large.jpg');
  expect(media?.kind).toBe('video');
  expect(transport).toHaveBeenCalledTimes(1);
});
it('does not query unscoped media and treats media failure as unavailable', async () => {
  const transport = vi.fn(async () => new Response(JSON.stringify({ message: 'unavailable' }), { status: 503 }));
  const client = createClient<Database>('https://isolated.example.test', 'test', { auth: { persistSession: false }, global: { fetch: transport } });
  expect(await listReportCreatives(client, { businessId: 'business', adAccountIds: [], platformCreativeIds: ['creative'] })).toEqual([]);
  expect(transport).not.toHaveBeenCalled();
  expect(await listReportCreatives(client, { businessId: 'business', adAccountIds: ['account'], platformCreativeIds: ['creative'] })).toEqual([]);
  expect(reportCreativePreview(undefined)).toBeNull();
  expect(reportCreativePreview({ image_url: 'javascript:alert(1)' } as ReportCreative)?.image).toBeNull();
});
