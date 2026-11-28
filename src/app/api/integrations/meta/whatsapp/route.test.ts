import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ context: vi.fn(), load: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/server/actions/app/context', () => ({ getRequiredAppContext: m.context }));
vi.mock('@/lib/server/whatsapp/service', () => ({ loadWhatsAppSetup: m.load, saveWhatsAppNumber: m.save }));
import { GET, POST } from './route';

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/integrations/meta/whatsapp', { method: 'POST', body: JSON.stringify(body) }));
beforeEach(() => {
  vi.resetAllMocks();
  m.context.mockResolvedValue({ businessId: 'business-a', role: 'owner' });
  m.load.mockResolvedValue({ candidates: [] });
});

it('checks and saves only the signed-in business, during onboarding too', async () => {
  expect((await GET()).status).toBe(200);
  expect(m.load).toHaveBeenCalledWith('business-a', 'owner');
  expect((await post({ number: '+1 (813) 555-1234', businessId: 'foreign' })).status).toBe(200);
  expect(m.save).toHaveBeenCalledWith('business-a', '+18135551234');
  expect(m.context).toHaveBeenCalledWith(false);
});

it('accepts null as "don’t use WhatsApp"', async () => {
  expect((await post({ number: null })).status).toBe(200);
  expect(m.save).toHaveBeenCalledWith('business-a', null);
});

it.each([{}, { number: 'abc' }, { number: '' }, { number: 5 }])('rejects %o without writing', async body => {
  expect((await post(body)).status).toBe(400);
  expect(m.save).not.toHaveBeenCalled();
});

it('refuses a member without reading Meta or writing', async () => {
  m.context.mockResolvedValue({ businessId: 'business-a', role: 'member' });
  expect((await GET()).status).toBe(403);
  expect((await post({ number: '+18135551234' })).status).toBe(403);
  expect(m.load).not.toHaveBeenCalled();
  expect(m.save).not.toHaveBeenCalled();
});

it('does not report a failed save as saved', async () => {
  m.save.mockRejectedValue(new Error('database down'));
  expect((await post({ number: '+18135551234' })).status).toBe(500);
});
