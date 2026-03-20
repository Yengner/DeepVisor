import DashboardClient from './components/DashboardClient';
import { createServerClient } from '@/lib/server/supabase/server';
import {
  getAdAccountTopCampaigns,
  getAdAccountData,
  getBusinessAdAccountsRollup,
  getPlatformDetails,
  hasMeaningfulMetrics,
} from '@/lib/server/data';
import {
  normalizeCampaignSnapshot,
  resolveDashboardState,
} from '@/lib/server/dashboard';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getCurrentSelection } from '@/lib/server/actions/app/selection';
import type {
  DashboardCampaignSnapshotItem,
  DashboardPayload,
} from './types';

export default async function MainDashboardPage() {
  const supabase = await createServerClient();
  const { user, businessId } = await getRequiredAppContext();
  const { selectedPlatformId, selectedAdAccountId } = await getCurrentSelection();

  const [businessRollup, businessProfileResult] = await Promise.all([
    getBusinessAdAccountsRollup(businessId),
    supabase
      .from('business_profiles')
      .select('business_name')
      .eq('id', businessId)
      .maybeSingle(),
  ]);

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

  const adAccountHasMetrics = adAccount
    ? hasMeaningfulMetrics(adAccount.aggregated_metrics)
    : false;

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

  const state = resolveDashboardState({
    selectedPlatformId,
    platformConnected,
    selectedAdAccountId,
    adAccountPresent: Boolean(adAccount),
    adAccountHasMetrics,
  });

  const payload: DashboardPayload = {
    state,
    business: {
      id: businessId,
      name: businessName,
    },
    selection: {
      selectedPlatformIntegrationId: selectedPlatformId,
      selectedAdAccountId,
    },
    platform,
    adAccount,
    businessRollup,
    trend: {
      defaultWindow: '30',
      points: adAccount?.time_increment_metrics['30'] ?? [],
    },
    campaignSnapshot,
  };

  return <DashboardClient payload={payload} />;
}
