import 'server-only';

import { createServerClient } from '@/lib/server/supabase/server';
import type { Database } from '@/lib/shared/types/supabase';
import {
  syncSignalCalendarQueueItems,
} from '../repositories/calendarQueue';
import {
  syncAdAccountSignals,
} from '../repositories/signals';
import type {
  AdAccountAssessment,
  AdAccountSignal,
  AdAccountSignalDraft,
  CalendarQueueChildBlueprint,
  CalendarQueueItem,
  CalendarQueueItemDraft,
  CalendarQueueWorkflowKind,
  MetaAccountIntelligenceArtifacts,
} from '../types';

type AssessmentClient = Awaited<ReturnType<typeof createServerClient>>;
type QueueItemType = CalendarQueueItem['itemType'];

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
  type: QueueItemType;
  label: string;
  href: string | null;
  destination: 'campaign_draft' | 'dashboard' | 'calendar' | 'reports' | 'settings';
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
        reviveWindow: digest.bestWindow30d ?? digest.bestWindow90d,
      },
      recommendedAction: buildRecommendedAction({
        type: 'revive_campaign',
        label: 'Revive best historic winner',
        href: '/campaigns/intelligence/create',
        destination: 'campaign_draft',
        draftSource: 'historic_clone',
        payload: {
          campaignId: topCampaign.id,
          campaignName: topCampaign.name,
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
      },
      recommendedAction: buildRecommendedAction({
        type: 'launch_test',
        label: 'Launch a new test',
        href: '/campaigns/intelligence/create',
        destination: 'campaign_draft',
        draftSource: 'fresh_relaunch',
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

function priorityFromSignals(signals: AdAccountSignal[]): CalendarQueueItem['priority'] {
  if (signals.some((signal) => signal.severity === 'critical')) {
    return 'critical';
  }

  if (signals.some((signal) => signal.severity === 'warning')) {
    return 'high';
  }

  return 'medium';
}

function childBlueprint(input: {
  key: string;
  itemType: CalendarQueueItem['itemType'];
  priority: CalendarQueueItem['priority'];
  title: string;
  description: string | null;
  destinationHref: string | null;
  payload?: Record<string, unknown>;
}): CalendarQueueChildBlueprint {
  return {
    key: input.key,
    itemType: input.itemType,
    priority: input.priority,
    title: input.title,
    description: input.description,
    destinationHref: input.destinationHref,
    payload: input.payload ?? {},
  };
}

function buildWorkflowQueueDraft(input: {
  kind: CalendarQueueWorkflowKind;
  itemType: CalendarQueueItem['itemType'];
  title: string;
  description: string;
  destinationHref: string | null;
  supportingSignals: AdAccountSignal[];
  childBlueprints: CalendarQueueChildBlueprint[];
}): CalendarQueueItemDraft {
  const primarySignal = input.supportingSignals[0] ?? null;

  return {
    businessId: primarySignal?.businessId ?? '',
    platformIntegrationId: primarySignal?.platformIntegrationId ?? '',
    adAccountId: primarySignal?.adAccountId ?? '',
    sourceSignalId: null,
    sourceType: 'signal',
    itemType: input.itemType,
    priority: priorityFromSignals(input.supportingSignals),
    title: input.title,
    description: input.description,
    destinationHref: input.destinationHref,
    workflowKey: input.kind,
    childBlueprints: input.childBlueprints,
    payload: {
      workflowKind: input.kind,
      supportingSignalIds: input.supportingSignals.map((signal) => signal.id),
      supportingSignalTypes: input.supportingSignals.map((signal) => signal.signalType),
      sourceDigestHash: primarySignal?.sourceDigestHash ?? null,
    },
  };
}

function buildQueueItemDraftsFromSignals(signals: AdAccountSignal[]): CalendarQueueItemDraft[] {
  const byType = new Map(
    signals.map((signal) => [signal.signalType, signal] satisfies [AdAccountSignal['signalType'], AdAccountSignal])
  );
  const dormantSignal = byType.get('dormant_account') ?? null;
  const reviveSignal = byType.get('revive_best_historic_winner') ?? null;
  const efficiencySignal = byType.get('efficiency_deterioration') ?? null;
  const testingSignal = byType.get('no_recent_testing') ?? null;
  const trackingSignal = byType.get('weak_tracking') ?? null;
  const queueDrafts: CalendarQueueItemDraft[] = [];
  const hasReviveWorkflow = Boolean(dormantSignal || reviveSignal);

  if (hasReviveWorkflow) {
    const topCampaignName =
      typeof reviveSignal?.evidence.reviveCampaignName === 'string'
        ? reviveSignal.evidence.reviveCampaignName
        : typeof dormantSignal?.evidence.topCampaignName === 'string'
          ? dormantSignal.evidence.topCampaignName
          : null;
    const supportingSignals = [
      dormantSignal,
      reviveSignal,
      trackingSignal,
      testingSignal,
    ].filter((signal): signal is AdAccountSignal => Boolean(signal));
    const childBlueprints: CalendarQueueChildBlueprint[] = [
      childBlueprint({
        key: 'review_report',
        itemType: 'review_report',
        priority: 'high',
        title: 'Review historic account performance',
        description: 'Confirm what period, offer, and campaign structure are worth carrying into the revive motion.',
        destinationHref: '/reports',
      }),
    ];

    if (trackingSignal) {
      childBlueprints.push(
        childBlueprint({
          key: 'fix_tracking',
          itemType: 'fix_tracking',
          priority: 'critical',
          title: 'Fix tracking quality before relaunch',
          description: 'Tighten measurement so the revive workflow can trust winners and losers.',
          destinationHref: '/settings',
        })
      );
    }

    if (reviveSignal) {
      childBlueprints.push(
        childBlueprint({
          key: 'revive_campaign',
          itemType: 'revive_campaign',
          priority: priorityFromSignals([reviveSignal]),
          title: 'Build the revive campaign draft',
          description: topCampaignName
            ? `Start from ${topCampaignName} as the best historic winner.`
            : 'Start from the strongest historic campaign structure.',
          destinationHref: '/campaigns/intelligence/create',
          payload: {
            draftSource: 'historic_clone',
            campaignId: reviveSignal.evidence.reviveCampaignId ?? null,
            campaignName: topCampaignName,
          },
        })
      );
    }

    if (testingSignal) {
      childBlueprints.push(
        childBlueprint({
          key: 'launch_test',
          itemType: 'launch_test',
          priority: 'high',
          title: 'Launch a fresh test alongside the revive',
          description: 'Add at least one fresh testing branch so the relaunch does not depend only on the old winner.',
          destinationHref: '/campaigns/intelligence/create',
          payload: {
            draftSource: 'fresh_relaunch',
          },
        })
      );
    }

    queueDrafts.push(
      buildWorkflowQueueDraft({
        kind: 'revive_workflow',
        itemType: 'revive_campaign',
        title: topCampaignName
          ? `Revive ${topCampaignName} with staged follow-up`
          : 'Run a guided revive workflow',
        description:
          'DeepVisor found enough historic signal to relaunch from a real winner, then layer in the review and remediation tasks that support the comeback.',
        destinationHref: '/calendar',
        supportingSignals,
        childBlueprints,
      })
    );
  }

  if (efficiencySignal && !hasReviveWorkflow) {
    const supportingSignals = [efficiencySignal, testingSignal].filter(
      (signal): signal is AdAccountSignal => Boolean(signal)
    );
    const childBlueprints: CalendarQueueChildBlueprint[] = [
      childBlueprint({
        key: 'investigate_efficiency',
        itemType: 'investigate_efficiency',
        priority: 'high',
        title: 'Investigate the efficiency drop',
        description: 'Review the recent spend and conversion change before scaling or editing budgets.',
        destinationHref: '/reports',
      }),
      childBlueprint({
        key: 'review_report',
        itemType: 'review_report',
        priority: 'medium',
        title: 'Review the recent report window',
        description: 'Compare the strongest and weakest recent periods before acting on the account.',
        destinationHref: '/reports',
      }),
      childBlueprint({
        key: 'refresh_creative',
        itemType: 'refresh_creative',
        priority: 'medium',
        title: 'Queue a creative refresh',
        description: 'Prepare a fresh creative angle to relieve fatigue while the account is being stabilized.',
        destinationHref: '/calendar',
      }),
    ];

    if (testingSignal) {
      childBlueprints.push(
        childBlueprint({
          key: 'launch_test',
          itemType: 'launch_test',
          priority: 'high',
          title: 'Launch a new controlled test',
          description: 'Add a new test branch so the account can relearn efficiently after the recent drop.',
          destinationHref: '/campaigns/intelligence/create',
          payload: {
            draftSource: 'fresh_relaunch',
          },
        })
      );
    }

    queueDrafts.push(
      buildWorkflowQueueDraft({
        kind: 'efficiency_workflow',
        itemType: 'investigate_efficiency',
        title: 'Run an efficiency remediation workflow',
        description:
          'DeepVisor sees a meaningful drop in conversion efficiency and wants to walk through the review, creative, and testing steps together.',
        destinationHref: '/calendar',
        supportingSignals,
        childBlueprints,
      })
    );
  }

  if (trackingSignal && !hasReviveWorkflow) {
    queueDrafts.push(
      buildWorkflowQueueDraft({
        kind: 'tracking_workflow',
        itemType: 'fix_tracking',
        title: 'Repair tracking before trusting optimization',
        description:
          'DeepVisor wants measurement quality corrected first so later campaign decisions are based on reliable signal.',
        destinationHref: '/calendar',
        supportingSignals: [trackingSignal],
        childBlueprints: [
          childBlueprint({
            key: 'fix_tracking',
            itemType: 'fix_tracking',
            priority: 'critical',
            title: 'Fix tracking quality',
            description: 'Review pixel, offline conversion, and CRM handoff quality before changing campaigns.',
            destinationHref: '/settings',
          }),
          childBlueprint({
            key: 'review_report',
            itemType: 'review_report',
            priority: 'medium',
            title: 'Review the measurement gap in reports',
            description: 'Compare clicks, link clicks, and conversions to locate the measurement blind spot.',
            destinationHref: '/reports',
          }),
        ],
      })
    );
  }

  if (testingSignal && !hasReviveWorkflow && !efficiencySignal) {
    queueDrafts.push(
      buildWorkflowQueueDraft({
        kind: 'testing_workflow',
        itemType: 'launch_test',
        title: 'Restart testing velocity in this account',
        description:
          'DeepVisor wants to restore recent testing activity so the account can uncover fresh winners instead of relying on stale structure.',
        destinationHref: '/calendar',
        supportingSignals: [testingSignal],
        childBlueprints: [
          childBlueprint({
            key: 'launch_test',
            itemType: 'launch_test',
            priority: 'high',
            title: 'Launch a new test',
            description: 'Open a fresh branch with a controlled budget and one clear variable to learn from.',
            destinationHref: '/campaigns/intelligence/create',
            payload: {
              draftSource: 'fresh_relaunch',
            },
          }),
          childBlueprint({
            key: 'review_report',
            itemType: 'review_report',
            priority: 'medium',
            title: 'Review the recent testing gap',
            description: 'Look at the recent account history before deciding which hypothesis to test first.',
            destinationHref: '/reports',
          }),
        ],
      })
    );
  }

  return queueDrafts.filter((draft) => draft.businessId && draft.adAccountId);
}

/**
 * Persists the deterministic signal set and the first queue-item layer derived
 * from it so dashboard, calendar, and revive flows can all reuse the same
 * source of truth.
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
  const queueItems = await syncSignalCalendarQueueItems(supabase, {
    businessId: input.assessment.businessId,
    adAccountId: input.assessment.adAccountId,
    drafts: buildQueueItemDraftsFromSignals(signals),
  });

  return {
    assessment: input.assessment,
    signals,
    queueItems,
  };
}
