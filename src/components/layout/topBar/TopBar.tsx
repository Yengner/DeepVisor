import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import TopBarClient from './TopBarClient';
import { cookies } from 'next/headers';
import { getLoggedInUser } from '@/lib/actions/user';
import { getNotifications } from '@/lib/actions/notifications/server/getNotifications';

export default async function Topbar() {
  const user = await getLoggedInUser();
  const userId = user?.id;
  if (!userId) return null;

  const supabase = await createSupabaseClient();

  const [{ data: platforms, error: platformError }, { data: adAccounts, error: adAccountError }] =
    await Promise.all([
      supabase
        .from('platform_integrations')
        .select('id, platform_name')
        .eq('user_id', userId),
      supabase
        .from('ad_accounts')
        .select('id, name, platform_integration_id, external_account_id')
        .eq('user_id', userId),
    ]);

  if (platformError) console.error('Error fetching platforms:', platformError.message);
  if (adAccountError) console.error('Error fetching ad accounts:', adAccountError.message);

  const notifications = await getNotifications(userId);

  const cookieStore = await cookies();
  const platformCookie = cookieStore.get('platform_integration_id')?.value ?? null;
  const accountCookie = cookieStore.get('ad_account_row_id')?.value ?? null;

  const safePlatforms = platforms ?? [];
  const safeAdAccounts = adAccounts ?? [];

  const selectedPlatformId =
    safePlatforms.find((p) => p.id === platformCookie)?.id ??
    safePlatforms[0]?.id ??
    null;

  const accountsForPlatform = selectedPlatformId
    ? safeAdAccounts.filter((acct) => acct.platform_integration_id === selectedPlatformId)
    : [];

  const selectedAccountId =
    accountsForPlatform.find((a) => a.id === accountCookie)?.id ??
    accountsForPlatform[0]?.id ??
    null;

  return (
    <div className="w-full h-full">
      <TopBarClient
        userInfo={user}
        platforms={safePlatforms}
        adAccounts={safeAdAccounts}
        notifications={notifications}
        initialPlatformId={selectedPlatformId}
        initialAccountId={selectedAccountId}
      />
    </div>
  );
}
