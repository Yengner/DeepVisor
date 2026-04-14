import DashboardClient from './components/DashboardClient';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createServerClient } from '@/lib/server/supabase/server';
import {
  getAdAccountTopCampaigns,
  getAdAccountData,
  getPlatformDetails,
} from '@/lib/server/data';
import { getReviveCampaignOpportunity } from '@/lib/server/campaigns/revive';
import { getAdAccountSyncCoverage } from '@/lib/server/repositories/ad_accounts/syncState';
import {
  buildDashboardPayload,
  normalizeCampaignSnapshot,
} from '@/lib/server/dashboard';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import type { DashboardCampaignSnapshotItem } from './types';

export default async function MainDashboardPage() {
  const supabase = await createServerClient();
  const adminSupabase = createAdminClient();
  const { user, businessId } = await getRequiredAppContext();
  const { selectedPlatformId, selectedAdAccountId } = await resolveCurrentSelection(businessId);

  const businessProfileResult = await supabase
    .from('business_profiles')
    .select('business_name')
    .eq('id', businessId)
    .maybeSingle();

  const businessName =
    businessProfileResult.data?.business_name ||
    `${user.first_name} ${user.last_name}`.trim() ||
    'My Business';

  const platform = selectedPlatformId
    ? await getPlatformDetails(selectedPlatformId, businessId)
    : null;

  const platformConnected = Boolean(platform && platform.status === 'connected');

  const adAccount =
    selectedPlatformId && selectedAdAccountId && platformConnected
      ? await getAdAccountData(selectedAdAccountId, selectedPlatformId, businessId)
      : null;

  let campaignSnapshot: DashboardCampaignSnapshotItem[] = [];
  let syncCoverage = null;
  let reviveOpportunity = null;
  if (adAccount?.id && platformConnected && selectedPlatformId) {
    try {
      const [campaigns, coverage, revive] = await Promise.all([
        getAdAccountTopCampaigns(adAccount.id),
        getAdAccountSyncCoverage(adminSupabase, adAccount.id),
        getReviveCampaignOpportunity(adminSupabase, {
          businessId,
          platformIntegrationId: selectedPlatformId,
          adAccountId: adAccount.id,
        }),
      ]);
      campaignSnapshot = normalizeCampaignSnapshot(campaigns);
      syncCoverage = coverage;
      reviveOpportunity = revive;
    } catch (error) {
      console.error('Failed to fetch dashboard campaign snapshot:', error);
    }
  }

  const payload = buildDashboardPayload({
    businessName,
    selectedPlatformIntegrationId: selectedPlatformId,
    selectedAdAccountId,
    platform,
    adAccount,
    campaignSnapshot,
    syncCoverage,
    reviveOpportunity,
  });

  return <DashboardClient payload={payload} />;
}
