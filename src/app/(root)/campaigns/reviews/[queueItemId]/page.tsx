import { notFound } from 'next/navigation';
import { asRecord } from '@/lib/shared';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import CampaignReviewClient from './CampaignReviewClient';
import type {
  CampaignReviewEntityView,
  CampaignReviewFindingView,
  CampaignReviewMetricsView,
  CampaignReviewViewModel,
} from './types';

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function normalizeMetrics(value: unknown): CampaignReviewMetricsView {
  const record = asRecord(value);

  return {
    spend: numberValue(record.spend),
    reach: numberValue(record.reach),
    impressions: numberValue(record.impressions),
    clicks: numberValue(record.clicks),
    linkClicks: numberValue(record.linkClicks),
    leads: numberValue(record.leads),
    messages: numberValue(record.messages),
    calls: numberValue(record.calls),
    results: numberValue(record.results),
    ctr: numberValue(record.ctr),
    cpc: numberValue(record.cpc),
    cpm: numberValue(record.cpm),
    frequency: numberValue(record.frequency),
    costPerResult: numberValue(record.costPerResult),
  };
}

function normalizeLevel(value: unknown): CampaignReviewEntityView['level'] {
  return value === 'campaign' || value === 'adset' || value === 'ad' ? value : 'unknown';
}

function normalizeEntity(value: unknown): CampaignReviewEntityView {
  const record = asRecord(value);
  const level = normalizeLevel(record.level);
  const name = stringValue(record.name) ?? `Unnamed ${level === 'unknown' ? 'entity' : level}`;

  return {
    id: stringValue(record.id),
    externalId: stringValue(record.externalId),
    level,
    name,
    status: stringValue(record.status),
    objective: stringValue(record.objective),
    campaignId: stringValue(record.campaignId),
    adsetId: stringValue(record.adsetId),
    firstDay: stringValue(record.firstDay),
    lastDay: stringValue(record.lastDay),
    lifetime: normalizeMetrics(record.lifetime),
    recent: normalizeMetrics(record.recent),
    previous: normalizeMetrics(record.previous),
  };
}

function normalizeEntities(value: unknown): CampaignReviewEntityView[] {
  return Array.isArray(value) ? value.map(normalizeEntity) : [];
}

function normalizeSeverity(value: unknown): CampaignReviewFindingView['severity'] {
  return value === 'critical' || value === 'warning' || value === 'info' ? value : 'info';
}

function normalizeFinding(value: unknown): CampaignReviewFindingView {
  const record = asRecord(value);

  return {
    severity: normalizeSeverity(record.severity),
    title: stringValue(record.title) ?? 'Campaign review finding',
    summary: stringValue(record.summary) ?? 'No finding summary was provided.',
    reason: stringValue(record.reason),
    reportHref: stringValue(record.reportHref),
    campaignId: stringValue(record.campaignId),
    campaignExternalId: stringValue(record.campaignExternalId),
    campaignName: stringValue(record.campaignName),
  };
}

function normalizeFindings(value: unknown): CampaignReviewFindingView[] {
  return Array.isArray(value) ? value.map(normalizeFinding) : [];
}

function normalizeScope(value: unknown): CampaignReviewViewModel['scope'] {
  return value === 'active_recent' || value === 'specific_campaign' ? value : 'unknown';
}

function scopeLabel(scope: CampaignReviewViewModel['scope']): string {
  switch (scope) {
    case 'active_recent':
      return 'Active recent campaigns';
    case 'specific_campaign':
      return 'Specific campaign';
    default:
      return 'Campaign review';
  }
}

function buildReviewViewModel(input: {
  row: {
    id: string;
    title: string;
    item_type: string;
    status: string;
    scheduled_for: string | null;
    completed_at: string | null;
    payload_json: unknown;
  };
}): CampaignReviewViewModel {
  const payload = asRecord(input.row.payload_json);
  const execution = asRecord(payload.execution);
  const action = asRecord(execution.action);
  const campaignReviewConfig = asRecord(payload.campaignReview);
  const actionType = stringValue(action.type);
  const executionStatus = stringValue(execution.status);
  const completed = input.row.status === 'completed' && actionType === 'campaign_review';
  const failed = !completed && executionStatus === 'failed';
  const scope = normalizeScope(action.scope ?? campaignReviewConfig.scope);
  const campaignRankings = normalizeEntities(action.campaignRankings);
  const findings = normalizeFindings(action.findings);
  const reviewedCampaignCount = numberValue(
    action.reviewedCampaignCount ?? campaignRankings.length
  );

  return {
    queueItemId: input.row.id,
    title: input.row.title || 'Campaign review',
    rawStatus: input.row.status || 'unknown',
    state: completed ? 'completed' : failed ? 'failed' : 'pending',
    scheduledFor: input.row.scheduled_for,
    completedAt: input.row.completed_at,
    generatedAt: stringValue(action.generatedAt),
    processedAt: stringValue(execution.processedAt ?? execution.failedAt),
    currencyCode: stringValue(action.currencyCode),
    scope,
    scopeLabel: scopeLabel(scope),
    aiGenerated: action.aiGenerated === true,
    aiRunId: stringValue(action.aiRunId),
    promptVersion: stringValue(action.promptVersion),
    fallbackReason: stringValue(action.fallbackReason),
    decisionSupportVersion: stringValue(action.decisionSupportVersion),
    reviewedCampaignCount,
    unavailableCampaign: stringValue(action.unavailableCampaign),
    errorMessage: stringValue(execution.error),
    summary: stringValue(action.summary),
    highlights: stringArray(action.highlights),
    risks: stringArray(action.risks),
    nextSteps: stringArray(action.nextSteps),
    operatorNotes: stringArray(action.operatorNotes),
    findings,
    campaignRankings,
    adsetRankings: normalizeEntities(action.adsetRankings),
    adRankings: normalizeEntities(action.adRankings),
  };
}

export default async function CampaignReviewPage({
  params,
}: {
  params: Promise<{ queueItemId: string }>;
}) {
  const { businessId, user } = await getRequiredAppContext();
  const { queueItemId } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('calendar_queue_items')
    .select('id,title,item_type,status,scheduled_for,completed_at,created_by_user_id,payload_json')
    .eq('business_id', businessId)
    .eq('id', queueItemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    notFound();
  }

  if (data.created_by_user_id && data.created_by_user_id !== user.id) {
    notFound();
  }

  const payload = asRecord(data.payload_json);
  const execution = asRecord(payload.execution);
  const action = asRecord(execution.action);
  const isCampaignReviewItem =
    data.item_type === 'campaign_review' ||
    payload.templateType === 'campaign_review' ||
    action.type === 'campaign_review';

  if (!isCampaignReviewItem) {
    notFound();
  }

  return (
    <CampaignReviewClient
      review={buildReviewViewModel({
        row: data,
      })}
    />
  );
}
