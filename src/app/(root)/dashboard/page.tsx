import DashboardClient from './components/DashboardClient';
import { createServerClient } from '@/lib/server/supabase/server';
import {
  getAdAccountTopCampaigns,
  getAdAccountData,
  getBusinessAdAccountsRollup,
  getPlatformDetails,
  hasMeaningfulMetrics,
} from '@/lib/server/data';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getCurrentSelection } from '@/lib/server/actions/app/selection';
import type {
  DashboardCampaignSnapshotItem,
  DashboardPayload,
  DashboardState,
} from './types';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeCampaignSnapshot(value: unknown): DashboardCampaignSnapshotItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => {
      const campaign = row as Record<string, unknown>;
      const spend = asNumber(campaign.spend);
      const clicks = asNumber(campaign.clicks);
      const leads = asNumber(campaign.leads);
      const messages = asNumber(campaign.messages);
      const conversion = asNumber(campaign.conversion) || leads + messages;
      const conversionRate = asNumber(campaign.conversion_rate);
      const costPerResult = asNumber(campaign.cost_per_result);

      return {
        campaignId: asString(campaign.campaign_id) || asString(campaign.id),
        campaignName: asString(campaign.campaign_name) || asString(campaign.name) || 'Unnamed campaign',
        status: asString(campaign.status) || 'unknown',
        spend,
        clicks,
        leads,
        messages,
        conversion,
        conversionRate,
        costPerResult,
      };
    })
    .filter((campaign) => Boolean(campaign.campaignId))
    .slice(0, 5);
}

function resolveDashboardState(input: {
  selectedPlatformId: string | null;
  platformConnected: boolean;
  selectedAdAccountId: string | null;
  adAccountPresent: boolean;
  adAccountHasMetrics: boolean;
}): DashboardState {
  if (!input.selectedPlatformId) {
    return 'no_platform_selected';
  }

  if (!input.platformConnected) {
    return 'platform_not_found_or_not_connected';
  }

  if (!input.selectedAdAccountId || !input.adAccountPresent) {
    return 'no_ad_account_selected';
  }

  if (!input.adAccountHasMetrics) {
    return 'ad_account_selected_no_metrics';
  }

  return 'ready';
}

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
  if (adAccount?.ad_account_id && platformConnected) {
    try {
      campaignSnapshot = normalizeCampaignSnapshot(
        await getAdAccountTopCampaigns(adAccount.ad_account_id)
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
