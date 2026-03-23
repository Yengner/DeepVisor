import 'server-only';

import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/server/supabase/server';
import { asNumber } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import { getCampaignSummaries, type CampaignSummary } from '@/lib/server/repositories/campaigns/getCampaignSummaries';
import { getAdSetsLifetimeIncludingZeros, type AdSetLifetimeRow } from '@/lib/server/repositories/adsets/getAdSetsMetrics';
import {
  getLatestAdAccountAssessment as getLatestAdAccountAssessmentRecord,
  getLatestBusinessAssessment as getLatestBusinessAssessmentRecord,
  insertAdAccountAssessment,
  insertBusinessAssessment,
  listLatestAdAccountAssessmentsForBusiness,
} from '../repositories/assessments';
import type {
  AdAccountAssessment,
  AdAccountAssessmentState,
  AdAccountAssessmentSummary,
  AdAccountDigest,
  AssessmentBreakdownItem,
  AssessmentTrigger,
  AssessmentWindowMetrics,
  BusinessAssessment,
  BusinessAssessmentSummary,
  BusinessSynthesisDigest,
  TrackingConfidence,
} from '../types';

type AssessmentClient = SupabaseClient<Database>;

type PlatformIntegrationRow = {
  id: string;
  platform_id: string;
  integration_details: Database['public']['Tables']['platform_integrations']['Row']['integration_details'];
  platforms: { key: string; name: string } | { key: string; name: string }[] | null;
};

type AdAccountRow = Pick<
  Database['public']['Tables']['ad_accounts']['Row'],
  | 'id'
  | 'business_id'
  | 'platform_id'
  | 'external_account_id'
  | 'name'
  | 'status'
  | 'aggregated_metrics'
  | 'time_increment_metrics'
  | 'last_synced'
>;

type AdAccountDailyRow = Pick<
  Database['public']['Tables']['ad_accounts_performance_daily']['Row'],
  | 'day'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'inline_link_clicks'
  | 'leads'
  | 'messages'
>;

const ASSESSMENT_VERSION = 1;

function getPlatformRecord(
  value: PlatformIntegrationRow['platforms']
): { key: string; name: string } | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function zeroWindowMetrics(): AssessmentWindowMetrics {
  return {
    spend: 0,
    reach: 0,
    impressions: 0,
    clicks: 0,
    linkClicks: 0,
    leads: 0,
    messages: 0,
    conversion: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    costPerResult: 0,
    frequency: 0,
    activeDays: 0,
  };
}

function startDateFromDays(windowDays: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - Math.max(windowDays, 1) + 1);
  return date.toISOString().slice(0, 10);
}

function summarizeDailyWindow(
  rows: AdAccountDailyRow[],
  input?: { sinceDay?: string }
): AssessmentWindowMetrics {
  const totals = zeroWindowMetrics();
  const filtered = input?.sinceDay ? rows.filter((row) => row.day >= input.sinceDay!) : rows;

  for (const row of filtered) {
    totals.spend += asNumber(row.spend);
    totals.reach += asNumber(row.reach);
    totals.impressions += asNumber(row.impressions);
    totals.clicks += asNumber(row.clicks);
    totals.linkClicks += asNumber(row.inline_link_clicks);
    totals.leads += asNumber(row.leads);
    totals.messages += asNumber(row.messages);

    if (asNumber(row.spend) > 0 || asNumber(row.impressions) > 0) {
      totals.activeDays += 1;
    }
  }

  totals.conversion = totals.leads + totals.messages;
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  totals.costPerResult = totals.conversion > 0 ? totals.spend / totals.conversion : 0;
  totals.frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;

  return totals;
}

function computeSpendLevel(spendLast30d: number): AdAccountDigest['spendLevel'] {
  if (spendLast30d <= 0) return 'none';
  if (spendLast30d < 500) return 'low';
  if (spendLast30d < 3000) return 'medium';
  return 'high';
}

function computeTrackingConfidence(window: AssessmentWindowMetrics): TrackingConfidence {
  if (window.conversion >= 10) {
    return 'high';
  }

  if (window.linkClicks >= 25 && window.conversion >= 2) {
    return 'medium';
  }

  if (window.clicks >= 50 && window.linkClicks >= 20 && window.conversion === 0) {
    return 'low';
  }

  return window.linkClicks > 0 ? 'medium' : 'low';
}

