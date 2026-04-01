export { buildDashboardPayload } from './buildPayload';
export { normalizeCampaignSnapshot } from '@/lib/server/repositories/campaigns/normalizers';
export { resolveDashboardState } from './state';
export type {
  DashboardAlert,
  DashboardCampaignPreviewItem,
  DashboardCampaignSnapshotItem,
  DashboardPayload,
  DashboardSummaryCard,
  DashboardState,
  DashboardTrendSeries,
  DashboardViewContext,
  DashboardWindow,
} from './types';
