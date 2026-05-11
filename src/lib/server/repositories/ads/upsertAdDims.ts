import type { Json } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '../utils';
import { upsertAdEntities } from '../ad_entities/upsertAdEntities';
import { toAdCompatRow, type AdEntityCompatRow } from '../ad_entities/types';

export type AdDimRow = AdEntityCompatRow;

export interface UpsertAdDimInput {
  businessId?: string;
  platformId?: string;
  platformIntegrationId?: string | null;
  adAccountId: string;
  adsetExternalId: string;
  adsetId: string | null;
  campaignId: string | null;
  externalId: string;
  name: string | null;
  creativeId: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  raw: Json | null;
  syncedAt: string;
}

export interface UpsertAdDimsResult {
  count: number;
  rows: AdDimRow[];
  byExternalId: Map<string, AdDimRow>;
}

export async function upsertAdDims(
  supabase: RepositoryClient,
  inputs: UpsertAdDimInput[]
): Promise<UpsertAdDimsResult> {
  const rows = (
    await upsertAdEntities(
      supabase,
      inputs.map((input) => ({
        businessId: input.businessId,
        platformId: input.platformId,
        platformIntegrationId: input.platformIntegrationId,
        adAccountId: input.adAccountId,
        entityLevel: 'ad',
        externalId: input.externalId,
        parentId: input.adsetId,
        parentExternalId: input.adsetExternalId,
        campaignId: input.campaignId,
        adsetId: input.adsetId,
        name: input.name,
        creativeExternalId: input.creativeId,
        status: input.status,
        createdTime: input.createdTime,
        updatedTime: input.updatedTime,
        raw: input.raw,
        syncedAt: input.syncedAt,
      }))
    )
  ).map(toAdCompatRow);

  return {
    count: rows.length,
    rows,
    byExternalId: new Map(rows.map((row) => [row.external_id, row])),
  };
}
