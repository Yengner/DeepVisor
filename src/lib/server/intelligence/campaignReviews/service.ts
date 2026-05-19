import 'server-only';

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord, buildReportUrl } from '@/lib/shared';
import { isLikelyActiveStatus } from '@/lib/server/dashboard/buildPayload';
import { runStructuredAI } from '@/lib/server/openai/structured';
import type { Database } from '@/lib/shared/types/supabase';
import type {
  CalendarQueueItem,
  TrendFindingDraft,
  TrendFindingSeverity,
} from '../types';
import { syncTrendFindings } from '../repositories/trendFindings';

type IntelligenceClient = SupabaseClient<Database>;

type CampaignReviewScope = 'active_recent' | 'specific_campaign';

type EntityLevel = 'campaign' | 'adset' | 'ad';

type EntityRow = {
  id: string;
  external_id: string;
  entity_level: EntityLevel;
  campaign_id: string | null;
  adset_id: string | null;
  name: string | null;
  status: string | null;
  objective: string | null;
  optimization_goal: string | null;
  created_time: string | null;
};

type SummaryRow = {
  entity_id: string;
  entity_level: EntityLevel;
  spend: number | null;
  reach: number | null;
  impressions: number | null;
  clicks: number | null;
  inline_link_clicks: number | null;
  leads: number | null;
  messages: number | null;
  calls: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  cost_per_result: number | null;
  first_day: string | null;
  last_day: string | null;
};

type DailyRow = {
  entity_id: string;
  day: string;
  spend: number | null;
  reach: number | null;
  impressions: number | null;
  clicks: number | null;
  inline_link_clicks: number | null;
  leads: number | null;
  messages: number | null;
  calls: number | null;
};

type Metrics = {
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

type ReviewEntity = {
  id: string;
  externalId: string;
  level: EntityLevel;
  name: string;
  status: string | null;
  objective: string | null;
  campaignId: string | null;
  adsetId: string | null;
  firstDay: string | null;
  lastDay: string | null;
  lifetime: Metrics;
  recent: Metrics;
  previous: Metrics;
};

type CampaignReviewFinding = {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  summary: string;
  reason: string;
  campaignId: string | null;
  campaignExternalId: string | null;
  campaignName: string | null;
  metricSnapshot: Record<string, unknown>;
  reportHref: string | null;
};

export type CampaignReviewResult = {
  type: 'campaign_review';
  reviewHref: string;
  scope: CampaignReviewScope;
  generatedAt: string;
  aiGenerated: boolean;
  aiRunId: string | null;
  promptVersion: string;
  fallbackReason: string | null;
  decisionSupportVersion: string;
  summary: string;
  highlights: string[];
  risks: string[];
  nextSteps: string[];
  operatorNotes: string[];
  reviewedCampaignCount: number;
  unavailableCampaign: string | null;
  campaignRankings: ReviewEntity[];
  adsetRankings: ReviewEntity[];
  adRankings: ReviewEntity[];
  findings: CampaignReviewFinding[];
};

const RECENT_DAYS = 30;
const MIN_WARNING_SPEND = 25;
const MIN_CRITICAL_SPEND = 50;
const CAMPAIGN_REVIEW_PROMPT_VERSION = 'campaign_review_decision_support_v1';
const DECISION_SUPPORT_VERSION = 'deepvisor_decision_support_v1';

type CampaignReviewNarrativePayload = Pick<
  CampaignReviewResult,
  'summary' | 'highlights' | 'risks' | 'nextSteps' | 'operatorNotes'
>;

type CampaignReviewNarrative = CampaignReviewNarrativePayload &
  Pick<
    CampaignReviewResult,
    'aiGenerated' | 'aiRunId' | 'promptVersion' | 'fallbackReason'
  >;

const CAMPAIGN_REVIEW_NARRATIVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'highlights', 'risks', 'nextSteps', 'operatorNotes'],
  properties: {
    summary: {
      type: 'string',
    },
    highlights: {
      type: 'array',
      items: { type: 'string' },
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
    },
    operatorNotes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies Record<string, unknown>;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function numberValue(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function round(value: number, digits = 2): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(digits));
}

