import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import type {
  TrendFinding,
  TrendFindingDraft,
  TrendFindingRecommendedAction,
  TrendFindingView,
} from '../types';

type IntelligenceClient = SupabaseClient<Database>;

type TrendFindingRow = {
  id: string;
  business_id: string;
  platform_integration_id: string;
  ad_account_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  finding_type: string;
  severity: string;
  confidence: string;
  status: string;
  title: string;
  summary: string;
  reason: string | null;
  metric_snapshot_json: unknown;
  recommended_action_json: unknown;
  snapshot_hash: string;
  dedupe_key: string;
  detected_at: string;
  first_detected_at: string;
  last_detected_at: string;
  resolved_at: string | null;
  dismissed_at: string | null;
  converted_to_queue_at: string | null;
  created_at: string;
  updated_at: string;
};

type TrendFindingInsert = {
  business_id: string;
  platform_integration_id: string;
  ad_account_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  finding_type: string;
  severity: string;
  confidence: string;
  status: string;
  title: string;
  summary: string;
  reason: string | null;
  metric_snapshot_json: unknown;
  recommended_action_json: unknown;
  snapshot_hash: string;
  dedupe_key: string;
  detected_at: string;
  first_detected_at: string;
  last_detected_at: string;
  updated_at: string;
};

function mapTrendFindingRow(row: TrendFindingRow): TrendFinding {
  return {
    id: row.id,
    businessId: row.business_id,
    platformIntegrationId: row.platform_integration_id,
    adAccountId: row.ad_account_id,
    campaignId: row.campaign_id,
    adsetId: row.adset_id,
    adId: row.ad_id,
    findingType: row.finding_type as TrendFinding['findingType'],
    severity: row.severity as TrendFinding['severity'],
    confidence: row.confidence as TrendFinding['confidence'],
    status: row.status as TrendFinding['status'],
    title: row.title,
    summary: row.summary,
    reason: row.reason,
    metricSnapshot: asRecord(row.metric_snapshot_json) as TrendFinding['metricSnapshot'],
    recommendedAction: (asRecord(
      row.recommended_action_json
    ) as unknown as TrendFindingRecommendedAction) ?? null,
    snapshotHash: row.snapshot_hash,
    dedupeKey: row.dedupe_key,
    detectedAt: row.detected_at,
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
    resolvedAt: row.resolved_at,
    dismissedAt: row.dismissed_at,
    convertedToQueueAt: row.converted_to_queue_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInsert(draft: TrendFindingDraft, now: string): TrendFindingInsert {
  return {
    business_id: draft.businessId,
    platform_integration_id: draft.platformIntegrationId,
    ad_account_id: draft.adAccountId,
    campaign_id: draft.campaignId,
    adset_id: draft.adsetId,
    ad_id: draft.adId,
    finding_type: draft.findingType,
    severity: draft.severity,
    confidence: draft.confidence,
    status: 'active',
    title: draft.title,
    summary: draft.summary,
    reason: draft.reason,
    metric_snapshot_json: draft.metricSnapshot,
    recommended_action_json: draft.recommendedAction ?? {},
    snapshot_hash: draft.snapshotHash,
    dedupe_key: draft.dedupeKey,
    detected_at: draft.detectedAt,
    first_detected_at: now,
    last_detected_at: draft.detectedAt,
    updated_at: now,
  };
}

export async function listActiveTrendFindings(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
  }
): Promise<TrendFinding[]> {
  const { data, error } = await (supabase as any)
    .schema('ai')
    .from('trend_findings')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('ad_account_id', input.adAccountId)
    .eq('status', 'active')
    .order('severity', { ascending: false })
    .order('detected_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TrendFindingRow[]).map(mapTrendFindingRow);
}

export async function listTrendFindingsForBusiness(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId?: string | null;
    status?: TrendFinding['status'] | 'all';
    limit?: number;
  }
): Promise<TrendFinding[]> {
  let query = (supabase as any)
    .schema('ai')
    .from('trend_findings')
    .select('*')
    .eq('business_id', input.businessId)
    .order('detected_at', { ascending: false });

  if (input.adAccountId) {
    query = query.eq('ad_account_id', input.adAccountId);
  }

  if (input.status && input.status !== 'all') {
    query = query.eq('status', input.status);
  }

  if (typeof input.limit === 'number' && input.limit > 0) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as TrendFindingRow[]).map(mapTrendFindingRow);
}

