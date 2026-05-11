import type { Json } from '@/lib/shared/types/supabase';
import type { RepositoryClient } from '../utils';
import { upsertAdEntities } from '../ad_entities/upsertAdEntities';
import type { CampaignEntityRow } from '../ad_entities/types';

export type CampaignDimRow = CampaignEntityRow;

export interface UpsertCampaignDimInput {
  businessId?: string;
  platformId?: string;
  platformIntegrationId?: string | null;
  adAccountId: string;
  externalId: string;
  name: string | null;
  objective: string | null;
  status: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  raw: Json | null;
  syncedAt: string;
}

export interface UpsertCampaignDimsResult {
  count: number;
  rows: CampaignDimRow[];
  byExternalId: Map<string, CampaignDimRow>;
}

export async function upsertCampaignDims(
  supabase: RepositoryClient,
  inputs: UpsertCampaignDimInput[]
): Promise<UpsertCampaignDimsResult> {
  const rows = (await upsertAdEntities(
    supabase,
    inputs.map((input) => ({
      businessId: input.businessId,
      platformId: input.platformId,
      platformIntegrationId: input.platformIntegrationId,
      adAccountId: input.adAccountId,
      entityLevel: 'campaign',
      externalId: input.externalId,
      name: input.name,
      objective: input.objective,
      status: input.status,
      createdTime: input.createdTime,
      updatedTime: input.updatedTime,
      raw: input.raw,
      syncedAt: input.syncedAt,
    }))
  )) as CampaignDimRow[];

  return {
    count: rows.length,
    rows,
    byExternalId: new Map(rows.map((row) => [row.external_id, row])),
  };
}
