import type { Json } from '@/lib/shared/types/supabase';
import type { Database } from '@/lib/shared/types/supabase';
import {
  buildScopedExternalKey,
  chunkArray,
  dedupeBy,
  type RepositoryClient,
} from '../utils';

type CreativeFeatureSnapshotRow =
  Database['ai']['Tables']['creative_feature_snapshots']['Row'];
type CreativeFeatureSnapshotInsert =
  Database['ai']['Tables']['creative_feature_snapshots']['Insert'];

export interface UpsertCreativeFeatureSnapshotInput {
  businessId: string;
  adAccountId: string;
  creativeId: string;
  adId: string | null;
  adsetId: string | null;
  campaignId: string | null;
  snapshotDate: string;
  ctaType: string | null;
  headlineText: string | null;
  bodyText: string | null;
  primaryFormat: string | null;
  offerType: string | null;
  landingPageType: string | null;
  hookStyle: string | null;
  hasPrice: boolean | null;
  hasDiscount: boolean | null;
  hasUrgency: boolean | null;
  hasSocialProof: boolean | null;
  hasTestimonial: boolean | null;
  hasBranding: boolean | null;
  messageAngleTags: string[];
  visualStyleTags: string[];
  featureJson: Json | null;
  createdAt: string;
}

export interface UpsertCreativeFeatureSnapshotsResult {
  count: number;
  rows: CreativeFeatureSnapshotRow[];
}

async function selectCreativeFeatureSnapshots(
  supabase: RepositoryClient,
  input: { adAccountIds: string[]; creativeIds: string[]; snapshotDates: string[] }
): Promise<CreativeFeatureSnapshotRow[]> {
  const rows: CreativeFeatureSnapshotRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const creativeIdsChunk of chunkArray(input.creativeIds, 250)) {
      for (const snapshotDatesChunk of chunkArray(input.snapshotDates, 100)) {
        const { data, error } = await supabase
          .schema('ai')
          .from('creative_feature_snapshots')
          .select('*')
          .in('ad_account_id', adAccountIdsChunk)
          .in('creative_id', creativeIdsChunk)
          .in('snapshot_date', snapshotDatesChunk);

        if (error) {
          throw error;
        }

        rows.push(...(data ?? []));
      }
    }
  }

  return rows;
}

export async function upsertCreativeFeatureSnapshots(
  supabase: RepositoryClient,
  inputs: UpsertCreativeFeatureSnapshotInput[]
): Promise<UpsertCreativeFeatureSnapshotsResult> {
  const normalizedInputs = dedupeBy(
    inputs.filter((input) => input.adAccountId && input.creativeId && input.snapshotDate),
    (input) => buildScopedExternalKey(input.adAccountId, `${input.creativeId}:${input.snapshotDate}`)
  );

  if (normalizedInputs.length === 0) {
    return {
      count: 0,
      rows: [],
    };
  }

  const adAccountIds = Array.from(new Set(normalizedInputs.map((input) => input.adAccountId)));
  const creativeIds = Array.from(new Set(normalizedInputs.map((input) => input.creativeId)));
  const snapshotDates = Array.from(new Set(normalizedInputs.map((input) => input.snapshotDate)));
  const existingRows = await selectCreativeFeatureSnapshots(supabase, {
    adAccountIds,
    creativeIds,
    snapshotDates,
  });
  const existingByKey = new Map(
    existingRows.map((row) => [
      buildScopedExternalKey(row.ad_account_id, `${row.creative_id}:${row.snapshot_date}`),
      row,
    ] satisfies [string, CreativeFeatureSnapshotRow])
  );

  const rowsToUpdate: CreativeFeatureSnapshotInsert[] = [];
  const rowsToInsert: CreativeFeatureSnapshotInsert[] = [];

  for (const input of normalizedInputs) {
    const baseRow = {
      business_id: input.businessId,
      ad_account_id: input.adAccountId,
      creative_id: input.creativeId,
      ad_id: input.adId,
      adset_id: input.adsetId,
      campaign_id: input.campaignId,
      snapshot_date: input.snapshotDate,
      cta_type: input.ctaType,
      headline_text: input.headlineText,
      body_text: input.bodyText,
      primary_format: input.primaryFormat,
      offer_type: input.offerType,
      landing_page_type: input.landingPageType,
      hook_style: input.hookStyle,
      has_price: input.hasPrice,
      has_discount: input.hasDiscount,
      has_urgency: input.hasUrgency,
      has_social_proof: input.hasSocialProof,
      has_testimonial: input.hasTestimonial,
      has_branding: input.hasBranding,
      message_angle_tags: input.messageAngleTags,
      visual_style_tags: input.visualStyleTags,
      feature_json: (input.featureJson ?? {}) as Json,
    } satisfies CreativeFeatureSnapshotInsert;

    const existing = existingByKey.get(
      buildScopedExternalKey(input.adAccountId, `${input.creativeId}:${input.snapshotDate}`)
    );
    if (existing) {
      rowsToUpdate.push({
        id: existing.id,
        created_at: existing.created_at,
        ...baseRow,
      });
      continue;
    }

    rowsToInsert.push({
      ...baseRow,
      created_at: input.createdAt,
    });
  }

  for (const chunk of chunkArray(rowsToUpdate, 250)) {
    const { error } = await supabase
      .schema('ai')
      .from('creative_feature_snapshots')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rowsToInsert, 250)) {
    const { error } = await supabase
      .schema('ai')
      .from('creative_feature_snapshots')
      .insert(chunk);

    if (error) {
      throw error;
    }
  }

  const rows = await selectCreativeFeatureSnapshots(supabase, {
    adAccountIds,
    creativeIds,
    snapshotDates,
  });

  return {
    count: rows.length,
    rows,
  };
}