function emptyMetrics(): Metrics {
  return {
    spend: 0,
    reach: 0,
    impressions: 0,
    clicks: 0,
    linkClicks: 0,
    leads: 0,
    messages: 0,
    calls: 0,
    results: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    frequency: 0,
    costPerResult: 0,
  };
}

function finalizeMetrics(metrics: Metrics): Metrics {
  const results = metrics.leads + metrics.messages + metrics.calls;

  return {
    ...metrics,
    results,
    ctr: metrics.impressions > 0 ? round((metrics.clicks / metrics.impressions) * 100, 2) : 0,
    cpc: metrics.clicks > 0 ? round(metrics.spend / metrics.clicks, 2) : 0,
    cpm: metrics.impressions > 0 ? round((metrics.spend / metrics.impressions) * 1000, 2) : 0,
    frequency: metrics.reach > 0 ? round(metrics.impressions / metrics.reach, 2) : 0,
    costPerResult: results > 0 ? round(metrics.spend / results, 2) : 0,
  };
}

function metricsFromSummary(row: SummaryRow | null): Metrics {
  if (!row) {
    return emptyMetrics();
  }

  return finalizeMetrics({
    spend: numberValue(row.spend),
    reach: numberValue(row.reach),
    impressions: numberValue(row.impressions),
    clicks: numberValue(row.clicks),
    linkClicks: numberValue(row.inline_link_clicks),
    leads: numberValue(row.leads),
    messages: numberValue(row.messages),
    calls: numberValue(row.calls),
    results: 0,
    ctr: numberValue(row.ctr),
    cpc: numberValue(row.cpc),
    cpm: numberValue(row.cpm),
    frequency: numberValue(row.frequency),
    costPerResult: numberValue(row.cost_per_result),
  });
}

function metricsFromDailyRows(rows: DailyRow[]): Metrics {
  const metrics = rows.reduce((current, row) => {
    current.spend += numberValue(row.spend);
    current.reach += numberValue(row.reach);
    current.impressions += numberValue(row.impressions);
    current.clicks += numberValue(row.clicks);
    current.linkClicks += numberValue(row.inline_link_clicks);
    current.leads += numberValue(row.leads);
    current.messages += numberValue(row.messages);
    current.calls += numberValue(row.calls);
    return current;
  }, emptyMetrics());

  return finalizeMetrics(metrics);
}

function performanceScore(entity: ReviewEntity): number {
  const resultScore = entity.recent.results * 4;
  const spendEfficiency =
    entity.recent.costPerResult > 0 ? Math.max(0, 100 / entity.recent.costPerResult) : 0;
  return resultScore + spendEfficiency + entity.recent.ctr - entity.recent.spend * 0.01;
}

function hashPayload(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex');
}

function getCampaignReviewConfig(payload: Record<string, unknown>): {
  scope: CampaignReviewScope;
  campaignExternalId: string | null;
  campaignInternalId: string | null;
  campaignName: string | null;
} {
  const config = asRecord(payload.campaignReview);
  const scope = config.scope === 'specific_campaign' ? 'specific_campaign' : 'active_recent';

  return {
    scope,
    campaignExternalId:
      typeof config.campaignExternalId === 'string' ? config.campaignExternalId : null,
    campaignInternalId:
      typeof config.campaignInternalId === 'string' ? config.campaignInternalId : null,
    campaignName: typeof config.campaignName === 'string' ? config.campaignName : null,
  };
}

async function loadEntities(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
  }
): Promise<EntityRow[]> {
  const { data, error } = await (supabase as any)
    .from('ad_entities')
    .select(
      'id, external_id, entity_level, campaign_id, adset_id, name, status, objective, optimization_goal, created_time'
    )
    .eq('business_id', input.businessId)
    .eq('ad_account_id', input.adAccountId)
    .in('entity_level', ['campaign', 'adset', 'ad']);

  if (error) {
    throw error;
  }

  return (data ?? []) as EntityRow[];
}

