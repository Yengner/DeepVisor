import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CampaignDraftPayload } from '@/lib/shared/types/campaignDrafts';
import { asRecord } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';

type DraftClient = SupabaseClient<Database>;
type CampaignDraftRow = Database['public']['Tables']['campaign_drafts']['Row'];

export async function createCampaignDraft(
  supabase: DraftClient,
  input: {
    businessId: string;
    platformIntegrationId: string;
    adAccountId: string;
    userId: string;
    title: string;
    payloadJson: CampaignDraftPayload;
    reviewNotes?: string | null;
    sourceActionId?: string | null;
  }
): Promise<CampaignDraftRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('campaign_drafts')
    .insert({
      business_id: input.businessId,
      platform_integration_id: input.platformIntegrationId,
      ad_account_id: input.adAccountId,
      created_by_user_id: input.userId,
      updated_by_user_id: input.userId,
      title: input.title,
      payload_json: input.payloadJson as unknown as Database['public']['Tables']['campaign_drafts']['Insert']['payload_json'],
      review_notes: input.reviewNotes ?? null,
      source_action_id: input.sourceActionId ?? null,
      status: 'draft',
      created_at: now,
      updated_at: now,
      version: 1,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create campaign draft');
  }

  return data as CampaignDraftRow;
}

export async function getCampaignDraftById(
  supabase: DraftClient,
  input: {
    businessId: string;
    draftId: string;
  }
): Promise<CampaignDraftRow | null> {
  const { data, error } = await supabase
    .from('campaign_drafts')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('id', input.draftId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CampaignDraftRow | null) ?? null;
}

export function readCampaignDraftPayload(row: CampaignDraftRow | null): CampaignDraftPayload | null {
  const payload = asRecord(row?.payload_json);
  if (payload.mode !== 'manual' && payload.mode !== 'smart') {
    return null;
  }

  return payload as unknown as CampaignDraftPayload;
}