function computeCreativeFreshness(input: {
  historyDays: number;
  recentActivity: AdAccountDigest['recentActivity'];
  campaignsWithSpend30d: number;
}): AdAccountDigest['creativeFreshness'] {
  if (!input.recentActivity.hasDeliveryLast30d) {
    return 'stale';
  }

  if (input.campaignsWithSpend30d >= 3 && input.recentActivity.activeDaysLast7d >= 3) {
    return 'fresh';
  }

  if (input.historyDays >= 90 && input.campaignsWithSpend30d <= 1) {
    return 'stale';
  }

  return 'mixed';
}

function computeMaturityScore(input: {
  historyDays: number;
  spend90d: number;
  conversion90d: number;
  campaignsWithSpend30d: number;
}): number {
  const historyScore = Math.min(input.historyDays, 120) / 120 * 30;
  const spendScore = Math.min(input.spend90d, 5000) / 5000 * 30;
  const conversionScore = Math.min(input.conversion90d, 100) / 100 * 25;
  const campaignScore = Math.min(input.campaignsWithSpend30d, 5) / 5 * 15;

  return Math.round(historyScore + spendScore + conversionScore + campaignScore);
}

function classifyAdAccountState(input: {
  totalCampaigns: number;
  lifetime: AssessmentWindowMetrics;
  last90d: AssessmentWindowMetrics;
  last30d: AssessmentWindowMetrics;
  historyDays: number;
  maturityScore: number;
  trackingConfidence: TrackingConfidence;
}): AdAccountAssessmentState {
  const hasAnyDelivery = input.lifetime.impressions > 0 || input.lifetime.spend > 0;

  if (!hasAnyDelivery && input.totalCampaigns === 0) {
    return 'empty';
  }

  if (!hasAnyDelivery) {
    return 'launch_ready';
  }

  if (input.last30d.spend <= 0 && input.last90d.spend > 0) {
    return 'stale';
  }

  if (
    input.last30d.spend >= 100 &&
    input.last30d.clicks >= 50 &&
    input.last30d.linkClicks >= 20 &&
    input.last30d.conversion === 0
  ) {
    return 'misconfigured';
  }

  if (input.maturityScore >= 80 && input.last90d.conversion >= 30) {
    return 'mature';
  }

  if (
    input.last30d.spend > 0 &&
    (input.last30d.conversion >= 5 || input.last30d.clicks >= 50) &&
    input.trackingConfidence !== 'low'
  ) {
    return 'optimizable';
  }

  return 'learning';
}

function computePerformanceIndex(input: {
  spend: number;
  conversion: number;
  ctr: number;
  costPerResult: number;
  averages: AssessmentWindowMetrics;
}): number {
  const ctrScore = input.averages.ctr > 0 ? input.ctr / input.averages.ctr : input.ctr > 0 ? 1 : 0;
  const conversionScore =
    input.averages.conversion > 0
      ? input.conversion / input.averages.conversion
      : input.conversion > 0
        ? 1
        : 0;
  const costScore =
    input.conversion <= 0
      ? 0
      : input.averages.costPerResult > 0
        ? input.averages.costPerResult / Math.max(input.costPerResult, 0.01)
        : 1;
  const spendScore =
    input.averages.spend > 0 ? input.spend / input.averages.spend : input.spend > 0 ? 1 : 0;

  return Number((ctrScore * 0.25 + conversionScore * 0.4 + costScore * 0.25 + spendScore * 0.1).toFixed(2));
}

function toCampaignBreakdownItems(
  campaigns: CampaignSummary[],
  averages: AssessmentWindowMetrics
): AssessmentBreakdownItem[] {
  return campaigns
    .map((campaign) => ({
      id: campaign.campaignInternalId,
      name: campaign.campaignName,
      status: campaign.status,
      objective: campaign.objective,
      spend: campaign.spend,
      conversion: campaign.conversion,
      ctr: campaign.ctr,
      costPerResult: campaign.costPerResult,
      performanceIndex: computePerformanceIndex({
        spend: campaign.spend,
        conversion: campaign.conversion,
        ctr: campaign.ctr,
        costPerResult: campaign.costPerResult,
        averages,
      }),
    }))
    .sort((left, right) => right.performanceIndex - left.performanceIndex || right.spend - left.spend);
}