export async function syncTrendFindings(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
    drafts: TrendFindingDraft[];
  }
): Promise<TrendFinding[]> {
  const now = new Date().toISOString();
  const { data: existingRows, error: existingError } = await (supabase as any)
    .schema('ai')
    .from('trend_findings')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('ad_account_id', input.adAccountId)
    .in('status', ['active', 'dismissed', 'converted_to_queue']);

  if (existingError) {
    throw existingError;
  }

  const existingByDedupeKey = new Map<string, TrendFindingRow>();
  for (const row of (existingRows ?? []) as TrendFindingRow[]) {
    existingByDedupeKey.set(row.dedupe_key, row);
  }

  const incomingKeys = new Set(input.drafts.map((draft) => draft.dedupeKey));
  const staleIds = ((existingRows ?? []) as TrendFindingRow[])
    .filter((row) => row.status === 'active' && !incomingKeys.has(row.dedupe_key))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error: resolveError } = await (supabase as any)
      .schema('ai')
      .from('trend_findings')
      .update({
        status: 'resolved',
        resolved_at: now,
        updated_at: now,
      })
      .in('id', staleIds);

    if (resolveError) {
      throw resolveError;
    }
  }

  const upsertRows = input.drafts.map((draft) => {
    const existing = existingByDedupeKey.get(draft.dedupeKey);
    const reactivated =
      existing?.status === 'dismissed' && existing.snapshot_hash !== draft.snapshotHash;

    return {
      ...toInsert(draft, now),
      status:
        existing?.status === 'dismissed' && !reactivated
          ? 'dismissed'
          : existing?.status === 'converted_to_queue'
            ? 'converted_to_queue'
            : 'active',
      first_detected_at: existing?.first_detected_at ?? now,
      dismissed_at:
        existing?.status === 'dismissed' && !reactivated ? existing.dismissed_at : null,
      converted_to_queue_at:
        existing?.status === 'converted_to_queue' ? existing.converted_to_queue_at : null,
      resolved_at: null,
    };
  });

  if (upsertRows.length === 0) {
    return [];
  }

  const { data, error } = await (supabase as any)
    .schema('ai')
    .from('trend_findings')
    .upsert(upsertRows, {
      onConflict: 'business_id,ad_account_id,dedupe_key',
    })
    .select('*');

  if (error) {
    throw error;
  }

  return ((data ?? []) as TrendFindingRow[]).map(mapTrendFindingRow);
}

export async function getTrendFindingById(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    findingId: string;
  }
): Promise<TrendFinding | null> {
  const { data, error } = await (supabase as any)
    .schema('ai')
    .from('trend_findings')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('id', input.findingId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapTrendFindingRow(data as TrendFindingRow) : null;
}

export async function dismissTrendFinding(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    findingId: string;
  }
): Promise<TrendFinding | null> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .schema('ai')
    .from('trend_findings')
    .update({
      status: 'dismissed',
      dismissed_at: now,
      updated_at: now,
    })
    .eq('business_id', input.businessId)
    .eq('id', input.findingId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapTrendFindingRow(data as TrendFindingRow) : null;
}

export async function markTrendFindingConvertedToQueue(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    findingId: string;
  }
): Promise<TrendFinding | null> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .schema('ai')
    .from('trend_findings')
    .update({
      status: 'converted_to_queue',
      converted_to_queue_at: now,
      updated_at: now,
    })
    .eq('business_id', input.businessId)
    .eq('id', input.findingId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapTrendFindingRow(data as TrendFindingRow) : null;
}

export function toTrendFindingView(finding: TrendFinding): TrendFindingView {
  return {
    id: finding.id,
    findingType: finding.findingType,
    severity: finding.severity,
    confidence: finding.confidence,
    status: finding.status,
    title: finding.title,
    summary: finding.summary,
    reason: finding.reason,
    adsetId: finding.adsetId,
    campaignId: finding.campaignId,
    detectedAt: finding.detectedAt,
    metricSnapshot: finding.metricSnapshot,
    actionLabel: finding.recommendedAction?.label ?? null,
    actionHref: finding.recommendedAction?.href ?? null,
    reportHref: finding.recommendedAction?.reportHref ?? finding.recommendedAction?.href ?? null,
  };
}
