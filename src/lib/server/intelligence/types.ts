import type { Database } from '@/lib/shared/types/supabase';
import type {
  ReportKpi,
  ReportMetricTotals,
  ReportTimeSeriesPoint,
} from '@/lib/server/reports/types';

export type BusinessAssessmentRow =
  Database['ai']['Tables']['business_assessments']['Row'];
export type AdAccountAssessmentRow = BusinessAssessmentRow;

export type BusinessIntelligencePlanningScope =
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
export type DigestTrendDirection = 'up' | 'down' | 'flat' | 'unknown';
export type DigestRiskLevel = 'low' | 'medium' | 'high';
export type TestingVelocityLabel = 'none' | 'low' | 'healthy';

export type AssessmentTrigger =
  | 'integration'
  | 'sync'
  | 'manual'
  | 'material_change';

export type AdAccountSignalType =
  | 'dormant_account'
  | 'revive_best_historic_winner'
  | 'efficiency_deterioration'
  | 'no_recent_testing'
  | 'weak_tracking';

export type AdAccountSignalSeverity = 'info' | 'warning' | 'critical';
export type AdAccountSignalStatus = 'active' | 'accepted' | 'dismissed' | 'resolved';
export type CalendarQueueSourceType = 'signal' | 'ai' | 'manual' | 'system';
export type CalendarQueueItemType =
  | 'revive_campaign'
  | 'refresh_creative'
  | 'investigate_efficiency'
  | 'launch_test'
  | 'fix_tracking'
  | 'review_report';
export type CalendarQueueWorkflowKind =
  | 'revive_workflow'
  | 'efficiency_workflow'
  | 'tracking_workflow'
  | 'testing_workflow';
export type CalendarQueuePriority = 'low' | 'medium' | 'high' | 'critical';
export type CalendarQueueStatus =
  | 'ready'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'dismissed';

export interface IntelligenceTopCampaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  conversion: number;
  ctr: number;
  costPerResult: number;
}

export interface BusinessIntelligenceOverview {
  scopeLabel: string;
  summary: ReportMetricTotals;
  kpis: ReportKpi[];
  series: ReportTimeSeriesPoint[];
  topCampaigns: IntelligenceTopCampaign[];
}