function toAdsetBreakdownItems(
  adsets: AdSetLifetimeRow[],
  averages: AssessmentWindowMetrics
): AssessmentBreakdownItem[] {
  return adsets
    .map((adset) => {
      const spend = Number(adset.spend || 0);
      const ctr = Number(adset.ctr || 0);
      const conversion = Number(adset.leads || 0) + Number(adset.messages || 0);
      const costPerResult = conversion > 0 ? spend / conversion : 0;

      return {
        id: adset.id,
        name: adset.name,
        status: adset.status,
        objective: adset.optimization_goal,
        spend,
        conversion,
        ctr,
        costPerResult,
        performanceIndex: computePerformanceIndex({
          spend,
          conversion,
          ctr,
          costPerResult,
          averages,
        }),
      } satisfies AssessmentBreakdownItem;
    })
    .sort((left, right) => right.performanceIndex - left.performanceIndex || right.spend - left.spend);
}

function buildObjectiveMix(campaigns: CampaignSummary[]): AdAccountDigest['objectiveMix'] {
  const totals = new Map<string, { spend: number; campaigns: number }>();
  let totalSpend = 0;

  for (const campaign of campaigns) {
    const objective = campaign.objective || 'UNKNOWN';
    const current = totals.get(objective) ?? { spend: 0, campaigns: 0 };
    current.spend += campaign.spend;
    current.campaigns += 1;
    totals.set(objective, current);
    totalSpend += campaign.spend;
  }

  return Array.from(totals.entries())
    .map(([objective, value]) => ({
      objective,
      spend: Number(value.spend.toFixed(2)),
      shareOfSpend: totalSpend > 0 ? Number(((value.spend / totalSpend) * 100).toFixed(2)) : 0,
      campaigns: value.campaigns,
    }))
    .sort((left, right) => right.spend - left.spend);
}

