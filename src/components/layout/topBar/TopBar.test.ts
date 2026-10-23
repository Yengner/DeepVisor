import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./TopBarClient', () => ({ default: () => null }));
const capture = vi.hoisted(() => vi.fn(() => null));
vi.mock('../MobileAppChromeClient', () => ({ default: capture }));
vi.mock('@/lib/server/actions/user/settings', () => ({
  getUserNotifications: async () => [], getUnreadUserNotificationIds: async () => [],
}));
const resolve = vi.hoisted(() => vi.fn(async () => ({ selectedPlatformId: 'integration', selectedAdAccountId: 'second' })));
vi.mock('@/lib/server/actions/app/selection', () => ({ resolveCurrentSelection: resolve }));
vi.mock('@/lib/server/supabase/server', () => ({ createServerClient: async () => ({
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, in: () => query,
      then: (done: (value: unknown) => unknown) => Promise.resolve({ error: null, data:
        table === 'platform_integrations'
          ? [{ id: 'integration', platform_id: 'meta', platforms: { key: 'meta' }, integration_details: { primary_ad_account_external_id: 'act_2' } }]
          : [{ id: 'first', platform_id: 'meta', external_account_id: 'act_1' }, { id: 'second', platform_id: 'meta', external_account_id: 'act_2' }],
      }).then(done),
    };
    return query;
  },
}) }));
import TopBar from './TopBar';

it('uses the same authorized primary-account scope as the page when cookies are absent or stale', async () => {
  const element = await TopBar({ businessId: 'business', user: { id: 'user' } as Parameters<typeof TopBar>[0]['user'] });
  renderToStaticMarkup(element);
  expect(resolve).toHaveBeenCalledWith('business');
  expect(capture).toHaveBeenCalledWith(expect.objectContaining({
    initialPlatformId: 'integration', initialAccountId: 'second',
    adAccounts: [expect.objectContaining({ id: 'second' })],
  }), undefined);
});
