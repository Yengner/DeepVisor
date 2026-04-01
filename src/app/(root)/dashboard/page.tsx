import DashboardClient from './components/DashboardClient';
import { createServerClient } from '@/lib/server/supabase/server';
import {
  getAdAccountTopCampaigns,
  getAdAccountData,
  getPlatformDetails,
} from '@/lib/server/data';
import {
  buildDashboardPayload,
  normalizeCampaignSnapshot,
} from '@/lib/server/dashboard';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import type { DashboardCampaignSnapshotItem } from './types';

export default async function MainDashboardPage() {
  const supabase = await createServerClient();
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
  if (adAccount?.id && platformConnected) {
    try {
      campaignSnapshot = normalizeCampaignSnapshot(
        await getAdAccountTopCampaigns(adAccount.id)
      );
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
  });

  return <DashboardClient payload={payload} />;
}
