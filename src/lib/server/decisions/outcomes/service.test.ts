import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminClient } from '../../supabase/admin';
import { processActionOutcomes } from './service';

vi.mock('server-only', () => ({}));
vi.mock('../../supabase/admin', () => ({ createAdminClient: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
describe('outcome worker isolation', () => {
  it.each([false,true])('bounds database work and handles RPC error=%s without failing sync', async (failed) => {
    const abortSignal = vi.fn().mockResolvedValue({data:{seeded:4,processed:4},error:failed ? {message:'private database details'} : null});
    const rpc = vi.fn().mockReturnValue({abortSignal});
    const schema = vi.fn().mockReturnValue({rpc});
    vi.mocked(createAdminClient).mockReturnValue({schema} as unknown as ReturnType<typeof createAdminClient>);
    const info = vi.spyOn(console,'info').mockImplementation(()=>{});
    const error = vi.spyOn(console,'error').mockImplementation(()=>{});
    await expect(processActionOutcomes()).resolves.toBeUndefined();
    expect(schema).toHaveBeenCalledWith('ai');
    expect(rpc).toHaveBeenCalledWith('process_action_outcomes',{p_limit:100});
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(failed ? error : info).toHaveBeenCalledOnce();
    expect(JSON.stringify(error.mock.calls)).not.toContain('private database details');
  });
  it('isolates network and client configuration failures', async () => {
    vi.mocked(createAdminClient).mockImplementation(()=>{throw new Error('offline');});
    vi.spyOn(console,'error').mockImplementation(()=>{});
    await expect(processActionOutcomes()).resolves.toBeUndefined();
  });
});
