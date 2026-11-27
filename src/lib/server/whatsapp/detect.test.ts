import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { detectWhatsAppNumbers, type DetectDeps } from './detect';

const adSets = [{ effective_status: 'ACTIVE', promoted_object: { whatsapp_phone_number: '18135550001' } }];

function meta(routes: Record<string, unknown>, account: unknown = { business: { id: 'portfolio-1' } }) {
  const paths: string[] = [];
  const read = (path: string, value: unknown) => {
    paths.push(path);
    if (value === undefined || value instanceof Error) throw value ?? new Error(`unexpected ${path}`);
    return value;
  };
  const deps = {
    fetchCollection: async ({ path }: { path: string }) => read(path, routes[path]),
    fetchObject: async ({ path }: { path: string }) => read(path, account),
  } as unknown as DetectDeps;
  return { deps, paths };
}

const input = (saved: unknown[] = []) => ({ accessToken: 'token', adAccountExternalId: '42', loadSavedAdSets: async () => saved });

describe('detectWhatsAppNumbers', () => {
  it('reads only the selected account and the portfolio that owns it', async () => {
    const { deps, paths } = meta({
      'act_42/adsets': adSets,
      'portfolio-1/owned_whatsapp_business_accounts': [{ id: 'waba-1' }],
      'waba-1/phone_numbers': [{ display_phone_number: '+1 813-555-0002', verified_name: 'Desk', is_on_biz_app: true }],
    });
    const result = await detectWhatsAppNumbers(input(), deps);
    expect(result.adsCheck).toBe('live');
    expect(result.candidates.map(c => [c.number, c.adSets, c.inPortfolio])).toEqual([['+18135550001', 1, false], ['+18135550002', 0, true]]);
    // Never every portfolio this login can see, or numbers from other businesses would be offered.
    expect(paths.some(path => path.startsWith('me/') || path.includes('client_whatsapp'))).toBe(false);
  });

  it('keeps ad numbers when the portfolio cannot be read, and skips unusually large portfolios', async () => {
    const denied = meta({ 'act_42/adsets': adSets, 'portfolio-1/owned_whatsapp_business_accounts': new Error('denied') });
    expect((await detectWhatsAppNumbers(input(), denied.deps)).candidates).toHaveLength(1);
    const large = meta({
      'act_42/adsets': adSets,
      'portfolio-1/owned_whatsapp_business_accounts': Array.from({ length: 11 }, (_, i) => ({ id: `waba-${i}` })),
    });
    expect((await detectWhatsAppNumbers(input(), large.deps)).candidates).toHaveLength(1);
    expect(large.paths.some(path => path.endsWith('/phone_numbers'))).toBe(false);
  });

  it('falls back to the last sync, and reports unavailable rather than "no number"', async () => {
    const down = () => meta({ 'act_42/adsets': new Error('rate limited') }, {}).deps;
    expect(await detectWhatsAppNumbers(input(adSets), down())).toMatchObject({ adsCheck: 'saved', candidates: [{ number: '+18135550001' }] });
    expect(await detectWhatsAppNumbers(input(), down())).toEqual({ adsCheck: 'unavailable', candidates: [] });
  });

  it('reports a successful read with no numbers as checked', async () => {
    expect(await detectWhatsAppNumbers(input(), meta({ 'act_42/adsets': [] }, {}).deps)).toEqual({ adsCheck: 'live', candidates: [] });
  });
});
