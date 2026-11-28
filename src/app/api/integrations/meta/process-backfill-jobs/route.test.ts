import { after, NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processMetaBackfillJobs } from '@/lib/server/sync/meta/processBackfillJobs';
import { drainShadowJobs } from '@/lib/server/decisions/shadow/service';
import { processActionOutcomes } from '@/lib/server/decisions/outcomes/service';
import { checkMetaConnectionsDue } from '@/lib/server/integrations/connectionHealth';
import { POST } from './route';

vi.mock('next/server', async (original) => ({ ...await original<typeof import('next/server')>(), after: vi.fn() }));
vi.mock('@/lib/server/sync/meta/processBackfillJobs', () => ({ processMetaBackfillJobs: vi.fn() }));
vi.mock('@/lib/server/decisions/shadow/service', () => ({ drainShadowJobs: vi.fn() }));
vi.mock('@/lib/server/decisions/outcomes/service', () => ({ processActionOutcomes: vi.fn() }));
vi.mock('@/lib/server/integrations/connectionHealth', () => ({ checkMetaConnectionsDue: vi.fn() }));
const result = { processedCount: 0, completedCount: 0, failedCount: 0, results: [] };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('INTERNAL_API_KEY', 'test-internal-key');
  vi.mocked(processMetaBackfillJobs).mockResolvedValue(result);
});
afterEach(() => vi.unstubAllEnvs());
describe('scheduled worker shadow integration', () => {
  it('returns sync results without awaiting inference, including idle ticks', async () => {
    const request = new NextRequest('https://deepvisor.test/api/integrations/meta/process-backfill-jobs', { method: 'POST', headers: { 'x-internal-api-key': 'test-internal-key' }, body: '{}' });
    const response = await POST(request);
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ success: true, ...result });
    expect(after).toHaveBeenCalledWith(drainShadowJobs); expect(drainShadowJobs).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledWith(processActionOutcomes); expect(processActionOutcomes).not.toHaveBeenCalled();
  });
  it('schedules the daily Meta login check after the response, without failing the tick', async () => {
    vi.mocked(checkMetaConnectionsDue).mockRejectedValue(new Error('Meta down'));
    const request = new NextRequest('https://deepvisor.test/api/integrations/meta/process-backfill-jobs', { method: 'POST', headers: { 'x-internal-api-key': 'test-internal-key' }, body: '{}' });
    expect((await POST(request)).status).toBe(200);
    expect(checkMetaConnectionsDue).not.toHaveBeenCalled();
    const scheduled = vi.mocked(after).mock.calls.map(([task]) => task).filter((task) => task !== drainShadowJobs && task !== processActionOutcomes);
    expect(scheduled).toHaveLength(1);
    await expect((scheduled[0] as () => Promise<unknown>)()).resolves.toBeUndefined();
    expect(checkMetaConnectionsDue).toHaveBeenCalledTimes(1);
  });
  it('does not register shadow work for unauthorized requests', async () => {
    const response = await POST(new NextRequest('https://deepvisor.test/api/integrations/meta/process-backfill-jobs', { method: 'POST' }));
    expect(response.status).toBe(401); expect(after).not.toHaveBeenCalled(); expect(processMetaBackfillJobs).not.toHaveBeenCalled();
  });
});
