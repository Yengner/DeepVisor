import 'server-only';

import { createServerClient } from '@/lib/server/supabase/server';
import {
  syncAdAccountSignals,
} from '../repositories/signals';
import type {
  AdAccountAssessment,
  AdAccountSignalDraft,
  MetaAccountIntelligenceArtifacts,
  RecommendedActionType,
} from '../types';

type AssessmentClient = Awaited<ReturnType<typeof createServerClient>>;

function buildBaseEvidence(
  assessment: AdAccountAssessment
): AdAccountSignalDraft['evidence'] {
  return {
    coverageStartDate: assessment.digest.coverageStartDate,
    coverageEndDate: assessment.digest.coverageEndDate,
    daysSinceLastActivity: assessment.digest.daysSinceLastActivity,
    trackingConfidence: assessment.digest.trackingConfidence,
    spendTrend: assessment.digest.spendTrend,
    resultTrend: assessment.digest.resultTrend,
    bestWindow30d: assessment.digest.bestWindow30d,
    bestWindow90d: assessment.digest.bestWindow90d,
    testingVelocity: assessment.digest.testingVelocity,
    creativeFatigueRisk: assessment.digest.creativeFatigueRisk,
    topCampaignIds: assessment.digest.topCampaigns.map((campaign) => campaign.id),
    topObjective: assessment.digest.topObjectives[0]?.objective ?? null,
  };
}

function buildRecommendedAction(input: {
  type: RecommendedActionType;
  label: string;
  href: string | null;
  destination: 'campaign_draft' | 'dashboard' | 'reports' | 'settings';
  draftSource?: 'historic_clone' | 'fresh_relaunch' | 'manual_defaults' | null;
  payload?: Record<string, unknown>;
}): AdAccountSignalDraft['recommendedAction'] {
  return {
    type: input.type,
    label: input.label,
    destination: input.destination,
    href: input.href,
    draftSource: input.draftSource ?? null,
    queueSuggested: true,
    payload: input.payload,
  };
}

function buildCreateAdHref(input: {
  campaignId?: string | null;
  adSetId?: string | null;
}): string | null {
  if (!input.adSetId) {
    return null;
  }

  const params = new URLSearchParams({
    scope: 'ad',
    adset_id: input.adSetId,
  });

  if (input.campaignId) {
    params.set('campaign_id', input.campaignId);
  }

  return `/campaigns/create?${params.toString()}`;
}

function buildCreateAdSetHref(campaignId?: string | null): string | null {
  if (!campaignId) {
    return null;
  }

  const params = new URLSearchParams({
    scope: 'adset',
    campaign_id: campaignId,
  });

  return `/campaigns/create?${params.toString()}`;
}

/**
 * Evaluates one deterministic signal set from the latest ad account digest.
 * This is the first product-ready layer on top of synced Meta history.
 */
