import type { Json } from '@/lib/shared/types/supabase';
import type { Database } from '@/lib/shared/types/supabase';
import {
  buildScopedExternalKey,
  chunkArray,
  dedupeBy,
  type RepositoryClient,
} from '../utils';

type AdCreativeRow = Database['public']['Tables']['ad_creatives']['Row'];
type AdCreativeInsert = Database['public']['Tables']['ad_creatives']['Insert'];

export interface UpsertAdCreativeInput {
  businessId: string;
  platformIntegrationId: string | null;
  adAccountId: string;
  platformCreativeId: string;
  name: string | null;
  creativeType: string | null;
  ctaType: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  imageHash: string | null;
  thumbnailUrl: string | null;
  videoId: string | null;
  pageId: string | null;
  instagramActorId: string | null;
  objectStoryId: string | null;
  objectStorySpec: Json | null;
  assetFeedSpec: Json | null;
  raw: Json | null;
  syncedAt: string;
}

export interface UpsertAdCreativesResult {
  count: number;
  rows: AdCreativeRow[];
}

async function selectAdCreatives(
  supabase: RepositoryClient,
  input: { adAccountIds: string[]; platformCreativeIds: string[] }
): Promise<AdCreativeRow[]> {
  const rows: AdCreativeRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const platformCreativeIdsChunk of chunkArray(input.platformCreativeIds, 250)) {
      const { data, error } = await supabase
        .from('ad_creatives')
        .select('*')
        .in('ad_account_id', adAccountIdsChunk)
        .in('platform_creative_id', platformCreativeIdsChunk);

      if (error) {
        throw error;
      }

      rows.push(...(data ?? []));
    }
  }

  return rows;
}

export async function upsertAdCreatives(
  supabase: RepositoryClient,
  inputs: UpsertAdCreativeInput[]
): Promise<UpsertAdCreativesResult> {
  const normalizedInputs = dedupeBy(
    inputs.filter((input) => input.adAccountId && input.platformCreativeId),
    (input) => buildScopedExternalKey(input.adAccountId, input.platformCreativeId)
  );

  if (normalizedInputs.length === 0) {
    return {
      count: 0,
      rows: [],
    };
  }

  const adAccountIds = Array.from(new Set(normalizedInputs.map((input) => input.adAccountId)));
  const platformCreativeIds = Array.from(
    new Set(normalizedInputs.map((input) => input.platformCreativeId))
  );
  const existingRows = await selectAdCreatives(supabase, {
    adAccountIds,
    platformCreativeIds,
  });
  const existingByKey = new Map(
    existingRows.map((row) => [
      buildScopedExternalKey(row.ad_account_id, row.platform_creative_id),
      row,
    ] satisfies [string, AdCreativeRow])
  );

  const rowsToUpdate: AdCreativeInsert[] = [];
  const rowsToInsert: AdCreativeInsert[] = [];

  for (const input of normalizedInputs) {
    const baseRow = {
      business_id: input.businessId,
      platform_integration_id: input.platformIntegrationId,
      ad_account_id: input.adAccountId,
      platform_creative_id: input.platformCreativeId,
      name: input.name,
      creative_type: input.creativeType,
      cta_type: input.ctaType,
      primary_text: input.primaryText,
      headline: input.headline,
      description: input.description,
      link_url: input.linkUrl,
      image_url: input.imageUrl,
      image_hash: input.imageHash,
      thumbnail_url: input.thumbnailUrl,
      video_id: input.videoId,
      page_id: input.pageId,
      instagram_actor_id: input.instagramActorId,
      object_story_id: input.objectStoryId,
      object_story_spec: (input.objectStorySpec ?? {}) as Json,
      asset_feed_spec: (input.assetFeedSpec ?? {}) as Json,
      raw: (input.raw ?? {}) as Json,
      updated_at: input.syncedAt,
    } satisfies AdCreativeInsert;

    const existing = existingByKey.get(
      buildScopedExternalKey(input.adAccountId, input.platformCreativeId)
    );
    if (existing) {
      rowsToUpdate.push({
        id: existing.id,
        ...baseRow,
      });
      continue;
    }

    rowsToInsert.push({
      ...baseRow,
      created_at: input.syncedAt,
    });
  }

  for (const chunk of chunkArray(rowsToUpdate, 250)) {
    const { error } = await supabase.from('ad_creatives').upsert(chunk, { onConflict: 'id' });

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rowsToInsert, 250)) {
    const { error } = await supabase.from('ad_creatives').insert(chunk);

    if (error) {
      throw error;
    }
  }

  const rows = await selectAdCreatives(supabase, {
    adAccountIds,
    platformCreativeIds,
  });

  return {
    count: rows.length,
    rows,
  };
}
