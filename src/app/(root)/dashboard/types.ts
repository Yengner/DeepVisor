import type {
  AdAccountData,
  AdAccountTimeIncrementPoint,
  BusinessAdAccountRollup,
  PlatformDetails,
} from '@/lib/server/data/types';

export type DashboardState =
  | 'no_platform_selected'
  | 'platform_not_found_or_not_connected'
  | 'no_ad_account_selected'
  | 'ad_account_selected_no_metrics'
  | 'ready';

export interface DashboardCampaignSnapshotItem {
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  clicks: number;
  leads: number;
  messages: number;
  conversion: number;
  conversionRate: number;
  costPerResult: number;
}

export interface DashboardPayload {
  state: DashboardState;
  business: {
    id: string;
    name: string;
  };
  selection: {
    selectedPlatformIntegrationId: string | null;
    selectedAdAccountId: string | null;
  };
  platform: PlatformDetails | null;
  adAccount: AdAccountData | null;
  businessRollup: BusinessAdAccountRollup;
  trend: {
    defaultWindow: '30';
    points: AdAccountTimeIncrementPoint[];
  };
  campaignSnapshot: DashboardCampaignSnapshotItem[];
}
