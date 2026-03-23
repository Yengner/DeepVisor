import type { Database } from '@/lib/shared/types/supabase';
import type {
  ReportKpi,
  ReportMetricTotals,
  ReportTimeSeriesPoint,
} from '@/lib/server/reports/types';

export type AdAccountAssessmentRow =
  Database['public']['Tables']['ad_account_assessments']['Row'];
export type BusinessAssessmentRow =
  Database['public']['Tables']['business_assessments']['Row'];

export type BusinessAgencyPlanningScope =
  | 'business'
  | 'integration'
  | 'selected_integrations';

export type AdAccountAssessmentState =
  | 'empty'
  | 'launch_ready'
  | 'learning'
  | 'optimizable'
  | 'mature'
  | 'stale'
  | 'misconfigured';

export type TrackingConfidence = 'low' | 'medium' | 'high';

export type AssessmentTrigger =
  | 'integration'
  | 'sync'
  | 'manual'
  | 'material_change';

export interface AgencyTopCampaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  conversion: number;
  ctr: number;
  costPerResult: number;
}

export interface BusinessAgencyOverview {
  scopeLabel: string;
  summary: ReportMetricTotals;
  kpis: ReportKpi[];
  series: ReportTimeSeriesPoint[];
  topCampaigns: AgencyTopCampaign[];
}

export interface BusinessAgencyPlatformSummary {
  id: string;
  platformId: string;
  label: string;
  status: string;
  adAccountCount: number;
  primaryAdAccountId: string | null;
  primaryAdAccountExternalId: string | null;
  primaryAdAccountName: string | null;
  selectionRequired: boolean;
}

export interface BusinessAgencyAdAccountSummary {
  id: string;
  name: string | null;
  status: string | null;
  externalAccountId: string;
  lastSynced: string | null;
  platformId: string;
  platformIntegrationId: string | null;
  platformLabel: string;
}

export interface BusinessAgencySelection {
  scope: BusinessAgencyPlanningScope;
  scopeLabel: string;
  platformIntegrationId: string | null;
  platformIntegrationIds: string[];
  adAccountIds: string[];
  primaryAdAccountId: string | null;
}

export interface AssessmentWindowMetrics {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  messages: number;
  conversion: number;
  ctr: number;
  cpc: number;
  cpm: number;
  costPerResult: number;
  frequency: number;
  activeDays: number;
}

export interface AssessmentBreakdownItem {
  id: string;
  name: string;
  status: string | null;
  objective: string | null;
  spend: number;
  conversion: number;
  ctr: number;
  costPerResult: number;
  performanceIndex: number;
}

export interface AdAccountDigest {
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  adAccountName: string | null;
  externalAccountId: string;
  platformLabel: string;
  assessmentVersion: number;
  generatedAt: string;
  lastSyncedAt: string | null;
  historyWindowAvailable: {
    firstDay: string | null;
    lastDay: string | null;
    historyDays: number;
  };
  spendLevel: 'none' | 'low' | 'medium' | 'high';
  recentActivity: {
    hasDeliveryLast7d: boolean;
    hasDeliveryLast30d: boolean;
    spendLast7d: number;
    spendLast30d: number;
    impressionsLast7d: number;
    impressionsLast30d: number;
    activeDaysLast7d: number;
    activeDaysLast30d: number;
  };
  campaignVolume: {
    totalCampaigns: number;
    activeCampaigns: number;
    campaignsWithSpend30d: number;
    campaignsWithResults30d: number;
  };
  objectiveMix: Array<{
    objective: string;
    spend: number;
    shareOfSpend: number;
    campaigns: number;
  }>;
  conversionSignalQuality: {
    conversions30d: number;
    clicks30d: number;
    linkClicks30d: number;
    score: number;
    label: 'none' | 'weak' | 'usable' | 'strong';
  };
  trackingConfidence: TrackingConfidence;
  creativeFreshness: 'fresh' | 'mixed' | 'stale';
  accountMaturity: {
    score: number;
    label: AdAccountAssessmentState;
  };
  weightedAverages: {
    lifetime: AssessmentWindowMetrics;
    last90d: AssessmentWindowMetrics;
    last30d: AssessmentWindowMetrics;
    last7d: AssessmentWindowMetrics;
  };
  topCampaigns: AssessmentBreakdownItem[];
  bottomCampaigns: AssessmentBreakdownItem[];
  topAdSets: AssessmentBreakdownItem[];
  bottomAdSets: AssessmentBreakdownItem[];
  digestHash: string;
}

export interface AdAccountAssessmentSummary {
  summary: string;
  primaryFlow: 'launch' | 'optimize' | 'revive' | 'fix_tracking';
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  aiGenerated: boolean;
}

export interface AdAccountAssessment {
  id: string;
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  state: AdAccountAssessmentState;
  historyDays: number;
  hasDelivery: boolean;
  hasConversionSignal: boolean;
  trackingConfidence: TrackingConfidence;
  maturityScore: number;
  digest: AdAccountDigest;
  assessment: AdAccountAssessmentSummary;
  createdAt: string;
}

export interface BusinessSynthesisDigest {
  businessId: string;
  generatedAt: string;
  connectedIntegrationCount: number;
  assessedAccountCount: number;
  totalSpendLast30d: number;
  totalConversionLast30d: number;
  accountStates: Array<{
    platformIntegrationId: string;
    adAccountId: string;
    adAccountName: string | null;
    platformLabel: string;
    state: AdAccountAssessmentState;
    maturityScore: number;
    spendLast30d: number;
    conversionLast30d: number;
  }>;
  strongestAccountId: string | null;
  strongestPlatformIntegrationId: string | null;
  budgetConcentration: Array<{
    platformIntegrationId: string;
    adAccountId: string;
    shareOfSpend: number;
  }>;
  fragmentationRisk: 'low' | 'medium' | 'high';
  primaryPlanningFlow: 'launch' | 'optimize' | 'revive' | 'fix_tracking';
}

export interface BusinessAssessmentSummary {
  summary: string;
  priority: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  aiGenerated: boolean;
}

export interface BusinessAssessment {
  id: string;
  businessId: string;
  scope: 'business';
  digest: BusinessSynthesisDigest;
  assessment: BusinessAssessmentSummary;
  createdAt: string;
}

export interface BusinessAgencyWorkspace {
  businessId: string;
  businessName: string;
  platforms: BusinessAgencyPlatformSummary[];
  selection: BusinessAgencySelection;
  selectedPlatformIntegrationId: string | null;
  selectedAdAccountId: string | null;
  selectedAdAccountName: string | null;
  adAccounts: BusinessAgencyAdAccountSummary[];
  overview: BusinessAgencyOverview;
  latestBusinessAssessment: BusinessAssessment | null;
  latestAccountAssessments: AdAccountAssessment[];
  latestSelectedAssessment: AdAccountAssessment | null;
}