function buildAdAccountDigestHash(value: Omit<AdAccountDigest, 'digestHash'>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function buildDeterministicAccountSummary(input: {
  state: AdAccountAssessmentState;
  digest: AdAccountDigest;
}): AdAccountAssessmentSummary {
  const conversionLabel = input.digest.conversionSignalQuality.label;
  const topCampaign = input.digest.topCampaigns[0]?.name ?? 'current strongest campaign';

  switch (input.state) {
    case 'empty':
    case 'launch_ready':
      return {
        summary:
          'This account has little or no usable delivery history, so the next step is a clean launch setup built around strong tracking, a focused offer, and a tighter first campaign structure.',
        primaryFlow: 'launch',
        strengths: [
          'The account can be structured cleanly before budget is fragmented.',
          'There is no heavy legacy clutter to unwind yet.',
        ],
        risks: [
          'There is not enough conversion history to optimize from existing results.',
          'Brief and tracking gaps will slow launch quality if left unresolved.',
        ],
        nextSteps: [
          'Confirm the offer, audience, destination, and geo targets.',
          'Launch one focused first campaign and monitor the first 7-14 days tightly.',
          'Validate lead routing and event capture before scaling.',
        ],
        aiGenerated: false,
      };
    case 'misconfigured':
      return {
        summary:
          'The account is spending and generating click intent, but conversion tracking or downstream routing looks unreliable enough that optimization should wait until measurement quality is fixed.',
        primaryFlow: 'fix_tracking',
        strengths: [
          'The account is still producing enough traffic to diagnose.',
          `${topCampaign} can be used as the first audit target.`,
        ],
        risks: [
          'Budget changes will be noisy until conversion capture is trustworthy.',
          'Reported winners may be false positives if tracking is incomplete.',
        ],
        nextSteps: [
          'Audit lead forms, CRM handoff, and destination tracking.',
          'Check whether link clicks, leads, and reported outcomes are aligned.',
          'Rerun assessment after measurement issues are fixed.',
        ],
        aiGenerated: false,
      };
    case 'stale':
      return {
        summary:
          'The account has historical signal but little recent delivery, so the priority is deciding whether to revive the strongest structure or rebuild around a cleaner offer and audience setup.',
        primaryFlow: 'revive',
        strengths: [
          'There is historical account structure to learn from.',
          `${topCampaign} provides a starting point for a relaunch angle.`,
        ],
        risks: [
          'Older creative or audiences may be fatigued.',
          'Past performance may no longer reflect the current business offer.',
        ],
        nextSteps: [
          'Review the strongest historic campaigns and ad sets before relaunch.',
          'Refresh the creative angle and tighten the landing or lead path.',
          'Restart with modest budget until fresh signal is available.',
        ],
        aiGenerated: false,
      };
    case 'mature':
    case 'optimizable':
      return {
        summary:
          'The account has enough history and recent signal to support optimization. The best next move is to reinforce winners, refresh weaker creative or audience segments, and reallocate budget carefully.',
        primaryFlow: 'optimize',
        strengths: [
          `Recent data is strong enough to compare campaigns against the account baseline.`,
          `${topCampaign} currently stands out as a leading campaign.`,
        ],
        risks: [
          'Aggressive budget movement can break a stable learning pattern.',
          `Creative freshness is currently ${input.digest.creativeFreshness}.`,
        ],
        nextSteps: [
          'Protect the strongest campaigns first and move budget gradually.',
          'Refresh lower-performing creative or audience segments.',
          'Use the current winners as the basis for the next round of experiments.',
        ],
        aiGenerated: false,
      };
    case 'learning':
    default:
      return {
        summary:
          'The account has some delivery history, but the signal is still thin enough that the next step should focus on tightening measurement, keeping changes small, and collecting cleaner conversion feedback.',
        primaryFlow: 'optimize',
        strengths: [
          'There is enough recent activity to start directional optimization.',
          `Signal quality is currently ${conversionLabel}.`,
        ],
        risks: [
          'Early noisy data can lead to over-correction.',
          'Weak tracking confidence will slow reliable learning.',
        ],
        nextSteps: [
          'Keep budget moves modest for the next review cycle.',
          'Improve conversion signal quality before adding complexity.',
          'Reassess once another 7-14 days of delivery is available.',
        ],
        aiGenerated: false,
      };
  }
}

async function generateAccountSummaryWithAI(input: {
  digest: AdAccountDigest;
  state: AdAccountAssessmentState;
}): Promise<AdAccountAssessmentSummary> {
  const fallback = buildDeterministicAccountSummary(input);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are DeepVisor. Return only JSON with keys summary, primaryFlow, strengths, risks, nextSteps. Use the digest and state only. Do not invent missing performance facts.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Summarize this ad account assessment and choose the right next workflow.',
            state: input.state,
            digest: input.digest,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<AdAccountAssessmentSummary>;
    if (
      typeof parsed.summary !== 'string' ||
      !['launch', 'optimize', 'revive', 'fix_tracking'].includes(String(parsed.primaryFlow))
    ) {
      return fallback;
    }

    return {
      summary: parsed.summary,
      primaryFlow: parsed.primaryFlow as AdAccountAssessmentSummary['primaryFlow'],
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.filter((item): item is string => typeof item === 'string')
        : fallback.strengths,
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.filter((item): item is string => typeof item === 'string')
        : fallback.risks,
      nextSteps: Array.isArray(parsed.nextSteps)
        ? parsed.nextSteps.filter((item): item is string => typeof item === 'string')
        : fallback.nextSteps,
      aiGenerated: true,
    };
  } catch (error) {
    console.error('Falling back to deterministic ad account assessment summary:', error);
    return fallback;
  }
}