async function loadSummaries(
  supabase: IntelligenceClient,
  adAccountId: string
): Promise<Map<string, SummaryRow>> {
  const { data, error } = await (supabase as any)
    .from('ad_entity_performance_summary')
    .select(
      'entity_id, entity_level, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls, ctr, cpc, cpm, frequency, cost_per_result, first_day, last_day'
    )
    .eq('ad_account_id', adAccountId);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as SummaryRow[]).map((row) => [row.entity_id, row]));
}

async function loadDailyRows(
  supabase: IntelligenceClient,
  input: {
    adAccountId: string;
    sinceDay: string;
  }
): Promise<DailyRow[]> {
  const { data, error } = await (supabase as any)
    .from('ad_entity_performance_daily')
    .select(
      'entity_id, day, spend, reach, impressions, clicks, inline_link_clicks, leads, messages, calls'
    )
    .eq('ad_account_id', input.adAccountId)
    .gte('day', input.sinceDay);

  if (error) {
    throw error;
  }

  return (data ?? []) as DailyRow[];
}

function buildReviewEntities(input: {
  entities: EntityRow[];
  summaries: Map<string, SummaryRow>;
  dailyRows: DailyRow[];
  recentStart: string;
  previousStart: string;
}): ReviewEntity[] {
  const dailyByEntityId = new Map<string, DailyRow[]>();

  for (const row of input.dailyRows) {
    const current = dailyByEntityId.get(row.entity_id) ?? [];
    current.push(row);
    dailyByEntityId.set(row.entity_id, current);
  }

  return input.entities.map((entity) => {
    const summary = input.summaries.get(entity.id) ?? null;
    const dailyRows = dailyByEntityId.get(entity.id) ?? [];
    const recentRows = dailyRows.filter((row) => row.day >= input.recentStart);
    const previousRows = dailyRows.filter(
      (row) => row.day >= input.previousStart && row.day < input.recentStart
    );

    return {
      id: entity.id,
      externalId: entity.external_id,
      level: entity.entity_level,
      name: entity.name ?? `Unnamed ${entity.entity_level}`,
      status: entity.status,
      objective: entity.objective ?? entity.optimization_goal,
      campaignId: entity.campaign_id,
      adsetId: entity.adset_id,
      firstDay: summary?.first_day ?? entity.created_time ?? null,
      lastDay: summary?.last_day ?? null,
      lifetime: metricsFromSummary(summary),
      recent: metricsFromDailyRows(recentRows),
      previous: metricsFromDailyRows(previousRows),
    };
  });
}

function isActiveRecentCampaign(entity: ReviewEntity): boolean {
  const hasRecentDelivery =
    entity.recent.spend > 0 || entity.recent.impressions > 0 || entity.recent.results > 0;

  return hasRecentDelivery || isLikelyActiveStatus(entity.status);
}

function buildAccountAverages(campaigns: ReviewEntity[]): {
  costPerResult: number;
  ctr: number;
} {
  const active = campaigns.filter((campaign) => campaign.recent.spend > 0);
  const totalSpend = active.reduce((sum, campaign) => sum + campaign.recent.spend, 0);
  const totalResults = active.reduce((sum, campaign) => sum + campaign.recent.results, 0);
  const totalClicks = active.reduce((sum, campaign) => sum + campaign.recent.clicks, 0);
  const totalImpressions = active.reduce((sum, campaign) => sum + campaign.recent.impressions, 0);

  return {
    costPerResult: totalResults > 0 ? round(totalSpend / totalResults, 2) : 0,
    ctr: totalImpressions > 0 ? round((totalClicks / totalImpressions) * 100, 2) : 0,
  };
}

