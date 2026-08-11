export type CampaignReviewPageState = 'completed' | 'pending' | 'failed';

export type CampaignReviewMetricsView = {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  messages: number;
  calls: number;
  results: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  costPerResult: number;
};

export type CampaignReviewEntityView = {
  id: string | null;
  externalId: string | null;
  level: 'campaign' | 'adset' | 'ad' | 'unknown';
  name: string;
  status: string | null;
  objective: string | null;
  campaignId: string | null;
  adsetId: string | null;
  firstDay: string | null;
  lastDay: string | null;
  lifetime: CampaignReviewMetricsView;
  recent: CampaignReviewMetricsView;
  previous: CampaignReviewMetricsView;
};

export type CampaignReviewFindingView = {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  summary: string;
  reason: string | null;
  reportHref: string | null;
  campaignId: string | null;
  campaignExternalId: string | null;
  campaignName: string | null;
};

export type CampaignReviewViewModel = {
  queueItemId: string;
  title: string;
  rawStatus: string;
  state: CampaignReviewPageState;
  scheduledFor: string | null;
  completedAt: string | null;
  generatedAt: string | null;
  processedAt: string | null;
  currencyCode: string | null;
  scope: 'active_recent' | 'specific_campaign' | 'unknown';
  scopeLabel: string;
  aiGenerated: boolean;
  aiRunId: string | null;
  promptVersion: string | null;
  fallbackReason: string | null;
  decisionSupportVersion: string | null;
  reviewedCampaignCount: number;
  unavailableCampaign: string | null;
  errorMessage: string | null;
  summary: string | null;
  highlights: string[];
  risks: string[];
  nextSteps: string[];
  operatorNotes: string[];
  findings: CampaignReviewFindingView[];
  campaignRankings: CampaignReviewEntityView[];
  adsetRankings: CampaignReviewEntityView[];
  adRankings: CampaignReviewEntityView[];
};
