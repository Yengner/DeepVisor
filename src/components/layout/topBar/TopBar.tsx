import { createServerClient } from '@/lib/server/supabase/server';
import TopBarClient from './TopBarClient';
import type { Database } from '@/lib/shared/types/supabase';
import { getCurrentSelection } from '@/lib/server/actions/app/selection';

type UserRow = Database['public']['Tables']['users']['Row'];

interface TopbarProps {
  user: UserRow;
  businessId: string;
}

export default async function Topbar({ user, businessId }: TopbarProps) {
  const supabase = await createServerClient();

  const { data: integrationRows, error: integrationError } = await supabase
    .from('platform_integrations')
    .select('id, platform_id, status, platforms ( key )')
    .eq('business_id', businessId)
    .eq('status', "connected");

  if (integrationError) {
    console.error('Error fetching platform integrations:', integrationError.message);
  }

  const platformMap = new Map<string, { integrationId: string; key: string }>();

  for (const row of integrationRows ?? []) {
    const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
    const key = typeof platform?.key === 'string' ? platform.key : null;
    if (!key) continue;

    platformMap.set(row.platform_id, {
      integrationId: row.id,
      key,
    });
  }

  const platforms = Array.from(platformMap.values()).map((entry) => ({
    id: entry.integrationId,
    platform_name: entry.key,
  }));

  let adAccounts: Array<{
    id: string;
    name: string | null;
    platform_integration_id: string;
    external_account_id: string | null;
  }> = [];

  if (platformMap.size > 0) {
    const platformIds = Array.from(platformMap.keys());

    const { data: adAccountRows, error: adAccountError } = await supabase
      .from('ad_accounts')
      .select('id, name, platform_id, external_account_id')
      .eq('business_id', businessId)
      .in('platform_id', platformIds);

    if (adAccountError) {
      console.error('Error fetching ad accounts:', adAccountError.message);
    }

    adAccounts = (adAccountRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      platform_integration_id: platformMap.get(row.platform_id)?.integrationId ?? row.platform_id,
      external_account_id: row.external_account_id,
    }));
  }

  const {
    selectedPlatformId: platformCookie,
    selectedAdAccountId: accountCookie,
  } = await getCurrentSelection();

  const selectedPlatformId =
    platforms.find((platform) => platform.id === platformCookie)?.id ??
    platforms[0]?.id ??
    null;

  const accountsForPlatform = selectedPlatformId
    ? adAccounts.filter((account) => account.platform_integration_id === selectedPlatformId)
    : [];

  const selectedAccountId =
    accountsForPlatform.find((account) => account.id === accountCookie)?.id ??
    accountsForPlatform[0]?.id ??
    null;

  return (
    <div className="w-full h-full">
      <TopBarClient
        userInfo={user}
        platforms={platforms}
        adAccounts={adAccounts}
        initialPlatformId={selectedPlatformId}
        initialAccountId={selectedAccountId}
      />
    </div>
  );
}
