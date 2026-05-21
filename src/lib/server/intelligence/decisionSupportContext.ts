import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import { listActiveTrendFindings } from './repositories/trendFindings';
import type { AdAccountAssessment, TrendFinding } from './types';

type IntelligenceClient = SupabaseClient<Database>;

export type DecisionSupportCampaignReview = {
  id: string;
  title: string;
  status: string;
  completedAt: string | null;
  reviewHref: string;
  summary: string | null;
  aiGenerated: boolean;
  aiRunId: string | null;
};

export type DecisionSupportSnapshot = {
  id: string;
  snapshotType: string;
  periodStart: string;
  periodEnd: string;
  summaryText: string | null;
  createdAt: string;
};

export type DecisionSupportContext = {
  mode: 'deterministic_read_model_v1';
  businessId: string;
  adAccountId: string;
  activeFindings: TrendFinding[];
  latestAssessment: AdAccountAssessment | null;
  latestCampaignReviews: DecisionSupportCampaignReview[];
  latestSnapshots: DecisionSupportSnapshot[];
};

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export async function buildDecisionSupportContext(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
    latestAssessment: AdAccountAssessment | null;
    limit?: number;
  }
): Promise<DecisionSupportContext> {
  const limit = input.limit ?? 5;
  const [activeFindings, reviewRows, snapshotRows] = await Promise.all([
    listActiveTrendFindings(supabase, {
      businessId: input.businessId,
      adAccountId: input.adAccountId,
    }),
    (supabase as any)
      .from('calendar_queue_items')
      .select('id,title,status,completed_at,payload_json')
      .eq('business_id', input.businessId)
      .eq('ad_account_id', input.adAccountId)
      .eq('item_type', 'campaign_review')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(limit),
    (supabase as any)
      .from('ad_account_intelligence_snapshots')
      .select('id,snapshot_type,period_start,period_end,summary_text,created_at')
      .eq('business_id', input.businessId)
      .eq('ad_account_id', input.adAccountId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (reviewRows.error) {
    throw reviewRows.error;
  }

  if (snapshotRows.error) {
    throw snapshotRows.error;
  }

  return {
    mode: 'deterministic_read_model_v1',
    businessId: input.businessId,
    adAccountId: input.adAccountId,
    activeFindings,
    latestAssessment: input.latestAssessment,
    latestCampaignReviews: ((reviewRows.data ?? []) as Array<{
      id: string;
      title: string;
      status: string;
      completed_at: string | null;
      payload_json: unknown;
    }>).map((row) => {
      const payload = asRecord(row.payload_json);
      const action = asRecord(asRecord(payload.execution).action);

      return {
        id: row.id,
        title: row.title,
        status: row.status,
        completedAt: row.completed_at,
        reviewHref: stringValue(action.reviewHref) ?? `/campaigns/reviews/${row.id}`,
        summary: stringValue(action.summary),
        aiGenerated: action.aiGenerated === true,
        aiRunId: stringValue(action.aiRunId),
      };
    }),
    latestSnapshots: ((snapshotRows.data ?? []) as Array<{
      id: string;
      snapshot_type: string;
      period_start: string;
      period_end: string;
      summary_text: string | null;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      snapshotType: row.snapshot_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      summaryText: row.summary_text,
      createdAt: row.created_at,
    })),
  };
}