export interface BusinessIntelligencePlatformSummary {
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

export interface BusinessIntelligenceAdAccountSummary {
  id: string;
  name: string | null;
  status: string | null;
  externalAccountId: string;
  lastSynced: string | null;
  platformId: string;
  platformIntegrationId: string | null;
  platformLabel: string;
}

export interface BusinessIntelligenceSelection {
  scope: BusinessIntelligencePlanningScope;
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

export interface DigestTrendSnapshot {
  direction: DigestTrendDirection;
  deltaAbsolute: number;
  deltaPercent: number | null;
  currentValue: number;
  previousValue: number;
}

export interface DigestWindowWinner {
  label: string;
  startDay: string | null;
  endDay: string | null;
  spend: number;
  conversion: number;
  costPerResult: number;
  ctr: number;
  reason: string;
}

export interface DigestTestingVelocity {
  label: TestingVelocityLabel;
  newCampaigns30d: number;
  newAdsets30d: number;
  activeTests30d: number;
  lastLaunchDay: string | null;
}

export interface DigestCreativeFatigueRisk {
  level: DigestRiskLevel;
  score: number;
  reasons: string[];
  supportingCampaignIds: string[];
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
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  historyWindowAvailable: {
    firstDay: string | null;
    lastDay: string | null;
    historyDays: number;
  };
  daysSinceLastActivity: number | null;
  staleSeverity: 'watch' | 'stale' | 'critical' | null;
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
  topObjectives: Array<{
    objective: string;
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
  spendTrend: DigestTrendSnapshot;
  resultTrend: DigestTrendSnapshot;
  bestWindow30d: DigestWindowWinner | null;
  bestWindow90d: DigestWindowWinner | null;
  testingVelocity: DigestTestingVelocity;
  creativeFatigueRisk: DigestCreativeFatigueRisk;
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

export interface AdAccountSignalRecommendedAction {
  type: CalendarQueueItemType;
  label: string;
  destination: 'campaign_draft' | 'dashboard' | 'calendar' | 'reports' | 'settings';
  href: string | null;
  draftSource?: 'historic_clone' | 'fresh_relaunch' | 'manual_defaults' | null;
  queueSuggested: boolean;
  payload?: Record<string, unknown>;
}

export interface AdAccountSignalEvidence {
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  daysSinceLastActivity: number | null;
  trackingConfidence: TrackingConfidence;
  spendTrend: DigestTrendSnapshot;
  resultTrend: DigestTrendSnapshot;
  bestWindow30d: DigestWindowWinner | null;
  bestWindow90d: DigestWindowWinner | null;
  testingVelocity: DigestTestingVelocity;
  creativeFatigueRisk: DigestCreativeFatigueRisk;
  topCampaignIds: string[];
  topObjective: string | null;
  [key: string]: unknown;
}

export interface AdAccountSignalDraft {
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  sourceAssessmentId: string | null;
  sourceDigestHash: string;
  signalType: AdAccountSignalType;
  severity: AdAccountSignalSeverity;
  title: string;
  reason: string;
  evidence: AdAccountSignalEvidence;
  recommendedAction: AdAccountSignalRecommendedAction;
}

export interface AdAccountSignal extends AdAccountSignalDraft {
  id: string;
  status: AdAccountSignalStatus;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdAccountSignalView {
  id: string;
  signalType: AdAccountSignalType;
  severity: AdAccountSignalSeverity;
  title: string;
  reason: string;
  actionLabel: string | null;
  actionHref: string | null;
}

export interface CalendarQueueItemDraft {
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  sourceSignalId: string | null;
  sourceType: CalendarQueueSourceType;
  itemType: CalendarQueueItemType;
  priority: CalendarQueuePriority;
  title: string;
  description: string | null;
  destinationHref: string | null;
  scheduledFor?: string | null;
  dueDate?: string | null;
  parentQueueItemId?: string | null;
  workflowKey?: CalendarQueueWorkflowKind | null;
  materializedFromBlueprintKey?: string | null;
  childBlueprints?: CalendarQueueChildBlueprint[];
  payload: Record<string, unknown>;
}

export interface CalendarQueueItem extends CalendarQueueItemDraft {
  id: string;
  status: CalendarQueueStatus;
  campaignDraftId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  completedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarQueueChildBlueprint {
  key: string;
  itemType: CalendarQueueItemType;
  priority: CalendarQueuePriority;
  title: string;
  description: string | null;
  destinationHref: string | null;
  payload: Record<string, unknown>;
}

export interface MetaAccountIntelligenceArtifacts {
  assessment: AdAccountAssessment;
  signals: AdAccountSignal[];
  queueItems: CalendarQueueItem[];
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

export interface BusinessIntelligenceWorkspace {
  businessId: string;
  businessName: string;
  platforms: BusinessIntelligencePlatformSummary[];
  selection: BusinessIntelligenceSelection;
  selectedPlatformIntegrationId: string | null;
  selectedAdAccountId: string | null;
  selectedAdAccountName: string | null;
  adAccounts: BusinessIntelligenceAdAccountSummary[];
  overview: BusinessIntelligenceOverview;
  latestBusinessAssessment: BusinessAssessment | null;
  latestAccountAssessments: AdAccountAssessment[];
  latestSelectedAssessment: AdAccountAssessment | null;
}

export type GlobalAiAssistantState =
  | 'no_platform_connected'
  | 'no_ad_account_selected'
  | 'needs_assessment'
  | 'ready';

export interface GlobalAiAssistantPayload {
  businessId: string;
  businessName: string;
  state: GlobalAiAssistantState;
  selectionScope: BusinessIntelligencePlanningScope;
  selectedPlatformIntegrationId: string | null;
  selectedPlatformLabel: string | null;
  selectedAdAccountId: string | null;
  selectedAdAccountName: string | null;
  selectedAdAccountExternalId: string | null;
  latestBusinessAssessment: BusinessAssessment | null;
  latestSelectedAssessment: AdAccountAssessment | null;
}
