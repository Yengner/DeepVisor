import type { Json } from '@/lib/shared/types/supabase';
import type { Database } from '@/lib/shared/types/supabase';
import {
  buildScopedExternalKey,
  chunkArray,
  dedupeBy,
  type RepositoryClient,
} from '../utils';

type AdDimRow = Database['public']['Tables']['ad_dims']['Row'];
type AdDimInsert = Database['public']['Tables']['ad_dims']['Insert'];

export interface UpsertAdDimInput {
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

async function selectAdDims(
  supabase: RepositoryClient,
  input: { adAccountIds: string[]; externalIds: string[] }
): Promise<AdDimRow[]> {
  const rows: AdDimRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const externalIdsChunk of chunkArray(input.externalIds, 250)) {
      const { data, error } = await supabase
        .from('ad_dims')
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

export async function upsertAdDims(
  supabase: RepositoryClient,
  inputs: UpsertAdDimInput[]
): Promise<UpsertAdDimsResult> {
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
  const existingRows = await selectAdDims(supabase, {
    adAccountIds,
    externalIds,
  });
  const existingByKey = new Map(
    existingRows.map((row) => [
      buildScopedExternalKey(row.ad_account_id, row.external_id),
      row,
    ] satisfies [string, AdDimRow])
  );

  const rowsToUpdate: AdDimInsert[] = [];
  const rowsToInsert: AdDimInsert[] = [];

  for (const input of normalizedInputs) {
    const baseRow = {
      ad_account_id: input.adAccountId,
      adset_external_id: input.adsetExternalId,
      adset_id: input.adsetId,
      campaign_id: input.campaignId,
      external_id: input.externalId,
      name: input.name,
      creative_id: input.creativeId,
      status: input.status,
      created_time: input.createdTime,
      updated_time: input.updatedTime,
      raw: input.raw,
      updated_at: input.syncedAt,
    } satisfies AdDimInsert;

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
    const { error } = await supabase.from('ad_dims').upsert(chunk, { onConflict: 'id' });

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rowsToInsert, 250)) {
    const { error } = await supabase.from('ad_dims').insert(chunk);

    if (error) {
      throw error;
    }
  }

  const rows = await selectAdDims(supabase, {
    adAccountIds,
    externalIds,
  });

  return {
    count: rows.length,
    rows,
    byExternalId: new Map(rows.map((row) => [row.external_id, row] satisfies [string, AdDimRow])),
  };
}