function buildCampaignFindings(input: {
  campaigns: ReviewEntity[];
  accountAverages: { costPerResult: number; ctr: number };
  platformIntegrationId: string;
  adAccountId: string;
  reviewHref: string;
  generatedAt: string;
}): CampaignReviewFinding[] {
  const findings: CampaignReviewFinding[] = [];

  for (const campaign of input.campaigns) {
    const reportHref = buildReportUrl({
      scope: 'campaign',
      platformIntegrationId: input.platformIntegrationId,
      adAccountIds: [input.adAccountId],
      campaignIds: [campaign.externalId],
      rangeMode: 'max',
    });

    if (campaign.recent.spend >= MIN_CRITICAL_SPEND && campaign.recent.results === 0) {
      findings.push({
        severity: 'critical',
        title: `${campaign.name} spent without results`,
        summary: `${campaign.name} spent $${round(campaign.recent.spend)} in the last ${RECENT_DAYS} days without tracked results.`,
        reason:
          'The review found meaningful recent spend with no leads, messages, or calls recorded.',
        campaignId: campaign.id,
        campaignExternalId: campaign.externalId,
        campaignName: campaign.name,
        metricSnapshot: {
          sourceWindow: 'campaign_review',
          periodEnd: input.generatedAt.slice(0, 10),
          spend: campaign.recent.spend,
          results: campaign.recent.results,
          impressions: campaign.recent.impressions,
          costPerResult: campaign.recent.costPerResult,
        },
        reportHref,
      });
      continue;
    }

    const averageCost = input.accountAverages.costPerResult;
    if (
      averageCost > 0 &&
      campaign.recent.costPerResult > 0 &&
      campaign.recent.spend >= MIN_WARNING_SPEND &&
      campaign.recent.costPerResult >= averageCost * 2
    ) {
      const severity: CampaignReviewFinding['severity'] =
        campaign.recent.costPerResult >= averageCost * 3 ? 'critical' : 'warning';
      findings.push({
        severity,
        title: `${campaign.name} is above account cost per result`,
        summary: `${campaign.name} is at $${round(campaign.recent.costPerResult)} per result versus the account average of $${averageCost}.`,
        reason:
          'The campaign review compared recent cost per result against active peer campaigns in the same ad account.',
        campaignId: campaign.id,
        campaignExternalId: campaign.externalId,
        campaignName: campaign.name,
        metricSnapshot: {
          sourceWindow: 'campaign_review',
          periodEnd: input.generatedAt.slice(0, 10),
          spend: campaign.recent.spend,
          results: campaign.recent.results,
          costPerResult: campaign.recent.costPerResult,
          accountCostPerResult: averageCost,
        },
        reportHref,
      });
    }

    if (
      campaign.previous.costPerResult > 0 &&
      campaign.recent.costPerResult > campaign.previous.costPerResult * 1.5 &&
      campaign.recent.spend >= MIN_WARNING_SPEND
    ) {
      findings.push({
        severity: 'warning',
        title: `${campaign.name} efficiency deteriorated`,
        summary: `${campaign.name} moved from $${round(campaign.previous.costPerResult)} to $${round(campaign.recent.costPerResult)} per result versus the prior period.`,
        reason:
          'The review compared the latest 30 days against the previous 30 days for the same campaign.',
        campaignId: campaign.id,
        campaignExternalId: campaign.externalId,
        campaignName: campaign.name,
        metricSnapshot: {
          sourceWindow: 'campaign_review',
          periodEnd: input.generatedAt.slice(0, 10),
          spend: campaign.recent.spend,
          results: campaign.recent.results,
          costPerResult: campaign.recent.costPerResult,
          previousCostPerResult: campaign.previous.costPerResult,
        },
        reportHref,
      });
    }
  }

  return findings;
}

