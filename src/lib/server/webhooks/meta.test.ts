import { createHmac } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/server/sync/resources/coordinator', () => ({ requestAccountEvents: vi.fn() }));
vi.mock('@/lib/server/sync/automaticRefresh', () => ({ targetedSimulationAllowed: () => false }));
import { createAdminClient } from '@/lib/server/supabase/admin';
import { requestAccountEvents } from '@/lib/server/sync/resources/coordinator';
import { parseMetaWebhook } from '@/lib/shared/webhooks/meta';
import { ingestMetaWebhook, verifyChallenge, verifySignature } from './meta';

const secret = 'app-secret', body = JSON.stringify({ object: 'ad_account', entry: [] });
const sign = (raw: string, key = secret) => `sha256=${createHmac('sha256', key).update(raw).digest('hex')}`;

it('accepts only an exact HMAC of the raw body', () => {
  expect(verifySignature(body, sign(body), secret)).toBe(true);
  expect(verifySignature(body + ' ', sign(body), secret)).toBe(false);
  expect(verifySignature(body, sign(body, 'other'), secret)).toBe(false);
  expect(verifySignature(body, null, secret)).toBe(false);
  expect(verifySignature(body, 'sha1=abc', secret)).toBe(false);
  expect(verifySignature(body, sign(body), undefined)).toBe(false);
  expect(verifySignature(body, sign(body).toUpperCase().replace('SHA256', 'sha256'), secret)).toBe(true);
});
it('echoes the challenge only for the configured verify token', () => {
  const token = 'a-long-verify-token-123';
  const params = (extra: Record<string, string>) => new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.challenge': '4242', 'hub.verify_token': token, ...extra });
  expect(verifyChallenge(params({}), token)).toBe('4242');
  expect(verifyChallenge(params({ 'hub.verify_token': 'wrong-token-wrong-token' }), token)).toBeNull();
  expect(verifyChallenge(params({ 'hub.mode': 'unsubscribe' }), token)).toBeNull();
  expect(verifyChallenge(params({}), undefined)).toBeNull();
  expect(verifyChallenge(params({ 'hub.verify_token': 'short' }), 'short')).toBeNull();
});

type Account = { id: string; business_id: string; platform_id: string; external_account_id: string };
let recorded: Set<string>, accounts: Account[], integrations: Record<string, string | null>, deleted: string[], rpcError: boolean;
beforeEach(() => {
  recorded = new Set(); accounts = []; integrations = {}; deleted = []; rpcError = false; vi.clearAllMocks();
  const client = {
    rpc: vi.fn(async (_name: string, args: { p_key: string }) => {
      if (rpcError) return { data: null, error: new Error('down') };
      if (recorded.has(args.p_key)) return { data: null, error: null };
      recorded.add(args.p_key); return { data: `event-${recorded.size}`, error: null };
    }),
    from: (table: string) => {
      let business = '';
      const q: Record<string, unknown> = {};
      const chain = () => q;
      Object.assign(q, {
        select: chain, limit: (n: number) => table === 'ad_accounts' ? Promise.resolve({ data: accounts, error: null }) : (void n, q),
        in: (column: string, values: string[]) => { if (table === 'meta_webhook_events' && q.mode === 'delete') { deleted.push(...values); return Promise.resolve({ error: null }); } if (table === 'meta_webhook_events') return Promise.resolve({ error: null }); return (void column, q); },
        eq: (column: string, value: string) => { if (column === 'business_id') business = value; return q; },
        is: chain, update: chain, delete: () => { q.mode = 'delete'; return q; },
        maybeSingle: () => Promise.resolve({ data: integrations[business] ? { id: integrations[business] } : null, error: null }),
      });
      return q;
    },
  };
  vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
  vi.mocked(requestAccountEvents).mockResolvedValue({ status: 'queued', reason: 'enqueued', jobId: 'job-1' });
});
const events = (objects: string[], field = 'effective_status') => parseMetaWebhook({ object: 'ad_account', entry: [{ id: '123', time: 1_700_000_000, changes: objects.map(id => ({ field, value: { object_id: id, object_type: 'ad' } })) }] })!;

it('queues one events read per business that has the account selected, with the affected objects', async () => {
  accounts = [{ id: 'a1', business_id: 'b1', platform_id: 'p', external_account_id: 'act_123' }, { id: 'a2', business_id: 'b2', platform_id: 'p', external_account_id: '123' }, { id: 'a3', business_id: 'b3', platform_id: 'p', external_account_id: '123' }];
  integrations = { b1: 'i1', b2: 'i2', b3: null };
  const result = await ingestMetaWebhook(events(['7', '8']));
  expect(result).toMatchObject({ received: 2, recorded: 2, duplicates: 0 });
  expect(vi.mocked(requestAccountEvents).mock.calls.map(c => [c[0].businessId, c[0].adAccountId, c[0].integrationId, c[0].allowSimulation])).toEqual([['b1', 'a1', 'i1', false], ['b2', 'a2', 'i2', false]]);
  expect(vi.mocked(requestAccountEvents).mock.calls[0][1]).toEqual([{ id: '7', level: 'ad' }, { id: '8', level: 'ad' }]);
  expect(result.jobs).toHaveLength(2);
});
it('ignores a retried delivery and deliveries for accounts nobody has selected', async () => {
  accounts = [{ id: 'a1', business_id: 'b1', platform_id: 'p', external_account_id: '123' }]; integrations = { b1: 'i1' };
  await ingestMetaWebhook(events(['7']));
  const retry = await ingestMetaWebhook(events(['7']));
  expect(retry).toMatchObject({ recorded: 0, duplicates: 1, jobs: [] });
  expect(requestAccountEvents).toHaveBeenCalledTimes(1);
  accounts = [];
  expect((await ingestMetaWebhook(events(['9']))).outcomes).toEqual([{ externalAccountId: '123', reason: 'no_selected_account' }]);
});
it('stores non-refresh fields without asking the queue for anything', async () => {
  const result = await ingestMetaWebhook(events(['7'], 'ad_recommendations'));
  expect(result.outcomes).toEqual([{ externalAccountId: '123', reason: 'stored_only' }]);
  expect(requestAccountEvents).not.toHaveBeenCalled();
});
it('reports demand waiting behind other work, and removes its record when the queue request fails so Meta’s retry is processed', async () => {
  accounts = [{ id: 'a1', business_id: 'b1', platform_id: 'p', external_account_id: '123' }]; integrations = { b1: 'i1' };
  vi.mocked(requestAccountEvents).mockResolvedValueOnce({ status: 'skipped', reason: 'pending_followup' });
  expect((await ingestMetaWebhook(events(['1']))).waiting).toEqual([{ adAccountId: 'a1', businessId: 'b1' }]);
  vi.mocked(requestAccountEvents).mockRejectedValueOnce(new Error('queue down'));
  await expect(ingestMetaWebhook(events(['2']))).rejects.toThrow('queue down');
  expect(deleted).toEqual(['event-2']);
});
