import type {
  AdAccountData,
  PlatformDetails,
} from '@/lib/server/data/types';
import type { AdAccountSignalView } from '@/lib/server/intelligence';
import type { ReviveCampaignOpportunity } from '@/lib/shared/types/campaignDrafts';
import type { SyncCoverage } from '@/lib/shared/types/integrations';
import type { CalendarQueuePreviewItem } from '@/lib/shared';

export type DashboardState =
  | 'no_platform_selected'
  | 'platform_not_found_or_not_connected'
  | 'no_ad_account_selected'
  | 'ad_account_selected_no_metrics'
  | 'ready';

export type DashboardWindow = '7d' | '30d';

export type DashboardOutcomeMetric = 'results' | 'leads' | 'messages' | 'clicks';

export type DashboardAlertTone = 'red' | 'yellow' | 'blue' | 'teal';

export interface DashboardAlert {
  id: string;
  tone: DashboardAlertTone;
  title: string;
  description: string;
}

export interface DashboardSummaryCard {
  key: 'spend' | 'results' | 'leads' | 'messages' | 'link_clicks';
  label: string;
  value: number;
  previousValue: number | null;
  changePercent: number | null;
}

export interface DashboardTrendPoint {
  label: string;
  spend: number;
  outcome: number;
}

export interface DashboardTrendSeries {
  outcomeMetric: DashboardOutcomeMetric;
  outcomeLabel: string;
  points: DashboardTrendPoint[];
}

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

export interface DashboardCampaignPreviewItem {
  campaignId: string;
  campaignName: string;
  objective: string | null;
  status: string;
  spend: number;
  primaryOutcomeMetric: DashboardOutcomeMetric;
  primaryOutcomeLabel: string;
  primaryOutcomeValue: number;
  conversionRate: number;
  costPerResult: number;
  ctr: number;
}

export interface DashboardAttentionSignal {
  id: string;
  signalType: AdAccountSignalView['signalType'];
  severity: AdAccountSignalView['severity'];
  title: string;
  reason: string;
  actionLabel: string | null;
  actionHref: string | null;
}

export interface DashboardPayload {
  state: DashboardState;
  selection: {
    selectedPlatformIntegrationId: string | null;
    selectedAdAccountId: string | null;
  };
  activeWindow: DashboardWindow;
  windowOptions: DashboardWindow[];
  viewContext: DashboardViewContext;
  alerts: DashboardAlert[];
  summaryByWindow: Record<DashboardWindow, DashboardSummaryCard[]>;
  trendByWindow: Record<DashboardWindow, DashboardTrendSeries>;
  campaignPreview: DashboardCampaignPreviewItem[];
  intelligenceSignals: DashboardAttentionSignal[];
  calendarQueuePreview: CalendarQueuePreviewItem[];
  syncCoverage: SyncCoverage | null;
  reviveOpportunity: ReviveCampaignOpportunity | null;
  platform: PlatformDetails | null;
  adAccount: AdAccountData | null;
}