function buildDeterministicBusinessSummary(
  digest: BusinessSynthesisDigest
): BusinessAssessmentSummary {
  const strongest = digest.accountStates.find((item) => item.adAccountId === digest.strongestAccountId);

  return {
    summary:
      digest.assessedAccountCount === 0
        ? 'No assessed ad accounts are available yet. Connect and assess a Meta account before continuing with business-wide screening.'
        : `The business currently has ${digest.assessedAccountCount} assessed account${digest.assessedAccountCount === 1 ? '' : 's'}. The primary next workflow is ${digest.primaryPlanningFlow}, and ${strongest?.adAccountName || 'the leading account'} is currently the strongest account by recent signal.`,
    priority:
      digest.primaryPlanningFlow === 'launch'
        ? 'Build a clean first-launch workflow.'
        : digest.primaryPlanningFlow === 'fix_tracking'
          ? 'Fix tracking confidence before scaling.'
          : digest.primaryPlanningFlow === 'revive'
            ? 'Revive or rebuild the stale account structure.'
            : 'Concentrate on optimization and winner reinforcement.',
    strengths:
      strongest
        ? [`${strongest.adAccountName || strongest.adAccountId} is the current strongest account.`]
        : ['The business can still establish a clean baseline from new account assessments.'],
    risks: [
      `Fragmentation risk is currently ${digest.fragmentationRisk}.`,
      'Recommendations should stay account-specific even when the business view spans several integrations.',
    ],
    nextSteps: [
      'Use business-level synthesis to choose the right screening scope.',
      'Start with the strongest or most urgent assessment first.',
      'Reassess after meaningful sync changes or manual review.',
    ],
    aiGenerated: false,
  };
}

async function generateBusinessSummaryWithAI(
  digest: BusinessSynthesisDigest
): Promise<BusinessAssessmentSummary> {
  const fallback = buildDeterministicBusinessSummary(digest);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || digest.assessedAccountCount === 0) {
    return fallback;
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are DeepVisor. Return only JSON with keys summary, priority, strengths, risks, nextSteps. Do not invent account history outside the digest.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Summarize business-wide account assessments and define the next business priority.',
            digest,
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<BusinessAssessmentSummary>;
    if (typeof parsed.summary !== 'string' || typeof parsed.priority !== 'string') {
      return fallback;
    }

    return {
      summary: parsed.summary,
      priority: parsed.priority,
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.filter((item): item is string => typeof item === 'string')
        : fallback.strengths,
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.filter((item): item is string => typeof item === 'string')
        : fallback.risks,
      nextSteps: Array.isArray(parsed.nextSteps)
        ? parsed.nextSteps.filter((item): item is string => typeof item === 'string')
        : fallback.nextSteps,
      aiGenerated: true,
    };
  } catch (error) {
    console.error('Falling back to deterministic business assessment summary:', error);
    return fallback;
  }
}

async function getIntegrationRow(
  supabase: AssessmentClient,
  businessId: string,
  platformIntegrationId: string
): Promise<PlatformIntegrationRow> {
  const { data, error } = await supabase
    .from('platform_integrations')
    .select('id, platform_id, integration_details, platforms(key, name)')
    .eq('business_id', businessId)
    .eq('id', platformIntegrationId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Platform integration not found');
  }

  return data as PlatformIntegrationRow;
}

async function getAdAccountRow(
  supabase: AssessmentClient,
  businessId: string,
  adAccountId: string
): Promise<AdAccountRow> {
  const { data, error } = await supabase
    .from('ad_accounts')
    .select(
      'id, business_id, platform_id, external_account_id, name, status, aggregated_metrics, time_increment_metrics, last_synced'
    )
    .eq('business_id', businessId)
    .eq('id', adAccountId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Ad account not found');
  }

  return data as AdAccountRow;
}

