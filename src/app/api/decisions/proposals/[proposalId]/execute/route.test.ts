import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { executeMetaProposal } from '@/lib/server/advertising/executeMetaProposal';
import { POST } from './route';

vi.mock('@/lib/server/actions/app/context', () => ({ getRequiredAppContext: vi.fn() }));
vi.mock('@/lib/server/advertising/executeMetaProposal', () => ({ executeMetaProposal: vi.fn() }));
vi.mock('@/lib/server/supabase/admin', () => ({ createAdminClient: () => ({}) }));
const id = '00000000-0000-4000-8000-000000000001';
const params = { params: Promise.resolve({ proposalId: id }) };
function request(origin = 'https://deepvisor.test') {
  return new NextRequest(`https://deepvisor.test/api/decisions/proposals/${id}/execute`, {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId: 'forged-business', accessToken: 'forged-token' }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getRequiredAppContext).mockResolvedValue({ businessId: 'session-business', role: 'owner' } as Awaited<ReturnType<typeof getRequiredAppContext>>);
  vi.mocked(executeMetaProposal).mockResolvedValue({ executionId: id });
});
describe('explicit review execution endpoint', () => {
  it('rejects cross-site requests before authentication or execution', async () => {
    expect((await POST(request('https://other.test'), params)).status).toBe(403);
    expect(getRequiredAppContext).not.toHaveBeenCalled(); expect(executeMetaProposal).not.toHaveBeenCalled();
  });
  it('rejects invalid proposal IDs', async () => {
    expect((await POST(request(), { params: Promise.resolve({ proposalId: 'invalid' }) })).status).toBe(400);
    expect(executeMetaProposal).not.toHaveBeenCalled();
  });
  it('denies members', async () => {
    vi.mocked(getRequiredAppContext).mockResolvedValue({ businessId: 'session-business', role: 'member' } as Awaited<ReturnType<typeof getRequiredAppContext>>);
    expect((await POST(request(), params)).status).toBe(403); expect(executeMetaProposal).not.toHaveBeenCalled();
  });
  it('uses the session business and ignores client-supplied scope and tokens', async () => {
    expect((await POST(request(), params)).status).toBe(200);
    expect(executeMetaProposal).toHaveBeenCalledWith({}, { businessId: 'session-business', proposalId: id, role: 'owner' });
  });
  it('never exposes provider or credential errors to the client', async () => {
    vi.mocked(executeMetaProposal).mockRejectedValue(new Error('secret-token'));
    const response = await POST(request(), params);
    expect(response.status).toBe(409); expect(await response.text()).not.toContain('secret-token');
  });
});
