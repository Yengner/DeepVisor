import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ scope: vi.fn(), prepare: vi.fn() }));
vi.mock('@/lib/server/insights/http', () => ({ insightsScope: m.scope, uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i }));
vi.mock('@/lib/server/insights/service', () => ({ FIRST_LOOK_WAITING: 'waiting', prepare: m.prepare, history: vi.fn(), savedPresentation: vi.fn() }));
import { POST } from './route';
const TOKEN = '11111111-1111-4111-8111-111111111111';
const request = () => new NextRequest('http://localhost/api/insights', { method: 'POST', headers: { origin: 'http://localhost' }, body: JSON.stringify({ token: TOKEN }) });
beforeEach(() => { vi.resetAllMocks(); m.scope.mockResolvedValue({ user: 'u', business: 'b', account: 'a' }); });

it('tells the popup to ask again shortly while the first look waits for account setup', async () => {
  m.prepare.mockResolvedValue('waiting');
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ presentation: null, retryInSeconds: 5 });
});
it('returns a prepared popup without a retry hint', async () => {
  m.prepare.mockResolvedValue({ id: 'p1', payload: {} });
  expect(await (await POST(request())).json()).toEqual({ presentation: { id: 'p1', payload: {} } });
});
it('returns no popup and no retry when there is nothing to show', async () => {
  m.prepare.mockResolvedValue(null);
  expect(await (await POST(request())).json()).toEqual({ presentation: null });
});
it('rejects a request from another origin before doing any work', async () => {
  const foreign = new NextRequest('http://localhost/api/insights', { method: 'POST', headers: { origin: 'https://evil.test' }, body: JSON.stringify({ token: TOKEN }) });
  expect((await POST(foreign)).status).toBe(403);
  expect(m.prepare).not.toHaveBeenCalled();
});
