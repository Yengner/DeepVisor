import DashboardClient from './components/DashboardClient';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createServerClient } from '@/lib/server/supabase/server';
import {
  getAdAccountTopCampaigns,
  getAdAccountData,
  getPlatformDetails,
} from '@/lib/server/data';
import { getAdAccountSyncCoverage } from '@/lib/server/repositories/ad_accounts/syncState';
import {
  buildDashboardPayload,
  normalizeCampaignSnapshot,
} from '@/lib/server/dashboard';
import { buildReportPayload } from '@/lib/server/repositories/reports/buildReportPayload';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import {
  getMetaAccountIntelligenceReadModel,
  type AdAccountSignalView,
} from '@/lib/server/intelligence';
import { getTrailingUtcDateRange } from '@/lib/shared';
import type { CalendarQueuePreviewItem } from '@/lib/shared';
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
  let intelligenceSignals: AdAccountSignalView[] = [];
  let calendarQueuePreview: CalendarQueuePreviewItem[] = [];
  let reportByWindow: Partial<Record<'7d' | '30d', Awaited<ReturnType<typeof buildReportPayload>>>> = {};
  if (adAccount?.id && platformConnected && selectedPlatformId) {
    try {
      const last7Days = getTrailingUtcDateRange(7);
      const last30Days = getTrailingUtcDateRange(30);
      const [campaigns, coverage, intelligence] = await Promise.all([
        getAdAccountTopCampaigns(adAccount.id),
        getAdAccountSyncCoverage(adminSupabase, adAccount.id),
        getMetaAccountIntelligenceReadModel(adminSupabase, {
          businessId,
          adAccountId: adAccount.id,
        }),
      ]);
      const [report7d, report30d] = await Promise.all([
        buildReportPayload({
          businessId,
          scope: 'ad_account',
          platformIntegrationId: selectedPlatformId,
          adAccountIds: [adAccount.id],
          campaignIds: [],
          adsetIds: [],
          adIds: [],
          dateFrom: last7Days.dateFrom,
          dateTo: last7Days.dateTo,
          groupBy: 'day',
          compareMode: 'previous_period',
        }),
        buildReportPayload({
          businessId,
          scope: 'ad_account',
          platformIntegrationId: selectedPlatformId,
          adAccountIds: [adAccount.id],
          campaignIds: [],
          adsetIds: [],
          adIds: [],
          dateFrom: last30Days.dateFrom,
          dateTo: last30Days.dateTo,
          groupBy: 'week',
          compareMode: 'previous_period',
        }),
      ]);
      campaignSnapshot = normalizeCampaignSnapshot(campaigns);
      syncCoverage = coverage;
      intelligenceSignals = intelligence.signals;
      calendarQueuePreview = intelligence.queueItems;
      reportByWindow = {
        '7d': report7d,
        '30d': report30d,
      };
    } catch (error) {
      console.error('Failed to fetch dashboard account snapshot:', error);
    }
  }

  const payload = buildDashboardPayload({
    businessName,
    selectedPlatformIntegrationId: selectedPlatformId,
    selectedAdAccountId,
    platform,
    adAccount,
    campaignSnapshot,
    intelligenceSignals,
    calendarQueuePreview,
    syncCoverage,
    reportByWindow,
  });

  return <DashboardClient payload={payload} />;
}
