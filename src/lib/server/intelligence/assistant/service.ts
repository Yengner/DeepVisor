import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { listActiveTrendFindings } from '../repositories/trendFindings';
import type { AdAccountAssessment, TrendFinding } from '../types';

type IntelligenceClient = SupabaseClient<Database>;

type AssistantIntent =
  | 'best_creative'
  | 'best_months'
  | 'best_times'
  | 'top_risks'
  | 'what_changed_recently'
  | 'what_matters_now';

type AdPerformanceSummaryRow = {
  ad_id: string;
  adset_id: string | null;
  campaign_id: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  messages: number;
  calls: number;
  ctr: number | null;
  cost_per_result: number | null;
};

type AdDimensionRow = {
  id: string;
  name: string | null;
};

type CampaignDailyRow = {
  day: string;
  spend: number;
  clicks: number;
  impressions: number;
  leads: number;
  messages: number;
  calls: number;
};

type CampaignDimensionRow = {
  id: string;
};

function getResults(input: { leads?: number | null; messages?: number | null; calls?: number | null }): number {
  return (input.leads ?? 0) + (input.messages ?? 0) + (input.calls ?? 0);
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value > 0 && value < 100 ? 2 : 0,
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatMonth(value: string): string {
  const date = new Date(`${value}-01T00:00:00Z`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function classifyIntent(question: string): AssistantIntent {
  const normalized = question.trim().toLowerCase();

  if (normalized.includes('creative') || normalized.includes('ad creative') || normalized.includes('best ad')) {
    return 'best_creative';
  }

  if (normalized.includes('month')) {
    return 'best_months';
  }

  if (normalized.includes('time') || normalized.includes('hour') || normalized.includes('when')) {
    return 'best_times';
  }

  if (normalized.includes('risk') || normalized.includes('problem') || normalized.includes('watch')) {
    return 'top_risks';
  }

  if (normalized.includes('change') || normalized.includes('changed') || normalized.includes('recent')) {
    return 'what_changed_recently';
  }

  return 'what_matters_now';
}

async function getBestCreativeAnswer(
  supabase: IntelligenceClient,
  input: {
    adAccountId: string;
  }
): Promise<string> {
  const { data: summaryRows, error: summaryError } = await (supabase as any)
    .from('ad_performance_summary')
    .select('ad_id, adset_id, campaign_id, spend, impressions, clicks, leads, messages, calls, ctr, cost_per_result')
    .eq('ad_account_id', input.adAccountId);

  if (summaryError) {
    throw summaryError;
  }

  const summaries = (summaryRows ?? []) as AdPerformanceSummaryRow[];
  if (summaries.length === 0) {
    return 'No ad creative history is available yet for the selected account.';
  }

  const ranked = summaries
    .map((row) => ({
      ...row,
      results: getResults(row),
      ctr: row.ctr ?? (row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0),
      costPerResult:
        row.cost_per_result ?? (getResults(row) > 0 ? row.spend / getResults(row) : 0),
    }))
    .filter((row) => row.spend > 0 || row.impressions > 0)
    .sort(
      (left, right) =>
        right.results - left.results ||
        left.costPerResult - right.costPerResult ||
        right.ctr - left.ctr ||
        right.spend - left.spend
    );

  const best = ranked[0];
  if (!best) {
    return 'No ranked ad creative could be identified yet for the selected account.';
  }

  const { data: adRows, error: adError } = await (supabase as any)
    .from('ad_dims')
    .select('id, name')
    .eq('id', best.ad_id)
    .limit(1);

  if (adError) {
    throw adError;
  }

  const ad = ((adRows ?? []) as AdDimensionRow[])[0];

  return [
    `${ad?.name ?? 'This ad'} is the strongest creative in the selected account right now.`,
    `It produced ${best.results} results from ${formatCurrency(best.spend)} spend with ${formatPercent(best.ctr)} CTR.`,
    best.results > 0
      ? `Current cost per result is ${formatCurrency(best.costPerResult)}.`
      : `It has not converted into enough result signal yet, so the read is still mostly delivery-based.`,
  ].join(' ');
}

async function getBestMonthsAnswer(
  supabase: IntelligenceClient,
  input: {
    adAccountId: string;
  }
): Promise<string> {
  const { data: campaignRows, error: campaignError } = await (supabase as any)
    .from('campaign_dims')
    .select('id')
    .eq('ad_account_id', input.adAccountId);

  if (campaignError) {
    throw campaignError;
  }

  const campaignIds = ((campaignRows ?? []) as CampaignDimensionRow[]).map((row) => row.id);
  if (campaignIds.length === 0) {
    return 'No campaign history is available yet for a month-by-month comparison.';
  }

  const rows: CampaignDailyRow[] = [];
  for (const chunk of Array.from({ length: Math.ceil(campaignIds.length / 100) }, (_, index) =>
    campaignIds.slice(index * 100, index * 100 + 100)
  )) {
    const { data, error } = await (supabase as any)
      .from('campaigns_performance_daily')
      .select('day, spend, clicks, impressions, leads, messages, calls')
      .in('campaign_id', chunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as CampaignDailyRow[]));
  }

  if (rows.length === 0) {
    return 'No daily campaign history is available yet for month-level comparisons.';
  }

  const months = new Map<
    string,
    {
      spend: number;
      results: number;
      clicks: number;
      impressions: number;
    }
  >();

  for (const row of rows) {
    const monthKey = row.day.slice(0, 7);
    const current = months.get(monthKey) ?? {
      spend: 0,
      results: 0,
      clicks: 0,
      impressions: 0,
    };
    current.spend += row.spend;
    current.results += getResults(row);
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    months.set(monthKey, current);
  }

  const ranked = Array.from(months.entries())
    .map(([month, metrics]) => ({
      month,
      ...metrics,
      ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
      costPerResult: metrics.results > 0 ? metrics.spend / metrics.results : 0,
    }))
    .sort(
      (left, right) =>
        right.results - left.results ||
        left.costPerResult - right.costPerResult ||
        right.ctr - left.ctr
    )
    .slice(0, 3);

  if (ranked.length === 0) {
    return 'No monthly performance leaders could be identified yet.';
  }

  const top = ranked[0];
  const extras =
    ranked.length > 1
      ? ` Next strongest months were ${ranked
          .slice(1)
          .map((item) => `${formatMonth(item.month)} (${item.results} results)`)
          .join(' and ')}.`
      : '';

  return `${formatMonth(top.month)} was the strongest month with ${top.results} results from ${formatCurrency(
    top.spend
  )} spend and ${formatCurrency(top.costPerResult)} cost per result.${extras}`;
}

function getBestTimesAnswer(findings: TrendFinding[]): string {
  const bestTimeFinding = findings.find((finding) => finding.findingType === 'best_time_window');
  if (!bestTimeFinding) {
    return 'DeepVisor does not have a high-confidence recurring best-time pattern yet for the selected account.';
  }

  const slot = String(bestTimeFinding.metricSnapshot.label ?? 'the current best recurring slot');
  const metricLabel = String(bestTimeFinding.metricSnapshot.metricLabel ?? 'response');
  const averageMetric = Number(bestTimeFinding.metricSnapshot.averageMetric ?? 0);

  return `${slot} is the strongest recurring ${metricLabel.toLowerCase()} block right now. Average signal is ${averageMetric.toFixed(
    2
  )} per recurring slot, and the current confidence is ${bestTimeFinding.confidence}.`;
}

function getTopRisksAnswer(findings: TrendFinding[], assessment: AdAccountAssessment | null): string {
  const risks = findings.filter(
    (finding) => finding.severity === 'critical' || finding.severity === 'warning'
  );

  if (risks.length > 0) {
    return risks
      .slice(0, 3)
      .map((risk, index) => `${index + 1}. ${risk.title} ${risk.summary}`)
      .join('\n');
  }

  if (assessment?.assessment.risks?.length) {
    return assessment.assessment.risks.slice(0, 3).map((risk, index) => `${index + 1}. ${risk}`).join('\n');
  }

  return 'No major high-confidence risks are active right now for the selected account.';
}

function getWhatChangedAnswer(findings: TrendFinding[]): string {
  if (findings.length === 0) {
    return 'No meaningful recent trend change has been persisted yet for the selected account.';
  }

  const newest = findings[0];
  return `${newest.title} ${newest.summary}`;
}

function getWhatMattersNowAnswer(findings: TrendFinding[], assessment: AdAccountAssessment | null): string {
  if (findings.length > 0) {
    const primary = findings[0];
    return `${primary.title} ${primary.summary}${
      primary.recommendedAction?.label ? ` Next step: ${primary.recommendedAction.label}.` : ''
    }`;
  }

  if (assessment) {
    return assessment.assessment.summary;
  }

  return 'The selected account is connected, but DeepVisor still needs more synced context before it can answer with confidence.';
}

export async function answerAssistantQuestion(input: {
  supabase: IntelligenceClient;
  businessId: string;
  adAccountId: string;
  question: string;
  latestSelectedAssessment: AdAccountAssessment | null;
}): Promise<string> {
  const findings = await listActiveTrendFindings(input.supabase, {
    businessId: input.businessId,
    adAccountId: input.adAccountId,
  });
  const intent = classifyIntent(input.question);

  switch (intent) {
    case 'best_creative':
      return getBestCreativeAnswer(input.supabase, {
        adAccountId: input.adAccountId,
      });
    case 'best_months':
      return getBestMonthsAnswer(input.supabase, {
        adAccountId: input.adAccountId,
      });
    case 'best_times':
      return getBestTimesAnswer(findings);
    case 'top_risks':
      return getTopRisksAnswer(findings, input.latestSelectedAssessment);
    case 'what_changed_recently':
      return getWhatChangedAnswer(findings);
    case 'what_matters_now':
    default:
      return getWhatMattersNowAnswer(findings, input.latestSelectedAssessment);
  }
}
