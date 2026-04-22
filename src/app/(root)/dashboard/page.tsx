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
import {
  getCurrentUtcMonthDateRange,
  getCurrentUtcWeekDateRange,
  getPreviousUtcWeekDateRange,
  getTrailingUtcDateRange,
} from '@/lib/shared';
import type { CalendarQueuePreviewItem } from '@/lib/shared';
import type { DashboardCampaignSnapshotItem, DashboardWindow } from './types';
import type { ReportBreakdownRow } from '@/lib/server/reports/types';

type DashboardActivityRows = {
  campaigns: ReportBreakdownRow[];
  adsets: ReportBreakdownRow[];
  ads: ReportBreakdownRow[];
};

type DashboardWindowConfig = {
  window: DashboardWindow;
  dateFrom: string;
  dateTo: string;
  groupBy: 'day' | 'week';
};

function buildDashboardWindowConfigs(): DashboardWindowConfig[] {
  const thisWeek = getCurrentUtcWeekDateRange();
  const lastWeek = getPreviousUtcWeekDateRange();
  const last7Days = getTrailingUtcDateRange(7);
  const last30Days = getTrailingUtcDateRange(30);
  const thisMonth = getCurrentUtcMonthDateRange();

  return [
    {
      window: 'this_week',
      dateFrom: thisWeek.dateFrom,
      dateTo: thisWeek.dateTo,
      groupBy: 'day',
    },
    {
      window: 'last_week',
      dateFrom: lastWeek.dateFrom,
      dateTo: lastWeek.dateTo,
      groupBy: 'day',
    },
    {
      window: 'last_7d',
      dateFrom: last7Days.dateFrom,
      dateTo: last7Days.dateTo,
      groupBy: 'day',
    },
    {
      window: 'last_30d',
      dateFrom: last30Days.dateFrom,
      dateTo: last30Days.dateTo,
      groupBy: 'week',
    },
    {
      window: 'this_month',
      dateFrom: thisMonth.dateFrom,
      dateTo: thisMonth.dateTo,
      groupBy: 'day',
    },
  ];
}

function isLikelyActiveStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  const inactiveTokens = [
    'paused',
    'archived',
    'completed',
    'ended',
    'disabled',
    'inactive',
    'deleted',
    'removed',
    'rejected',
    'disapproved',
    'error',
    'failed',
    'draft',
  ];

  if (inactiveTokens.some((token) => normalized.includes(token))) {
    return false;
  }

  const activeTokens = [
    'active',
    'enabled',
    'learning',
    'limited',
    'pending',
    'review',
    'running',
    'serving',
  ];

  return activeTokens.some((token) => normalized.includes(token));
}

function pickCandidateIds(rows: ReportBreakdownRow[], limit: number): string[] {
  const activeRows = rows.filter((row) => isLikelyActiveStatus(row.status));
  const source = activeRows.length > 0 ? activeRows : rows;
  return source
    .slice()
    .sort((left, right) => right.spend - left.spend || right.conversion - left.conversion)
    .slice(0, limit)
    .map((row) => row.id);
}

async function buildDashboardActivityRowsForWindow(input: {
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  dateFrom: string;
  dateTo: string;
  groupBy: 'day' | 'week';
  campaignRows: ReportBreakdownRow[];
}): Promise<DashboardActivityRows> {
  const campaignIds = pickCandidateIds(input.campaignRows, 8);

  if (campaignIds.length === 0) {
    return {
      campaigns: input.campaignRows,
      adsets: [],
      ads: [],
    };
  }

  const adsetReport = await buildReportPayload({
    businessId: input.businessId,
    scope: 'campaign',
    platformIntegrationId: input.platformIntegrationId,
    adAccountIds: [input.adAccountId],
    campaignIds,
    adsetIds: [],
    adIds: [],
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    groupBy: input.groupBy,
    compareMode: 'none',
  });

  const adsetIds = pickCandidateIds(adsetReport.breakdown.rows, 10);
  const adReport =
    adsetIds.length > 0
      ? await buildReportPayload({
          businessId: input.businessId,
          scope: 'adset',
          platformIntegrationId: input.platformIntegrationId,
          adAccountIds: [input.adAccountId],
          campaignIds: [],
          adsetIds,
          adIds: [],
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          groupBy: input.groupBy,
          compareMode: 'none',
        })
      : null;

  return {
    campaigns: input.campaignRows,
    adsets: adsetReport.breakdown.rows,
    ads: adReport?.breakdown.rows ?? [],
  };
}

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
  let reportByWindow: Partial<Record<DashboardWindow, Awaited<ReturnType<typeof buildReportPayload>>>> = {};
  let activityRowsByWindow: Partial<Record<DashboardWindow, DashboardActivityRows>> = {};
  if (adAccount?.id && platformConnected && selectedPlatformId) {
    try {
      const windowConfigs = buildDashboardWindowConfigs();
      const [campaigns, coverage, intelligence] = await Promise.all([
        getAdAccountTopCampaigns(adAccount.id),
        getAdAccountSyncCoverage(adminSupabase, adAccount.id),
        getMetaAccountIntelligenceReadModel(adminSupabase, {
          businessId,
          adAccountId: adAccount.id,
        }),
      ]);
      const reports = await Promise.all(
        windowConfigs.map((config) =>
          buildReportPayload({
            businessId,
            scope: 'ad_account',
            platformIntegrationId: selectedPlatformId,
            adAccountIds: [adAccount.id],
            campaignIds: [],
            adsetIds: [],
            adIds: [],
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            groupBy: config.groupBy,
            compareMode: 'previous_period',
          })
        )
      );
      campaignSnapshot = normalizeCampaignSnapshot(campaigns);
      syncCoverage = coverage;
      intelligenceSignals = intelligence.signals;
      calendarQueuePreview = intelligence.queueItems;
      reportByWindow = Object.fromEntries(
        windowConfigs.map((config, index) => [config.window, reports[index]])
      ) as Partial<Record<DashboardWindow, Awaited<ReturnType<typeof buildReportPayload>>>>;
      const activities = await Promise.all(
        windowConfigs.map((config, index) =>
          buildDashboardActivityRowsForWindow({
            businessId,
            platformIntegrationId: selectedPlatformId,
            adAccountId: adAccount.id,
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            groupBy: config.groupBy,
            campaignRows: reports[index]?.breakdown.rows ?? [],
          })
        )
      );
      activityRowsByWindow = Object.fromEntries(
        windowConfigs.map((config, index) => [config.window, activities[index]])
      ) as Partial<Record<DashboardWindow, DashboardActivityRows>>;
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
    activityRowsByWindow,
    reportByWindow,
  });

  return <DashboardClient payload={payload} />;
}
