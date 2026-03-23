import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import type {
  AdAccountAssessment,
  AdAccountAssessmentRow,
  AdAccountAssessmentSummary,
  AdAccountDigest,
  BusinessAssessment,
  BusinessAssessmentRow,
  BusinessAssessmentSummary,
  BusinessSynthesisDigest,
} from '../types';

type AssessmentClient = SupabaseClient<Database>;
type AdAccountAssessmentInsert =
  Database['public']['Tables']['ad_account_assessments']['Insert'];
type BusinessAssessmentInsert =
  Database['public']['Tables']['business_assessments']['Insert'];

function mapAdAccountAssessment(row: AdAccountAssessmentRow): AdAccountAssessment {
  return {
    id: row.id,
    businessId: row.business_id,
    platformIntegrationId: row.platform_integration_id,
    adAccountId: row.ad_account_id,
    state: row.state as AdAccountAssessment['state'],
    historyDays: row.history_days,
    hasDelivery: row.has_delivery,
    hasConversionSignal: row.has_conversion_signal,
    trackingConfidence: row.tracking_confidence as AdAccountAssessment['trackingConfidence'],
    maturityScore: Number(row.maturity_score ?? 0),
    digest: asRecord(row.digest_json) as unknown as AdAccountDigest,
    assessment: asRecord(row.assessment_json) as unknown as AdAccountAssessmentSummary,
    createdAt: row.created_at,
  };
}

function mapBusinessAssessment(row: BusinessAssessmentRow): BusinessAssessment {
  return {
    id: row.id,
    businessId: row.business_id,
    scope: 'business',
    digest: asRecord(row.digest_json) as unknown as BusinessSynthesisDigest,
    assessment: asRecord(row.assessment_json) as unknown as BusinessAssessmentSummary,
    createdAt: row.created_at,
  };
}

export async function insertAdAccountAssessment(
  supabase: AssessmentClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    state: AdAccountAssessment['state'];
    historyDays: number;
    hasDelivery: boolean;
    hasConversionSignal: boolean;
    trackingConfidence: AdAccountAssessment['trackingConfidence'];
    maturityScore: number;
    digest: AdAccountDigest;
    assessment: AdAccountAssessmentSummary;
    createdAt: string;
  }
): Promise<AdAccountAssessment> {
  const payload: AdAccountAssessmentInsert = {
    business_id: input.businessId,
    platform_integration_id: input.platformIntegrationId,
    ad_account_id: input.adAccountId,
    state: input.state,
    history_days: input.historyDays,
    has_delivery: input.hasDelivery,
    has_conversion_signal: input.hasConversionSignal,
    tracking_confidence: input.trackingConfidence,
    maturity_score: input.maturityScore,
    digest_json: input.digest as unknown as AdAccountAssessmentInsert['digest_json'],
    assessment_json: input.assessment as unknown as AdAccountAssessmentInsert['assessment_json'],
    created_at: input.createdAt,
  };

  const { data, error } = await supabase
    .from('ad_account_assessments')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to insert ad account assessment');
  }

  return mapAdAccountAssessment(data);
}

export async function getLatestAdAccountAssessment(
  supabase: AssessmentClient,
  input: {
    businessId: string;
    platformIntegrationId?: string | null;
    adAccountId?: string | null;
  }
): Promise<AdAccountAssessment | null> {
  let query = supabase
    .from('ad_account_assessments')
    .select('*')
    .eq('business_id', input.businessId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (input.platformIntegrationId) {
    query = query.eq('platform_integration_id', input.platformIntegrationId);
  }

  if (input.adAccountId) {
    query = query.eq('ad_account_id', input.adAccountId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }

  return data ? mapAdAccountAssessment(data) : null;
}

export async function listLatestAdAccountAssessmentsForBusiness(
  supabase: AssessmentClient,
  businessId: string
): Promise<AdAccountAssessment[]> {
  const { data, error } = await supabase
    .from('ad_account_assessments')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  const latestByAdAccountId = new Map<string, AdAccountAssessment>();
  for (const row of (data ?? []) as AdAccountAssessmentRow[]) {
    if (latestByAdAccountId.has(row.ad_account_id)) {
      continue;
    }

    latestByAdAccountId.set(row.ad_account_id, mapAdAccountAssessment(row));
  }

  return Array.from(latestByAdAccountId.values());
}

export async function insertBusinessAssessment(
  supabase: AssessmentClient,
  input: {
    businessId: string;
    scope: 'business';
    digest: BusinessSynthesisDigest;
    assessment: BusinessAssessmentSummary;
    createdAt: string;
  }
): Promise<BusinessAssessment> {
  const payload: BusinessAssessmentInsert = {
    business_id: input.businessId,
    scope: input.scope,
    digest_json: input.digest as unknown as BusinessAssessmentInsert['digest_json'],
    assessment_json: input.assessment as unknown as BusinessAssessmentInsert['assessment_json'],
    created_at: input.createdAt,
  };

  const { data, error } = await supabase
    .from('business_assessments')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to insert business assessment');
  }

  return mapBusinessAssessment(data);
}

export async function getLatestBusinessAssessment(
  supabase: AssessmentClient,
  businessId: string
): Promise<BusinessAssessment | null> {
  const { data, error } = await supabase
    .from('business_assessments')
    .select('*')
    .eq('business_id', businessId)
    .eq('scope', 'business')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapBusinessAssessment(data) : null;
}
