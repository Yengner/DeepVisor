import type { Json } from '@/lib/shared/types/supabase';
import type { Database } from '@/lib/shared/types/supabase';
import {
  buildScopedExternalKey,
  chunkArray,
  dedupeBy,
  type RepositoryClient,
} from '../utils';

type CampaignDimRow = Database['public']['Tables']['campaign_dims']['Row'];
type CampaignDimInsert = Database['public']['Tables']['campaign_dims']['Insert'];

export interface UpsertCampaignDimInput {
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

async function selectCampaignDims(
  supabase: RepositoryClient,
  input: { adAccountIds: string[]; externalIds: string[] }
): Promise<CampaignDimRow[]> {
  const rows: CampaignDimRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const externalIdsChunk of chunkArray(input.externalIds, 250)) {
      const { data, error } = await supabase
        .from('campaign_dims')
        .select('*')
        .in('ad_account_id', adAccountIdsChunk)
        .in('external_id', externalIdsChunk);

      if (error) {
        throw error;
      }

      rows.push(...(data ?? []));
    }
  }

  return rows;
}

export async function upsertCampaignDims(
  supabase: RepositoryClient,
  inputs: UpsertCampaignDimInput[]
): Promise<UpsertCampaignDimsResult> {
  const normalizedInputs = dedupeBy(
    inputs.filter((input) => input.adAccountId && input.externalId),
    (input) => buildScopedExternalKey(input.adAccountId, input.externalId)
  );

  if (normalizedInputs.length === 0) {
    return {
      count: 0,
      rows: [],
      byExternalId: new Map(),
    };
  }

  const adAccountIds = Array.from(new Set(normalizedInputs.map((input) => input.adAccountId)));
  const externalIds = Array.from(new Set(normalizedInputs.map((input) => input.externalId)));
  const existingRows = await selectCampaignDims(supabase, {
    adAccountIds,
    externalIds,
  });
  const existingByKey = new Map(
    existingRows.map((row) => [
      buildScopedExternalKey(row.ad_account_id, row.external_id),
      row,
    ] satisfies [string, CampaignDimRow])
  );

  const rowsToUpdate: CampaignDimInsert[] = [];
  const rowsToInsert: CampaignDimInsert[] = [];

  for (const input of normalizedInputs) {
    const baseRow = {
      ad_account_id: input.adAccountId,
      external_id: input.externalId,
      name: input.name,
      objective: input.objective,
      status: input.status,
      created_time: input.createdTime,
      updated_time: input.updatedTime,
      raw: input.raw,
      updated_at: input.syncedAt,
    } satisfies CampaignDimInsert;

    const existing = existingByKey.get(buildScopedExternalKey(input.adAccountId, input.externalId));
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
    const { error } = await supabase.from('campaign_dims').upsert(chunk, { onConflict: 'id' });

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rowsToInsert, 250)) {
    const { error } = await supabase.from('campaign_dims').insert(chunk);

    if (error) {
      throw error;
    }
  }

  const rows = await selectCampaignDims(supabase, {
    adAccountIds,
    externalIds,
  });

  return {
    count: rows.length,
    rows,
    byExternalId: new Map(
      rows.map((row) => [row.external_id, row] satisfies [string, CampaignDimRow])
    ),
  };
}