function buildDeterministicNarrative(input: {
  campaigns: ReviewEntity[];
  findings: CampaignReviewFinding[];
  unavailableCampaign: string | null;
}): CampaignReviewNarrativePayload {
  if (input.unavailableCampaign) {
    return {
      summary: `The requested campaign could not be found, so DeepVisor did not generate optimization findings for it.`,
      highlights: [],
      risks: [`Campaign ${input.unavailableCampaign} is unavailable in the selected ad account.`],
      nextSteps: ['Confirm the campaign still exists, then update or recreate the campaign review queue.'],
      operatorNotes: ['No platform-level campaign changes were executed.'],
    };
  }

  const strongest = [...input.campaigns].sort(
    (left, right) => performanceScore(right) - performanceScore(left)
  )[0];
  const highestSpend = [...input.campaigns].sort(
    (left, right) => right.recent.spend - left.recent.spend
  )[0];

  return {
    summary:
      input.findings.length > 0
        ? `DeepVisor reviewed ${input.campaigns.length} campaign${input.campaigns.length === 1 ? '' : 's'} and found ${input.findings.length} item${input.findings.length === 1 ? '' : 's'} that need attention.`
        : `DeepVisor reviewed ${input.campaigns.length} campaign${input.campaigns.length === 1 ? '' : 's'} and did not find a critical efficiency issue at the current thresholds.`,
    highlights: [
      strongest
        ? `${strongest.name} has the strongest recent score among reviewed campaigns.`
        : 'No campaign had enough recent delivery to identify a clear winner.',
      highestSpend
        ? `${highestSpend.name} has the highest recent spend at $${round(highestSpend.recent.spend)}.`
        : 'Recent spend is limited across the reviewed campaigns.',
    ],
    risks:
      input.findings.length > 0
        ? input.findings.slice(0, 3).map((finding) => finding.summary)
        : ['No warning or critical campaign review findings were generated.'],
    nextSteps:
      input.findings.length > 0
        ? [
            'Open the highest-severity campaign report before changing spend.',
            'Compare recent cost per result against lifetime performance and peer campaigns.',
            'Queue budget or creative follow-up only after confirming the campaign objective and tracking quality.',
          ]
        : [
            'Keep the review cadence active.',
            'Watch for cost per result changes after the next sync.',
            'Use campaign reports for deeper ad set or ad-level checks.',
          ],
    operatorNotes: [
      'Deterministic thresholds generated the review findings.',
      'No platform-level campaign changes were executed.',
    ],
  };
}

function stringListValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function validateCampaignReviewNarrative(value: unknown): CampaignReviewNarrativePayload | null {
  const record = asRecord(value);
  const summary = typeof record.summary === 'string' ? record.summary.trim() : '';

  if (!summary) {
    return null;
  }

  return {
    summary,
    highlights: stringListValue(record.highlights).slice(0, 4),
    risks: stringListValue(record.risks).slice(0, 4),
    nextSteps: stringListValue(record.nextSteps).slice(0, 4),
    operatorNotes: stringListValue(record.operatorNotes).slice(0, 4),
  };
}

async function generateNarrativeWithAI(input: {
  supabase: IntelligenceClient;
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  queueItemId: string;
  campaigns: ReviewEntity[];
  findings: CampaignReviewFinding[];
  fallback: CampaignReviewNarrativePayload;
}): Promise<CampaignReviewNarrative> {
  const result = await runStructuredAI<CampaignReviewNarrativePayload>({
    supabase: input.supabase,
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    queueItemId: input.queueItemId,
    sourceType: 'campaign_review',
    sourceId: input.queueItemId,
    promptVersion: CAMPAIGN_REVIEW_PROMPT_VERSION,
    schemaName: 'campaign_review_narrative_v1',
    schema: CAMPAIGN_REVIEW_NARRATIVE_SCHEMA,
    systemPrompt:
      'You are DeepVisor, an ad account decision-support analyst. Return only JSON matching the supplied schema. Use only the provided campaign review metrics and findings. Explain what matters and what to review next. Do not claim that any platform-level campaign change was executed. Do not recommend publishing, pausing, extending, or changing budgets without explicit approval.',
    task: 'Summarize this campaign review for a small-business owner or operator.',
    input: {
      campaigns: input.campaigns.slice(0, 10).map((campaign) => ({
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        recent: campaign.recent,
        previous: campaign.previous,
        lifetime: campaign.lifetime,
      })),
      findings: input.findings,
      safety:
        'All next steps must be review, approval, or draft-oriented. Do not imply platform changes were made.',
    },
    fallback: input.fallback,
    validate: validateCampaignReviewNarrative,
    skipReason: input.campaigns.length === 0 ? 'empty_campaign_review_scope' : null,
    temperature: 0.2,
    metadata: {
      findingCount: input.findings.length,
      reviewedCampaignCount: input.campaigns.length,
    },
  });

  return {
    ...result.output,
    aiGenerated: result.aiGenerated,
    aiRunId: result.runId,
    promptVersion: result.promptVersion,
    fallbackReason: result.fallbackReason,
  };
}

