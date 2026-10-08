import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
vi.mock('next/server', async original => ({ ...await original<object>(), after: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/server/actions/app/context', () => ({ getRequiredAppContext: vi.fn() }));
vi.mock('@/lib/server/actions/app/selection', () => ({ resolveCurrentSelection: vi.fn() }));
vi.mock('@/lib/server/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/server/sync/meta/processBackfillJobs', () => ({ processMetaBackfillJobs: vi.fn() }));
vi.mock('@/lib/server/sync/manualRefresh', () => ({ runManualBusinessSync: vi.fn() }));
vi.mock('@/lib/server/sync/manualRefreshStatus', () => ({ performanceFingerprint: vi.fn() }));
import { after } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { runManualBusinessSync } from '@/lib/server/sync/manualRefresh';
import { performanceFingerprint } from '@/lib/server/sync/manualRefreshStatus';
import { GET, POST } from './route';
const jobId = '11111111-1111-4111-8111-111111111111';
const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, method] of Object.entries(query)) if (key !== 'maybeSingle') method.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  vi.mocked(createAdminClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof createAdminClient>);
  vi.mocked(getRequiredAppContext).mockResolvedValue({ businessId: 'business' } as Awaited<ReturnType<typeof getRequiredAppContext>>);
  vi.mocked(resolveCurrentSelection).mockResolvedValue({ selectedPlatformId: 'integration', selectedAdAccountId: 'account' });
  vi.mocked(runManualBusinessSync).mockResolvedValue({ allowed: true, refreshedCount: 1, failedCount: 0, jobs: [{ jobId, status: 'queued' }] } as Awaited<ReturnType<typeof runManualBusinessSync>>);
});
it('queues only the authorized selected account and does not claim premature completion', async () => {
  const response = await POST();
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ jobId, status: 'queued' });
  expect(runManualBusinessSync).toHaveBeenCalledWith({ businessId: 'business', platformKey: 'meta', integrationId: 'integration', adAccountId: 'account' });
  expect(after).toHaveBeenCalledOnce();
  expect(revalidatePath).not.toHaveBeenCalled();
});
it('reuses existing account work without starting a second job', async () => {
  query.maybeSingle.mockResolvedValue({ data: { id: jobId, status: 'running' } });
  expect((await POST()).status).toBe(202);
  expect(runManualBusinessSync).not.toHaveBeenCalled();
  expect(after).not.toHaveBeenCalled();
});
it('preserves cooldown retry details', async () => {
  vi.mocked(runManualBusinessSync).mockResolvedValue({ allowed: false, retryAfterMs: 30000, nextAllowedAt: 'later', message: 'cooldown' });
  const response = await POST();
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('30');
});
it('fails closed on authentication and persistence errors', async () => {
  vi.mocked(getRequiredAppContext).mockRejectedValueOnce(new Error('secret'));
  expect(JSON.stringify(await (await POST()).json())).not.toContain('secret');
  query.maybeSingle.mockResolvedValue({ data: null, error: new Error('db') });
  expect((await POST()).status).toBe(500);
  expect(after).not.toHaveBeenCalled();
});
it.each([true, false])('confirms persisted completion and invalidates cached account data (unchanged=%s)', async unchanged => {
  query.maybeSingle.mockResolvedValue({ data: { id: jobId, status: 'completed', ad_account_id: 'account', requested_start_date: '2026-09-09', requested_end_date: '2026-10-08', finished_at: '2026-10-08T12:00:00Z', metadata: { last_processed_ids: { performanceFingerprint: 'before' } } } });
  vi.mocked(performanceFingerprint).mockResolvedValue(unchanged ? 'before' : 'after');
  const response = await GET(new NextRequest(`https://local.test/api/sync/refresh?jobId=${jobId}`));
  expect(await response.json()).toMatchObject({ status: 'completed', unchanged });
  expect(query.eq).toHaveBeenCalledWith('business_id', 'business');
  expect(query.eq).toHaveBeenCalledWith('ad_account_id', 'account');
  expect(query.eq).toHaveBeenCalledWith('platform_integration_id', 'integration');
  expect(revalidateTag).toHaveBeenCalledWith('dashboard-context:business', { expire: 0 });
});
it('does not claim completion for failed jobs or disclose platform errors', async () => {
  query.maybeSingle.mockResolvedValue({ data: { status: 'failed', error_message: 'secret' } });
  const response = await GET(new NextRequest(`https://local.test/api/sync/refresh?jobId=${jobId}`));
  expect(await response.json()).toMatchObject({ status: 'failed', unchanged: null });
  expect(revalidatePath).not.toHaveBeenCalled();
});