export function evaluateMetaAccountSignals(
  assessment: AdAccountAssessment
): AdAccountSignalDraft[] {
  const digest = assessment.digest;
  const baseEvidence = buildBaseEvidence(assessment);
  const topCampaign = digest.topCampaigns[0] ?? null;
  const topAdSet = digest.topAdSets[0] ?? null;
  const createAdHref = buildCreateAdHref({
    campaignId: topCampaign?.id ?? null,
    adSetId: topAdSet?.id ?? null,
  });
  const createAdSetHref = buildCreateAdSetHref(topCampaign?.id ?? null);
  const signals: AdAccountSignalDraft[] = [];

  if ((digest.daysSinceLastActivity ?? 0) > 30 && digest.historyWindowAvailable.historyDays > 0) {
    signals.push({
      businessId: assessment.businessId,
      platformIntegrationId: assessment.platformIntegrationId,
      adAccountId: assessment.adAccountId,
      sourceAssessmentId: assessment.id,
      sourceDigestHash: digest.digestHash,
      signalType: 'dormant_account',
      severity:
        digest.staleSeverity === 'critical'
          ? 'critical'
          : digest.staleSeverity === 'stale'
            ? 'warning'
            : 'info',
      title: `Account delivery has been quiet for ${digest.daysSinceLastActivity} days`,
      reason:
        'The account has historical delivery but little recent activity, which makes it a candidate for a revive or rebuild workflow.',
      evidence: {
        ...baseEvidence,
        staleSeverity: digest.staleSeverity,
        topCampaignName: topCampaign?.name ?? null,
      },
      recommendedAction: buildRecommendedAction({
        type: 'review_report',
        label: 'Review historic account performance',
        href: '/reports',
        destination: 'reports',
      }),
    });
  }

  if (
    topCampaign &&
    (digest.daysSinceLastActivity ?? 0) > 30 &&
    (digest.bestWindow30d || digest.bestWindow90d)
  ) {
    signals.push({
      businessId: assessment.businessId,
      platformIntegrationId: assessment.platformIntegrationId,
      adAccountId: assessment.adAccountId,
      sourceAssessmentId: assessment.id,
      sourceDigestHash: digest.digestHash,
      signalType: 'revive_best_historic_winner',
      severity: digest.staleSeverity === 'critical' ? 'critical' : 'warning',
      title: `Revive ${topCampaign.name} as the best historic winner`,
      reason:
        'The account has enough historical structure to relaunch from a real winner instead of starting from a blank draft.',
      evidence: {
        ...baseEvidence,
        reviveCampaignId: topCampaign.id,
        reviveCampaignName: topCampaign.name,
        reviveAdSetId: topAdSet?.id ?? null,
        reviveAdSetName: topAdSet?.name ?? null,
        reviveWindow: digest.bestWindow30d ?? digest.bestWindow90d,
      },
      recommendedAction: buildRecommendedAction({
        type: 'revive_campaign',
        label: topAdSet ? `Add a fresh ad to ${topAdSet.name}` : 'Revive best historic winner',
        href: createAdHref ?? createAdSetHref ?? '/campaigns/create',
        destination: 'campaign_draft',
        draftSource: 'historic_clone',
        payload: {
          campaignId: topCampaign.id,
          campaignName: topCampaign.name,
          adSetId: topAdSet?.id ?? null,
          adSetName: topAdSet?.name ?? null,
        },
      }),
    });
  }

  const deterioratingEfficiency =
    digest.spendTrend.currentValue > 0 &&
    digest.resultTrend.direction === 'down' &&
    (digest.resultTrend.deltaPercent ?? 0) <= -20;

  if (deterioratingEfficiency) {
    signals.push({
      businessId: assessment.businessId,
      platformIntegrationId: assessment.platformIntegrationId,
      adAccountId: assessment.adAccountId,
      sourceAssessmentId: assessment.id,
      sourceDigestHash: digest.digestHash,
      signalType: 'efficiency_deterioration',
      severity: 'warning',
      title: 'Efficiency is deteriorating against the previous period',
      reason:
        'Recent spend is still active, but conversion output is trending down enough that budget, audience, or creative should be reviewed before scaling.',
      evidence: {
        ...baseEvidence,
        recentCostPerResult: digest.weightedAverages.last30d.costPerResult,
        previousSpend: digest.spendTrend.previousValue,
        previousResults: digest.resultTrend.previousValue,
      },
      recommendedAction: buildRecommendedAction({
        type: 'investigate_efficiency',
        label: 'Investigate efficiency drop',
        href: '/reports',
        destination: 'reports',
      }),
    });
  }

  if (
    digest.testingVelocity.label === 'none' ||
    (digest.testingVelocity.label === 'low' && digest.recentActivity.hasDeliveryLast30d)
  ) {
    signals.push({
      businessId: assessment.businessId,
      platformIntegrationId: assessment.platformIntegrationId,
      adAccountId: assessment.adAccountId,
      sourceAssessmentId: assessment.id,
      sourceDigestHash: digest.digestHash,
      signalType: 'no_recent_testing',
      severity: digest.testingVelocity.label === 'none' ? 'warning' : 'info',
      title:
        digest.testingVelocity.label === 'none'
          ? 'No recent testing activity detected'
          : 'Testing velocity is lower than expected',
      reason:
        'New campaign and ad set launches are limited relative to the recent delivery window, which reduces DeepVisor’s ability to find fresh winners.',
      evidence: {
        ...baseEvidence,
        testingVelocityLabel: digest.testingVelocity.label,
        activeDaysLast30d: digest.recentActivity.activeDaysLast30d,
        reviveCampaignId: topCampaign?.id ?? null,
        reviveCampaignName: topCampaign?.name ?? null,
        reviveAdSetId: topAdSet?.id ?? null,
        reviveAdSetName: topAdSet?.name ?? null,
      },
      recommendedAction: buildRecommendedAction({
        type: 'launch_test',
        label: topAdSet ? `Add a new ad to ${topAdSet.name}` : 'Launch a new test',
        href: createAdHref ?? '/campaigns/create',
        destination: 'campaign_draft',
        draftSource: 'fresh_relaunch',
        payload: {
          campaignId: topCampaign?.id ?? null,
          campaignName: topCampaign?.name ?? null,
          adSetId: topAdSet?.id ?? null,
          adSetName: topAdSet?.name ?? null,
        },
      }),
    });
  }

  const weakTracking =
    digest.trackingConfidence === 'low' ||
    (digest.conversionSignalQuality.label === 'none' &&
      digest.weightedAverages.last30d.clicks >= 50);

  if (weakTracking) {
    signals.push({
      businessId: assessment.businessId,
      platformIntegrationId: assessment.platformIntegrationId,
      adAccountId: assessment.adAccountId,
      sourceAssessmentId: assessment.id,
      sourceDigestHash: digest.digestHash,
      signalType: 'weak_tracking',
      severity: 'critical',
      title: 'Tracking confidence is too weak for reliable optimization',
      reason:
        'Clicks and spend are present, but the conversion signal is weak enough that winners and losers may be misleading until measurement quality improves.',
      evidence: {
        ...baseEvidence,
        conversionSignalLabel: digest.conversionSignalQuality.label,
        clicks30d: digest.conversionSignalQuality.clicks30d,
        linkClicks30d: digest.conversionSignalQuality.linkClicks30d,
      },
      recommendedAction: buildRecommendedAction({
        type: 'fix_tracking',
        label: 'Fix tracking quality',
        href: '/settings',
        destination: 'settings',
      }),
    });
  }

  return signals;
}

/**
 * Persists the deterministic signal set for one assessment. No sync or schedule calls
 * this today; see the intelligence README.
 */
export async function syncMetaAccountIntelligenceArtifacts(input: {
  supabase?: AssessmentClient;
  assessment: AdAccountAssessment;
}): Promise<MetaAccountIntelligenceArtifacts> {
  const supabase = input.supabase ?? (await createServerClient());
  const signalDrafts = evaluateMetaAccountSignals(input.assessment);
  const signals = await syncAdAccountSignals(supabase, {
    businessId: input.assessment.businessId,
    adAccountId: input.assessment.adAccountId,
    sourceDigestHash: input.assessment.digest.digestHash,
    drafts: signalDrafts,
  });
  return {
    assessment: input.assessment,
    signals,
  };
}
