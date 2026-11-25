import { describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() => vi.fn((href: string) => { throw new Error(`redirect:${href}`); }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('@/components/campaigns/create/CampaignCreateClient', () => ({ default: () => null }));
vi.mock('@/lib/server/actions/app/context', () => ({ getRequiredAppContext: async () => ({ businessId: 'business' }) }));
vi.mock('@/lib/server/actions/app/selection', () => ({ resolveCurrentSelection: async () => ({ selectedAdAccountId: null }) }));
vi.mock('@/lib/server/suggestions/drafts', () => ({ countDrafts: async () => 0 }));
vi.mock('@/lib/server/supabase/server', () => ({ createServerClient: async () => ({}) }));

import CreateCampaignPage from './page';

const open = (params: Record<string, string>) => CreateCampaignPage({ searchParams: Promise.resolve(params) });

describe('create page while ad and ad set creation is hidden', () => {
  it.each(['ad', 'adset'])('sends a typed or saved scope=%s link back to Campaigns', async scope => {
    await expect(open({ scope, campaign_id: '1' })).rejects.toThrow('redirect:/campaigns');
  });

  it('still opens a new campaign and a saved draft', async () => {
    redirect.mockClear();
    await expect(open({})).resolves.toBeTruthy();
    await expect(open({ draft: 'draft-id' })).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