function toTrendFindingDraft(input: {
  finding: CampaignReviewFinding;
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  reviewHref: string;
  generatedAt: string;
}): TrendFindingDraft {
  const snapshot = {
    ...input.finding.metricSnapshot,
    campaignReviewHref: input.reviewHref,
    campaignExternalId: input.finding.campaignExternalId,
  };

  return {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    campaignId: input.finding.campaignId,
    adsetId: null,
    adId: null,
    findingType: 'efficiency_drop_vs_delivery',
    severity: input.finding.severity as TrendFindingSeverity,
    confidence: 'medium',
    title: input.finding.title,
    summary: input.finding.summary,
    reason: input.finding.reason,
    metricSnapshot: snapshot,
    recommendedAction: {
      type: 'campaign_review',
      label: 'Open campaign review',
      destination: 'reports',
      href: input.reviewHref,
      reportHref: input.finding.reportHref,
      queueSuggested: false,
      payload: {
        campaignId: input.finding.campaignExternalId,
        campaignInternalId: input.finding.campaignId,
      },
    },
    snapshotHash: hashPayload(snapshot),
    dedupeKey: `campaign-review:${input.adAccountId}:${input.finding.campaignId ?? input.finding.campaignExternalId}:${input.finding.title}`,
    detectedAt: input.generatedAt,
  };
}

async function syncCampaignReviewFindings(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    reviewHref: string;
    generatedAt: string;
    findings: CampaignReviewFinding[];
  }
) {
  const drafts = input.findings
    .filter((finding) => finding.severity === 'warning' || finding.severity === 'critical')
    .map((finding) =>
      toTrendFindingDraft({
        finding,
        businessId: input.businessId,
        platformIntegrationId: input.platformIntegrationId,
        adAccountId: input.adAccountId,
        reviewHref: input.reviewHref,
        generatedAt: input.generatedAt,
      })
    );

  if (drafts.length === 0) {
    return [];
  }

  return syncTrendFindings(supabase, {
    businessId: input.businessId,
    adAccountId: input.adAccountId,
    drafts,
    resolveStale: false,
  });
}

