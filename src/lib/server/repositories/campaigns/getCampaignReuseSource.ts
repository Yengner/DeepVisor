import 'server-only';

import type { CampaignReuseSourceType } from '@/lib/shared/types/campaignDrafts';
import type { Database } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '../utils';

type CampaignRow = Pick<
  Database['public']['Views']['campaign_dims']['Row'],
  'id' | 'external_id' | 'name' | 'objective' | 'status' | 'raw'
>;

type AdSetRow = Pick<
  Database['public']['Views']['adset_dims']['Row'],
  | 'id'
  | 'external_id'
  | 'campaign_external_id'
  | 'name'
  | 'optimization_goal'
  | 'status'
  | 'raw'
>;

type AdRow = Pick<
  Database['public']['Views']['ad_dims']['Row'],
  'id' | 'external_id' | 'adset_external_id' | 'name' | 'creative_id' | 'status' | 'raw'
>;

export type CampaignReuseCreativeRow = Pick<
  Database['public']['Tables']['ad_creatives']['Row'],
  | 'platform_creative_id'
  | 'name'
  | 'creative_type'
  | 'cta_type'
  | 'primary_text'
  | 'headline'
  | 'description'
  | 'link_url'
  | 'image_hash'
  | 'image_url'
  | 'thumbnail_url'
  | 'video_id'
  | 'page_id'
  | 'instagram_actor_id'
  | 'object_story_id'
  | 'object_story_spec'
  | 'asset_feed_spec'
  | 'updated_at'
>;

export type CampaignReuseSourceRecords = {
  campaign: CampaignRow;
  adSet: AdSetRow | null;
  ad: AdRow | null;
  creative: CampaignReuseCreativeRow | null;
};

export class CampaignReuseSourceLookupError extends Error {
  constructor(
    message: string,
    readonly reason: 'source_not_found' | 'creative_not_found'
  ) {
    super(message);
    this.name = 'CampaignReuseSourceLookupError';
  }
}

export async function getCampaignReuseSource(
  supabase: RepositoryClient,
  input: {
    businessId: string;
    adAccountId: string;
    sourceType: CampaignReuseSourceType;
    sourceCampaignId: string;
    sourceAdSetId?: string;
    sourceAdId?: string;
    requireCreative: boolean;
  }
): Promise<CampaignReuseSourceRecords> {
  if (
    ((input.sourceType === 'adset' || input.sourceType === 'ad') && !input.sourceAdSetId) ||
    (input.sourceType === 'ad' && !input.sourceAdId) ||
    (input.sourceAdId && !input.sourceAdSetId)
  ) {
    throw new CampaignReuseSourceLookupError(
      'The source hierarchy is incomplete.',
      'source_not_found'
    );
  }

  const { data: campaignData, error: campaignError } = await supabase
    .from('campaign_dims')
    .select('id, external_id, name, objective, status, raw')
    .eq('ad_account_id', input.adAccountId)
    .eq('external_id', input.sourceCampaignId)
    .maybeSingle();

  if (campaignError) {
    throw campaignError;
  }

  if (!campaignData) {
    throw new CampaignReuseSourceLookupError(
      'The source campaign is not available in the selected ad account.',
      'source_not_found'
    );
  }

  let adSet: AdSetRow | null = null;
  if (input.sourceAdSetId) {
    const { data, error } = await supabase
      .from('adset_dims')
      .select('id, external_id, campaign_external_id, name, optimization_goal, status, raw')
      .eq('ad_account_id', input.adAccountId)
      .eq('external_id', input.sourceAdSetId)
      .eq('campaign_external_id', input.sourceCampaignId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new CampaignReuseSourceLookupError(
        'The source ad set is not available under that campaign in the selected ad account.',
        'source_not_found'
      );
    }

    adSet = data as AdSetRow;
  }

  let ad: AdRow | null = null;
  if (input.sourceAdId) {
    const { data, error } = await supabase
      .from('ad_dims')
      .select('id, external_id, adset_external_id, name, creative_id, status, raw')
      .eq('ad_account_id', input.adAccountId)
      .eq('external_id', input.sourceAdId)
      .eq('adset_external_id', input.sourceAdSetId!)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new CampaignReuseSourceLookupError(
        'The source ad is not available under that ad set in the selected ad account.',
        'source_not_found'
      );
    }

    ad = data as AdRow;
  }

  let creative: CampaignReuseCreativeRow | null = null;
  if (ad?.creative_id) {
    const { data, error } = await supabase
      .from('ad_creatives')
      .select(
        'platform_creative_id, name, creative_type, cta_type, primary_text, headline, description, link_url, image_hash, image_url, thumbnail_url, video_id, page_id, instagram_actor_id, object_story_id, object_story_spec, asset_feed_spec, updated_at'
      )
      .eq('business_id', input.businessId)
      .eq('ad_account_id', input.adAccountId)
      .eq('platform_creative_id', ad.creative_id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    creative = (data as CampaignReuseCreativeRow | null) ?? null;
  }

  if (input.requireCreative && (!ad?.creative_id || !creative)) {
    throw new CampaignReuseSourceLookupError(
      'The exact source creative is missing or stale. Choose a fresh creative instead.',
      'creative_not_found'
    );
  }

  return {
    campaign: campaignData as CampaignRow,
    adSet,
    ad,
    creative,
  };
}
