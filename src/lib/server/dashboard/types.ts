import type {
  AdAccountData,
  PlatformDetails,
} from '@/lib/server/data/types';
import type { SyncCoverage } from '@/lib/shared/types/integrations';

export type DashboardState =
  | 'no_platform_selected'
  | 'platform_not_found_or_not_connected'
  | 'no_ad_account_selected'
  | 'ad_account_selected_no_metrics'
  | 'ready';

export type DashboardOutcomeMetric = 'results' | 'leads' | 'messages' | 'clicks';

export type DashboardBreakdownState = 'available' | 'syncing' | 'unsupported';

export interface DashboardViewContext {
  businessName: string;
  platformName: string | null;
  platformStatus: PlatformDetails['status'] | null;
  adAccountName: string | null;
  adAccountStatus: string | null;
  lastSyncedAt: string | null;
  currencyCode: string | null;
  platformError: string | null;
  canRefresh: boolean;
}

export interface DashboardCampaignSnapshotItem {
  campaignId: string;
  campaignName: string;
  objective: string | null;
  status: string;
  spend: number;
  clicks: number;
  leads: number;
  messages: number;
  conversion: number;
  conversionRate: number;
  costPerResult: number;
  ctr: number;
}

export interface DashboardCampaignDimension {
  internalId: string;
  externalId: string;
  name: string | null;
  objective: string | null;
  status: string | null;
}

export interface DashboardAdsetDimension {
  internalId: string;
  externalId: string;
  campaignExternalId: string;
  name: string | null;
  optimizationGoal: string | null;
  status: string | null;
}

export interface DashboardAdDimension {
  internalId: string;
  externalId: string;
  adsetExternalId: string;
  name: string | null;
  status: string | null;
}

export interface DashboardAudienceMetricRow {
  entityLevel: 'adset' | 'ad';
  adsetInternalId: string | null;
  adInternalId: string | null;
  breakdownType: string;
  dimension1Key: string;
  dimension1Value: string;
  dimension2Key: string;
  dimension2Value: string;
  publisherPlatform: string | null;
  platformPosition: string | null;
  impressionDevice: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  messages: number;
  calls: number;
}

export interface DashboardLiveCampaignContainer {
  id: string;
  internalId: string | null;
  name: string;
  status: string;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  adsetCount: number;
  adCount: number;
  performanceIndex: number;
}

export interface DashboardLiveAdsetItem {
  id: string;
  internalId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  name: string;
  status: string;
  optimizationGoal: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  adCount: number;
  performanceIndex: number;
  topPublisherPlatform: string | null;
  topPlacement: string | null;
}

export interface DashboardLiveAdItem {
  id: string;
  internalId: string | null;
  adsetId: string | null;
  adsetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  performanceIndex: number;
  topPublisherPlatform: string | null;
  topPlacement: string | null;
}

export interface DashboardPlatformSlice {
  key: string;
  kind: 'publisher_platform' | 'platform_position' | 'impression_device';
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  shareOfSpend: number;
}

export interface DashboardAudienceSlice {
  key: string;
  kind: 'age_gender' | 'geo';
  label: string;
  secondaryLabel: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  shareOfSpend: number;
}

export interface DashboardPlatformBreakdowns {
  state: DashboardBreakdownState;
  publisherPlatforms: DashboardPlatformSlice[];
  placements: DashboardPlatformSlice[];
  impressionDevices: DashboardPlatformSlice[];
}

export interface DashboardAudienceBreakdowns {
  state: DashboardBreakdownState;
  ageGender: DashboardAudienceSlice[];
  geo: DashboardAudienceSlice[];
}

export interface DashboardLiveComparisons {
  adsets: DashboardLiveAdsetItem[];
  ads: DashboardLiveAdItem[];
}

export interface DashboardLiveSummary {
  liveCampaignCount: number;
  liveAdsetCount: number;
  liveAdCount: number;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  costPerResult: number;
  primaryOutcomeMetric: DashboardOutcomeMetric;
  primaryOutcomeLabel: string;
  primaryOutcomeValue: number;
  servingPlatformLabels: string[];
}

export interface DashboardLiveWindow {
  hasLiveDelivery: boolean;
  campaigns: DashboardLiveCampaignContainer[];
  adsets: DashboardLiveAdsetItem[];
  ads: DashboardLiveAdItem[];
  summary: DashboardLiveSummary;
  comparisons: DashboardLiveComparisons;
  platformBreakdowns: DashboardPlatformBreakdowns;
  audienceBreakdowns: DashboardAudienceBreakdowns;
}

export interface DashboardTrendPoint {
  label: string;
  dayKey: string | null;
  dayOfWeek: number | null;
  hourOfDay: number | null;
  spend: number;
  results: number;
  clicks: number;
  inlineLinkClicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  costPerResult: number;
}

export interface DashboardFeaturedAdsetHistory {
  adset: DashboardLiveAdsetItem | null;
  dailyTrend: DashboardTrendPoint[];
  hourlyTrend: DashboardTrendPoint[];
  hourlyTrendExpanded: DashboardTrendPoint[];
  platformBreakdowns: DashboardPlatformBreakdowns;
  audienceBreakdowns: DashboardAudienceBreakdowns;
  dailyHistoryStartDate: string | null;
  dailyHistoryEndDate: string | null;
  hourlyHistoryStartDate: string | null;
  hourlyHistoryEndDate: string | null;
  hourlyHistoryDate: string | null;
}

export interface DashboardPayload {
  state: DashboardState;
  selection: {
    selectedPlatformIntegrationId: string | null;
    selectedAdAccountId: string | null;
  };
  viewContext: DashboardViewContext;
  liveToday: DashboardLiveWindow;
  featuredAdsetHistory: DashboardFeaturedAdsetHistory;
  syncCoverage: SyncCoverage | null;
  platform: PlatformDetails | null;
  adAccount: AdAccountData | null;
}
