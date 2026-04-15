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
type AssessmentInsert = Database['ai']['Tables']['business_assessments']['Insert'];

const AD_ACCOUNT_SCOPE_PREFIX = 'ad_account:';

type StoredAdAccountDigestPayload = {
  type: 'ad_account_assessment';
  version: number;
  platformIntegrationId: string;
  adAccountId: string;
  state: AdAccountAssessment['state'];
  historyDays: number;
  hasDelivery: boolean;
  hasConversionSignal: boolean;
  trackingConfidence: AdAccountAssessment['trackingConfidence'];
  maturityScore: number;
  digest: AdAccountDigest;
};

function buildAdAccountScope(platformIntegrationId: string, adAccountId: string): string {
  return `${AD_ACCOUNT_SCOPE_PREFIX}${platformIntegrationId}:${adAccountId}`;
}

function parseAdAccountScope(scope: string): { platformIntegrationId: string; adAccountId: string } | null {
  if (!scope.startsWith(AD_ACCOUNT_SCOPE_PREFIX)) {
    return null;
  }

  const [, platformIntegrationId = '', adAccountId = ''] = scope.split(':');
  if (!platformIntegrationId || !adAccountId) {
    return null;
  }

  return { platformIntegrationId, adAccountId };
}

function mapAdAccountAssessment(row: AdAccountAssessmentRow): AdAccountAssessment | null {
  const scope = parseAdAccountScope(row.scope);
  const digestPayload = asRecord(row.digest_json);
  const assessment = asRecord(row.assessment_json) as unknown as AdAccountAssessmentSummary;
  const digest = asRecord(digestPayload.digest) as unknown as AdAccountDigest;

  if (!scope) {
    return null;
  }

  return {
    id: row.id,
    businessId: row.business_id,
    platformIntegrationId:
      typeof digestPayload.platformIntegrationId === 'string'
        ? digestPayload.platformIntegrationId
        : scope.platformIntegrationId,
    adAccountId:
      typeof digestPayload.adAccountId === 'string'
        ? digestPayload.adAccountId
        : scope.adAccountId,
    state: (digestPayload.state ?? 'learning') as AdAccountAssessment['state'],
    historyDays:
      typeof digestPayload.historyDays === 'number' ? digestPayload.historyDays : 0,
    hasDelivery: digestPayload.hasDelivery === true,
    hasConversionSignal: digestPayload.hasConversionSignal === true,
    trackingConfidence:
      (digestPayload.trackingConfidence ?? 'low') as AdAccountAssessment['trackingConfidence'],
    maturityScore: Number(digestPayload.maturityScore ?? 0),
    digest,
    assessment,
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
  const payload: AssessmentInsert = {
    business_id: input.businessId,
    scope: buildAdAccountScope(input.platformIntegrationId, input.adAccountId),
    digest_json: {
      type: 'ad_account_assessment',
      version: 1,
      platformIntegrationId: input.platformIntegrationId,
      adAccountId: input.adAccountId,
      state: input.state,
      historyDays: input.historyDays,
      hasDelivery: input.hasDelivery,
      hasConversionSignal: input.hasConversionSignal,
      trackingConfidence: input.trackingConfidence,
      maturityScore: input.maturityScore,
      digest: input.digest,
    } satisfies StoredAdAccountDigestPayload as unknown as AssessmentInsert['digest_json'],
    assessment_json: input.assessment as unknown as AssessmentInsert['assessment_json'],
    created_at: input.createdAt,
  };

  const { data, error } = await supabase
    .schema('ai')
    .from('business_assessments')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to insert ad account assessment');
  }

  const mapped = mapAdAccountAssessment(data);
  if (!mapped) {
    throw new Error('Failed to map inserted ad account assessment');
  }

  return mapped;
}

export async function getLatestAdAccountAssessment(
  supabase: AssessmentClient,
  input: {
    businessId: string;
    platformIntegrationId?: string | null;
    adAccountId?: string | null;
  }
): Promise<AdAccountAssessment | null> {
  if (input.platformIntegrationId && input.adAccountId) {
    const { data, error } = await supabase
      .schema('ai')
      .from('business_assessments')
      .select('*')
      .eq('business_id', input.businessId)
      .eq('scope', buildAdAccountScope(input.platformIntegrationId, input.adAccountId))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapAdAccountAssessment(data) : null;
  }

  const { data, error } = await supabase
    .schema('ai')
    .from('business_assessments')
    .select('*')
    .eq('business_id', input.businessId)
    .like('scope', `${AD_ACCOUNT_SCOPE_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    const mapped = mapAdAccountAssessment(row);
    if (!mapped) {
      continue;
    }

    if (
      input.platformIntegrationId &&
      mapped.platformIntegrationId !== input.platformIntegrationId
    ) {
      continue;
    }

    if (input.adAccountId && mapped.adAccountId !== input.adAccountId) {
      continue;
    }

    return mapped;
  }

  return null;
}

export async function listLatestAdAccountAssessmentsForBusiness(
  supabase: AssessmentClient,
  businessId: string
): Promise<AdAccountAssessment[]> {
  const { data, error } = await supabase
    .schema('ai')
    .from('business_assessments')
    .select('*')
    .eq('business_id', businessId)
    .like('scope', `${AD_ACCOUNT_SCOPE_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  const latestByAdAccountId = new Map<string, AdAccountAssessment>();
  for (const row of (data ?? []) as AdAccountAssessmentRow[]) {
    const mapped = mapAdAccountAssessment(row);
    if (!mapped || latestByAdAccountId.has(mapped.adAccountId)) {
      continue;
    }

    latestByAdAccountId.set(mapped.adAccountId, mapped);
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
  const payload: AssessmentInsert = {
    business_id: input.businessId,
    scope: input.scope,
    digest_json: input.digest as unknown as AssessmentInsert['digest_json'],
    assessment_json: input.assessment as unknown as AssessmentInsert['assessment_json'],
    created_at: input.createdAt,
  };

  const { data, error } = await supabase
    .schema('ai')
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
    .schema('ai')
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