export async function buildCampaignReviewResult(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    queueItemId: string;
    payload: Record<string, unknown>;
    generatedAt: string;
  }
): Promise<CampaignReviewResult> {
  const reviewHref = `/campaigns/reviews/${input.queueItemId}`;
  const config = getCampaignReviewConfig(input.payload);
  const today = input.generatedAt.slice(0, 10);
  const recentStart = addUtcDays(today, -(RECENT_DAYS - 1));
  const previousStart = addUtcDays(recentStart, -RECENT_DAYS);
  const [entities, summaries, dailyRows] = await Promise.all([
    loadEntities(supabase, {
      businessId: input.businessId,
      adAccountId: input.adAccountId,
    }),
    loadSummaries(supabase, input.adAccountId),
    loadDailyRows(supabase, {
      adAccountId: input.adAccountId,
      sinceDay: previousStart,
    }),
  ]);
  const reviewEntities = buildReviewEntities({
    entities,
    summaries,
    dailyRows,
    recentStart,
    previousStart,
  });
  const allCampaigns = reviewEntities.filter((entity) => entity.level === 'campaign');
  let unavailableCampaign: string | null = null;
  let selectedCampaigns =
    config.scope === 'specific_campaign'
      ? allCampaigns.filter(
          (campaign) =>
            campaign.id === config.campaignInternalId ||
            campaign.externalId === config.campaignExternalId
        )
      : allCampaigns.filter(isActiveRecentCampaign);

  if (config.scope === 'specific_campaign' && selectedCampaigns.length === 0) {
    unavailableCampaign = config.campaignName ?? config.campaignExternalId ?? config.campaignInternalId;
  }

  selectedCampaigns = selectedCampaigns.sort(
    (left, right) => performanceScore(right) - performanceScore(left)
  );
  const selectedCampaignIds = new Set(selectedCampaigns.map((campaign) => campaign.id));
  const selectedAdsets = reviewEntities
    .filter((entity) => entity.level === 'adset' && entity.campaignId && selectedCampaignIds.has(entity.campaignId))
    .sort((left, right) => performanceScore(right) - performanceScore(left))
    .slice(0, 12);
  const selectedAdsetsById = new Set(selectedAdsets.map((adset) => adset.id));
  const selectedAds = reviewEntities
    .filter(
      (entity) =>
        entity.level === 'ad' &&
        ((entity.campaignId && selectedCampaignIds.has(entity.campaignId)) ||
          (entity.adsetId && selectedAdsetsById.has(entity.adsetId)))
    )
    .sort((left, right) => performanceScore(right) - performanceScore(left))
    .slice(0, 12);
  const accountAverages = buildAccountAverages(allCampaigns.filter(isActiveRecentCampaign));
  const findings = unavailableCampaign
    ? []
    : buildCampaignFindings({
        campaigns: selectedCampaigns,
        accountAverages,
        platformIntegrationId: input.platformIntegrationId,
        adAccountId: input.adAccountId,
        reviewHref,
        generatedAt: input.generatedAt,
      });
  const fallback = buildDeterministicNarrative({
    campaigns: selectedCampaigns,
    findings,
    unavailableCampaign,
  });
  const narrative = await generateNarrativeWithAI({
    supabase,
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    queueItemId: input.queueItemId,
    campaigns: selectedCampaigns,
    findings,
    fallback,
  });

  await syncCampaignReviewFindings(supabase, {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    reviewHref,
    generatedAt: input.generatedAt,
    findings,
  });

  return {
    type: 'campaign_review',
    reviewHref,
    scope: config.scope,
    generatedAt: input.generatedAt,
    decisionSupportVersion: DECISION_SUPPORT_VERSION,
    ...narrative,
    reviewedCampaignCount: selectedCampaigns.length,
    unavailableCampaign,
    campaignRankings: selectedCampaigns.slice(0, 12),
    adsetRankings: selectedAdsets,
    adRankings: selectedAds,
    findings,
  };
}

export async function runCampaignReviewQueueAction(
  supabase: IntelligenceClient,
  item: CalendarQueueItem,
  input: {
    business: { id: string; business_name: string; organization_id: string | null } | null;
    userIds: string[];
    timeZone: string;
    timestamp: string;
  }
) {
  console.info('[calendar-queue:campaign-review] start', {
    queueItemId: item.id,
    businessId: item.businessId,
    adAccountId: item.adAccountId,
    scheduledFor: item.scheduledFor,
  });
  const result = await buildCampaignReviewResult(supabase, {
    businessId: item.businessId,
    platformIntegrationId: item.platformIntegrationId,
    adAccountId: item.adAccountId,
    queueItemId: item.id,
    payload: item.payload,
    generatedAt: input.timestamp,
  });
  const riskCount = result.findings.filter(
    (finding) => finding.severity === 'warning' || finding.severity === 'critical'
  ).length;

  console.info('[calendar-queue:campaign-review] complete', {
    queueItemId: item.id,
    scope: result.scope,
    reviewedCampaignCount: result.reviewedCampaignCount,
    findingCount: result.findings.length,
    riskCount,
    reviewHref: result.reviewHref,
    aiGenerated: result.aiGenerated,
    unavailableCampaign: result.unavailableCampaign,
  });

  return {
    link: result.reviewHref,
    payload: result,
    notificationCopy: {
      title: `Campaign review ready: ${item.title}`,
      message:
        riskCount > 0
          ? `DeepVisor found ${riskCount} campaign review item${riskCount === 1 ? '' : 's'} that need attention.`
          : 'DeepVisor finished the campaign review and did not find a critical campaign issue at the current thresholds.',
    },
  };
}