async function listAdAccountDailyRows(
  supabase: AssessmentClient,
  adAccountId: string
): Promise<AdAccountDailyRow[]> {
  const { data, error } = await supabase
    .from('ad_accounts_performance_daily')
    .select('day, spend, reach, impressions, clicks, inline_link_clicks, leads, messages')
    .eq('ad_account_id', adAccountId)
    .order('day', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as AdAccountDailyRow[];
}

function shouldGenerateAiAssessment(input: {
  latestAssessment: AdAccountAssessment | null;
  nextDigestHash: string;
  trigger: AssessmentTrigger;
}) {
  if (!input.latestAssessment) {
    return true;
  }

  if (input.trigger === 'manual' || input.trigger === 'integration' || input.trigger === 'material_change') {
    return true;
  }

  return input.latestAssessment.digest.digestHash !== input.nextDigestHash;
}

async function buildAdAccountDigest(input: {
  supabase: AssessmentClient;
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
}): Promise<{
  digest: AdAccountDigest;
  state: AdAccountAssessmentState;
  historyDays: number;
  hasDelivery: boolean;
  hasConversionSignal: boolean;
  trackingConfidence: TrackingConfidence;
  maturityScore: number;
}> {
  const [integration, adAccount, dailyRows] = await Promise.all([
    getIntegrationRow(input.supabase, input.businessId, input.platformIntegrationId),
    getAdAccountRow(input.supabase, input.businessId, input.adAccountId),
    listAdAccountDailyRows(input.supabase, input.adAccountId),
  ]);

  const platform = getPlatformRecord(integration.platforms);
  const lifetimeCampaigns = await getCampaignSummaries({
    supabase: input.supabase,
    adAccountIds: [input.adAccountId],
    includeEmpty: true,
    windowDays: null,
    sort: 'performance',
  });
  const campaigns30d = await getCampaignSummaries({
    supabase: input.supabase,
    adAccountIds: [input.adAccountId],
    includeEmpty: true,
    windowDays: 30,
    sort: 'performance',
  });
  const adsets = await getAdSetsLifetimeIncludingZeros(input.adAccountId, {
    supabase: input.supabase,
    vendor: 'meta',
  });

  const firstDay = dailyRows[0]?.day ?? null;
  const lastDay = dailyRows[dailyRows.length - 1]?.day ?? null;
  const historyDays =
    firstDay && lastDay
      ? Math.max(1, Math.floor((new Date(lastDay).getTime() - new Date(firstDay).getTime()) / 86400000) + 1)
      : 0;

  const lifetime = summarizeDailyWindow(dailyRows);
  const last90d = summarizeDailyWindow(dailyRows, { sinceDay: startDateFromDays(90) });
  const last30d = summarizeDailyWindow(dailyRows, { sinceDay: startDateFromDays(30) });
  const last7d = summarizeDailyWindow(dailyRows, { sinceDay: startDateFromDays(7) });

  const campaignsForComparison = campaigns30d.some((item) => item.spend > 0 || item.conversion > 0)
    ? campaigns30d
    : lifetimeCampaigns;
  const comparisonAverages = campaigns30d.some((item) => item.spend > 0 || item.conversion > 0)
    ? last30d
    : lifetime;

  const topCampaigns = toCampaignBreakdownItems(campaignsForComparison, comparisonAverages).slice(0, 5);
  const bottomCampaigns = [...toCampaignBreakdownItems(campaignsForComparison, comparisonAverages)]
    .sort((left, right) => left.performanceIndex - right.performanceIndex || right.spend - left.spend)
    .slice(0, 5);
  const adsetItems = toAdsetBreakdownItems(adsets, comparisonAverages);
  const topAdSets = adsetItems.slice(0, 5);
  const bottomAdSets = [...adsetItems]
    .sort((left, right) => left.performanceIndex - right.performanceIndex || right.spend - left.spend)
    .slice(0, 5);

  const trackingConfidence = computeTrackingConfidence(last30d);
  const hasDelivery = lifetime.impressions > 0 || lifetime.spend > 0;
  const hasConversionSignal = last30d.conversion >= 3 || last90d.conversion >= 10;
  const maturityScore = computeMaturityScore({
    historyDays,
    spend90d: last90d.spend,
    conversion90d: last90d.conversion,
    campaignsWithSpend30d: campaigns30d.filter((item) => item.spend > 0).length,
  });
  const state = classifyAdAccountState({
    totalCampaigns: lifetimeCampaigns.length,
    lifetime,
    last90d,
    last30d,
    historyDays,
    maturityScore,
    trackingConfidence,
  });

  const digestWithoutHash = {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    adAccountName: adAccount.name,
    externalAccountId: adAccount.external_account_id,
    platformLabel: platform?.name ?? platform?.key ?? 'Meta',
    assessmentVersion: ASSESSMENT_VERSION,
    generatedAt: new Date().toISOString(),
    lastSyncedAt: adAccount.last_synced,
    historyWindowAvailable: {
      firstDay,
      lastDay,
      historyDays,
    },
    spendLevel: computeSpendLevel(last30d.spend),
    recentActivity: {
      hasDeliveryLast7d: last7d.spend > 0 || last7d.impressions > 0,
      hasDeliveryLast30d: last30d.spend > 0 || last30d.impressions > 0,
      spendLast7d: Number(last7d.spend.toFixed(2)),
      spendLast30d: Number(last30d.spend.toFixed(2)),
      impressionsLast7d: last7d.impressions,
      impressionsLast30d: last30d.impressions,
      activeDaysLast7d: last7d.activeDays,
      activeDaysLast30d: last30d.activeDays,
    },
    campaignVolume: {
      totalCampaigns: lifetimeCampaigns.length,
      activeCampaigns: lifetimeCampaigns.filter((item) => (item.status ?? '').includes('active')).length,
      campaignsWithSpend30d: campaigns30d.filter((item) => item.spend > 0).length,
      campaignsWithResults30d: campaigns30d.filter((item) => item.conversion > 0).length,
    },
    objectiveMix: buildObjectiveMix(lifetimeCampaigns),
    conversionSignalQuality: {
      conversions30d: last30d.conversion,
      clicks30d: last30d.clicks,
      linkClicks30d: last30d.linkClicks,
      score: Number(
        Math.min(
          100,
          last30d.conversion * 4 + Math.min(last30d.linkClicks, 60) * 0.5 + Math.min(last30d.activeDays, 30)
        ).toFixed(2)
      ),
      label:
        last30d.conversion >= 15
          ? 'strong'
          : last30d.conversion >= 3
            ? 'usable'
            : last30d.linkClicks >= 20
              ? 'weak'
              : 'none',
    },
    trackingConfidence,
    creativeFreshness: computeCreativeFreshness({
      historyDays,
      recentActivity: {
        hasDeliveryLast7d: last7d.spend > 0 || last7d.impressions > 0,
        hasDeliveryLast30d: last30d.spend > 0 || last30d.impressions > 0,
        spendLast7d: last7d.spend,
        spendLast30d: last30d.spend,
        impressionsLast7d: last7d.impressions,
        impressionsLast30d: last30d.impressions,
        activeDaysLast7d: last7d.activeDays,
        activeDaysLast30d: last30d.activeDays,
      },
      campaignsWithSpend30d: campaigns30d.filter((item) => item.spend > 0).length,
    }),
    accountMaturity: {
      score: maturityScore,
      label: state,
    },
    weightedAverages: {
      lifetime,
      last90d,
      last30d,
      last7d,
    },
    topCampaigns,
    bottomCampaigns,
    topAdSets,
    bottomAdSets,
  } satisfies Omit<AdAccountDigest, 'digestHash'>;

  const digest: AdAccountDigest = {
    ...digestWithoutHash,
    digestHash: buildAdAccountDigestHash(digestWithoutHash),
  };

  return {
    digest,
    state,
    historyDays,
    hasDelivery,
    hasConversionSignal,
    trackingConfidence,
    maturityScore,
  };
}

export async function runMetaAdAccountAssessment(input: {
  supabase?: AssessmentClient;
  businessId: string;
  platformIntegrationId: string;
  adAccountId: string;
  trigger: AssessmentTrigger;
}): Promise<AdAccountAssessment> {
  const supabase = input.supabase ?? (await createServerClient());
  const latestAssessment = await getLatestAdAccountAssessmentRecord(supabase, {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
  });

  const digestResult = await buildAdAccountDigest({
    supabase,
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
  });

  const shouldGenerateAI = shouldGenerateAiAssessment({
    latestAssessment,
    nextDigestHash: digestResult.digest.digestHash,
    trigger: input.trigger,
  });
  const assessment = shouldGenerateAI
    ? await generateAccountSummaryWithAI({
        digest: digestResult.digest,
        state: digestResult.state,
      })
    : buildDeterministicAccountSummary({
        state: digestResult.state,
        digest: digestResult.digest,
      });

  return insertAdAccountAssessment(supabase, {
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccountId: input.adAccountId,
    state: digestResult.state,
    historyDays: digestResult.historyDays,
    hasDelivery: digestResult.hasDelivery,
    hasConversionSignal: digestResult.hasConversionSignal,
    trackingConfidence: digestResult.trackingConfidence,
    maturityScore: digestResult.maturityScore,
    digest: digestResult.digest,
    assessment,
    createdAt: new Date().toISOString(),
  });
}

export async function runBusinessAssessment(input: {
  supabase?: AssessmentClient;
  businessId: string;
  trigger: AssessmentTrigger;
}): Promise<BusinessAssessment> {
  const supabase = input.supabase ?? (await createServerClient());
  const accountAssessments = await listLatestAdAccountAssessmentsForBusiness(supabase, input.businessId);

  const totalSpendLast30d = accountAssessments.reduce(
    (total, assessment) => total + assessment.digest.weightedAverages.last30d.spend,
    0
  );
  const totalConversionLast30d = accountAssessments.reduce(
    (total, assessment) => total + assessment.digest.weightedAverages.last30d.conversion,
    0
  );
  const strongest = [...accountAssessments].sort((left, right) => {
    const rightScore =
      right.digest.weightedAverages.last30d.conversion * 100 - right.digest.weightedAverages.last30d.costPerResult;
    const leftScore =
      left.digest.weightedAverages.last30d.conversion * 100 - left.digest.weightedAverages.last30d.costPerResult;
    return rightScore - leftScore;
  })[0] ?? null;

  const budgetConcentration = accountAssessments
    .map((assessment) => ({
      platformIntegrationId: assessment.platformIntegrationId,
      adAccountId: assessment.adAccountId,
      shareOfSpend:
        totalSpendLast30d > 0
          ? Number(((assessment.digest.weightedAverages.last30d.spend / totalSpendLast30d) * 100).toFixed(2))
          : 0,
    }))
    .sort((left, right) => right.shareOfSpend - left.shareOfSpend);

  const primaryPlanningFlow = accountAssessments.length === 0
    ? 'launch'
    : accountAssessments.some((item) => item.state === 'misconfigured')
      ? 'fix_tracking'
      : accountAssessments.some((item) => item.state === 'stale')
        ? 'revive'
        : accountAssessments.some((item) => item.state === 'empty' || item.state === 'launch_ready')
          ? 'launch'
          : 'optimize';

  const digest: BusinessSynthesisDigest = {
    businessId: input.businessId,
    generatedAt: new Date().toISOString(),
    connectedIntegrationCount: accountAssessments.length,
    assessedAccountCount: accountAssessments.length,
    totalSpendLast30d: Number(totalSpendLast30d.toFixed(2)),
    totalConversionLast30d,
    accountStates: accountAssessments.map((assessment) => ({
      platformIntegrationId: assessment.platformIntegrationId,
      adAccountId: assessment.adAccountId,
      adAccountName: assessment.digest.adAccountName,
      platformLabel: assessment.digest.platformLabel,
      state: assessment.state,
      maturityScore: assessment.maturityScore,
      spendLast30d: Number(assessment.digest.weightedAverages.last30d.spend.toFixed(2)),
      conversionLast30d: assessment.digest.weightedAverages.last30d.conversion,
    })),
    strongestAccountId: strongest?.adAccountId ?? null,
    strongestPlatformIntegrationId: strongest?.platformIntegrationId ?? null,
    budgetConcentration,
    fragmentationRisk:
      budgetConcentration.length <= 1
        ? 'low'
        : (budgetConcentration[0]?.shareOfSpend ?? 0) >= 75
          ? 'medium'
          : 'high',
    primaryPlanningFlow,
  };

  const summary =
    input.trigger === 'manual' || input.trigger === 'integration' || input.trigger === 'material_change'
      ? await generateBusinessSummaryWithAI(digest)
      : buildDeterministicBusinessSummary(digest);

  return insertBusinessAssessment(supabase, {
    businessId: input.businessId,
    scope: 'business',
    digest,
    assessment: summary,
    createdAt: new Date().toISOString(),
  });
}

export async function getLatestAdAccountAssessment(input: {
  businessId: string;
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
}): Promise<AdAccountAssessment | null> {
  const supabase = await createServerClient();
  return getLatestAdAccountAssessmentRecord(supabase, input);
}

export async function getLatestBusinessAssessment(
  businessId: string
): Promise<BusinessAssessment | null> {
  const supabase = await createServerClient();
  return getLatestBusinessAssessmentRecord(supabase, businessId);
}
