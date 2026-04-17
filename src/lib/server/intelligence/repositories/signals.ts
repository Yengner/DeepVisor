import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import type {
  AdAccountSignal,
  AdAccountSignalDraft,
  AdAccountSignalRecommendedAction,
} from '../types';

type IntelligenceClient = SupabaseClient<Database>;
type SignalRow = Database['ai']['Tables']['ad_account_signals']['Row'];
type SignalInsert = Database['ai']['Tables']['ad_account_signals']['Insert'];
const SIGNAL_SCHEMA = 'intelligence';

function mapSignalRow(row: SignalRow): AdAccountSignal {
  return {
    id: row.id,
    businessId: row.business_id,
    platformIntegrationId: row.platform_integration_id,
    adAccountId: row.ad_account_id,
    sourceAssessmentId: row.source_assessment_id,
    sourceDigestHash: row.source_digest_hash,
    signalType: row.signal_type as AdAccountSignal['signalType'],
    severity: row.severity as AdAccountSignal['severity'],
    status: row.status as AdAccountSignal['status'],
    title: row.title,
    reason: row.reason,
    evidence: asRecord(row.evidence_json) as AdAccountSignal['evidence'],
    recommendedAction: asRecord(
      row.recommended_action_json
    ) as unknown as AdAccountSignalRecommendedAction,
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSignalInsert(
  draft: AdAccountSignalDraft,
  timestamp: string
): SignalInsert {
  return {
    business_id: draft.businessId,
    platform_integration_id: draft.platformIntegrationId,
    ad_account_id: draft.adAccountId,
    source_assessment_id: draft.sourceAssessmentId,
    source_digest_hash: draft.sourceDigestHash,
    signal_type: draft.signalType,
    severity: draft.severity,
    status: 'active',
    title: draft.title,
    reason: draft.reason,
    evidence_json: draft.evidence as SignalInsert['evidence_json'],
    recommended_action_json:
      draft.recommendedAction as unknown as SignalInsert['recommended_action_json'],
    first_detected_at: timestamp,
    last_detected_at: timestamp,
    updated_at: timestamp,
  };
}

/**
 * Lists the latest active signals for one ad account so product surfaces can
 * render attention items without rescanning assessments.
 */
export async function listActiveAdAccountSignals(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
  }
): Promise<AdAccountSignal[]> {
  const { data, error } = await (supabase as any)
    .schema(SIGNAL_SCHEMA)
    .from('ad_account_signals')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('ad_account_id', input.adAccountId)
    .eq('status', 'active')
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SignalRow[]).map(mapSignalRow);
}

/**
 * Replaces the active signal set for one digest snapshot. Older active signals
 * from previous digests are resolved, while the new digest's findings are
 * upserted idempotently on `(ad_account_id, signal_type, source_digest_hash)`.
 */
export async function syncAdAccountSignals(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
    sourceDigestHash: string;
    drafts: AdAccountSignalDraft[];
  }
): Promise<AdAccountSignal[]> {
  const timestamp = new Date().toISOString();

  const { error: resolveError } = await (supabase as any)
    .schema(SIGNAL_SCHEMA)
    .from('ad_account_signals')
    .update({
      status: 'resolved',
      resolved_at: timestamp,
      updated_at: timestamp,
    })
    .eq('business_id', input.businessId)
    .eq('ad_account_id', input.adAccountId)
    .eq('status', 'active')
    .neq('source_digest_hash', input.sourceDigestHash);

  if (resolveError) {
    throw resolveError;
  }

  if (input.drafts.length === 0) {
    return [];
  }

  const rows = input.drafts.map((draft) => toSignalInsert(draft, timestamp));
  const { data, error } = await (supabase as any)
    .schema(SIGNAL_SCHEMA)
    .from('ad_account_signals')
    .upsert(rows, {
      onConflict: 'ad_account_id,signal_type,source_digest_hash',
    })
    .select('*');

  if (error) {
    throw error;
  }

  return ((data ?? []) as SignalRow[]).map(mapSignalRow);
}
