import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('next/server', async original => ({ ...await original<typeof import('next/server')>(), after: vi.fn() }));
vi.mock('@/lib/server/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/server/sync/dispatch', () => ({ dispatchAccountSync: vi.fn() }));
vi.mock('@/lib/server/sync/meta/processBackfillJobs', () => ({ processMetaBackfillJobs: vi.fn() }));
vi.mock('@/lib/server/webhooks/meta', async original => ({ ...await original<typeof import('@/lib/server/webhooks/meta')>(), ingestMetaWebhook: vi.fn() }));
vi.mock('@/lib/server/sync/resources/coordinator', () => ({ requestAccountEvents: vi.fn() }));
vi.mock('@/lib/server/sync/automaticRefresh', () => ({ targetedSimulationAllowed: () => false }));
import { after } from 'next/server';
import { dispatchAccountSync } from '@/lib/server/sync/dispatch';
import { ingestMetaWebhook } from '@/lib/server/webhooks/meta';
import { GET, POST } from './route';

const url = 'http://localhost/api/meta/webhooks', secret = 'test-app-secret', token = 'verify-token-0123456789';
const delivery = JSON.stringify({ object: 'ad_account', entry: [{ id: '123', time: 1_700_000_000, changes: [{ field: 'effective_status', value: { object_id: '5', object_type: 'ad' } }] }] });
const post = (body: string, signature?: string) => POST(new NextRequest(url, { method: 'POST', body, headers: signature ? { 'x-hub-signature-256': signature } : {} }));
const sign = (body: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('DEEPVISOR_META_WEBHOOKS', 'true'); vi.stubEnv('META_APP_SECRET', secret); vi.stubEnv('META_WEBHOOK_VERIFY_TOKEN', token);
  vi.mocked(ingestMetaWebhook).mockResolvedValue({ received: 1, recorded: 1, duplicates: 0, jobs: [{ jobId: 'job', businessId: 'biz' }], waiting: [{ adAccountId: 'acct', businessId: 'biz' }], outcomes: [] });
});
afterEach(() => vi.unstubAllEnvs());

it('is not found while the flag is off, for both the handshake and deliveries', async () => {
  vi.stubEnv('DEEPVISOR_META_WEBHOOKS', '');
  expect((await GET(new NextRequest(`${url}?hub.mode=subscribe&hub.challenge=1&hub.verify_token=${token}`))).status).toBe(404);
  expect((await post(delivery, sign(delivery))).status).toBe(404);
  expect(ingestMetaWebhook).not.toHaveBeenCalled();
});
it('answers Meta’s handshake only with the right token', async () => {
  const ok = await GET(new NextRequest(`${url}?hub.mode=subscribe&hub.challenge=98765&hub.verify_token=${token}`));
  expect([ok.status, await ok.text()]).toEqual([200, '98765']);
  expect((await GET(new NextRequest(`${url}?hub.mode=subscribe&hub.challenge=1&hub.verify_token=nope`))).status).toBe(403);
  expect((await GET(new NextRequest(url))).status).toBe(403);
});
it('rejects unsigned, wrongly signed and tampered deliveries before anything is stored', async () => {
  expect((await post(delivery)).status).toBe(401);
  expect((await post(delivery, 'sha256=' + '0'.repeat(64))).status).toBe(401);
  expect((await post(delivery.replace('"5"', '"6"'), sign(delivery))).status).toBe(401);
  expect(ingestMetaWebhook).not.toHaveBeenCalled();
});
it('records a signed delivery, starts its job and waits for a busy account, without exposing details', async () => {
  const response = await post(delivery, sign(delivery));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ received: 1, recorded: 1, duplicates: 0 });
  expect(vi.mocked(ingestMetaWebhook).mock.calls[0][0]).toMatchObject([{ externalAccountId: '123', objectId: '5', level: 'ad', refresh: true }]);
  expect(dispatchAccountSync).toHaveBeenCalledWith('job', 'biz');
  expect(after).toHaveBeenCalledTimes(1);
});
it('acknowledges signed deliveries for other objects, rejects bad JSON and oversized bodies, and asks for a retry on failure', async () => {
  const page = JSON.stringify({ object: 'page', entry: [] });
  expect(await (await post(page, sign(page))).json()).toEqual({ received: 0 });
  expect((await post('{', sign('{'))).status).toBe(400);
  const big = 'x'.repeat(300 * 1024);
  expect((await post(big, sign(big))).status).toBe(413);
  expect(ingestMetaWebhook).not.toHaveBeenCalled();
  vi.mocked(ingestMetaWebhook).mockRejectedValueOnce(new Error('db down'));
  expect((await post(delivery, sign(delivery))).status).toBe(503);
});
