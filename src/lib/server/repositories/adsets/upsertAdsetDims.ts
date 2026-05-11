import type { Json } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '../utils';
import { upsertAdEntities } from '../ad_entities/upsertAdEntities';
import { toAdsetCompatRow, type AdsetEntityRow } from '../ad_entities/types';

export type AdsetDimRow = AdsetEntityRow;

export interface UpsertAdsetDimInput {
  businessId?: string;
  platformId?: string;
  platformIntegrationId?: string | null;
  adAccountId: string;
  campaignExternalId: string;
  campaignId: string | null;
  externalId: string;
  name: string | null;
  optimizationGoal: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  raw: Json | null;
  syncedAt: string;
}

export interface UpsertAdsetDimsResult {
  count: number;
  rows: AdsetDimRow[];
  byExternalId: Map<string, AdsetDimRow>;
}

export async function upsertAdsetDims(
  supabase: RepositoryClient,
  inputs: UpsertAdsetDimInput[]
): Promise<UpsertAdsetDimsResult> {
  const rows = (
    await upsertAdEntities(
      supabase,
      inputs.map((input) => ({
        businessId: input.businessId,
        platformId: input.platformId,
        platformIntegrationId: input.platformIntegrationId,
        adAccountId: input.adAccountId,
        entityLevel: 'adset',
        externalId: input.externalId,
        parentId: input.campaignId,
        parentExternalId: input.campaignExternalId,
        campaignId: input.campaignId,
        name: input.name,
        optimizationGoal: input.optimizationGoal,
        status: input.status,
        createdTime: input.createdTime,
        updatedTime: input.updatedTime,
        raw: input.raw,
        syncedAt: input.syncedAt,
      }))
    )
  ).map(toAdsetCompatRow);

  return {
    count: rows.length,
    rows,
    byExternalId: new Map(rows.map((row) => [row.external_id, row])),
  };
}
