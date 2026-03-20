import type { Json } from '@/lib/shared/types/supabase';
import type { Database } from '@/lib/shared/types/supabase';
import {
  buildScopedExternalKey,
  chunkArray,
  dedupeBy,
  type RepositoryClient,
} from '../utils';

type AdsetDimRow = Database['public']['Tables']['adset_dims']['Row'];
type AdsetDimInsert = Database['public']['Tables']['adset_dims']['Insert'];

export interface UpsertAdsetDimInput {
  adAccountId: string;
  campaignExternalId: string;
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

async function selectAdsetDims(
  supabase: RepositoryClient,
  input: { adAccountIds: string[]; externalIds: string[] }
): Promise<AdsetDimRow[]> {
  const rows: AdsetDimRow[] = [];

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const externalIdsChunk of chunkArray(input.externalIds, 250)) {
      const { data, error } = await supabase
        .from('adset_dims')
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

export async function upsertAdsetDims(
  supabase: RepositoryClient,
  inputs: UpsertAdsetDimInput[]
): Promise<UpsertAdsetDimsResult> {
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
  const existingRows = await selectAdsetDims(supabase, {
    adAccountIds,
    externalIds,
  });
  const existingByKey = new Map(
    existingRows.map((row) => [
      buildScopedExternalKey(row.ad_account_id, row.external_id),
      row,
    ] satisfies [string, AdsetDimRow])
  );

  const rowsToUpdate: AdsetDimInsert[] = [];
  const rowsToInsert: AdsetDimInsert[] = [];

  for (const input of normalizedInputs) {
    const baseRow = {
      ad_account_id: input.adAccountId,
      campaign_external_id: input.campaignExternalId,
      external_id: input.externalId,
      name: input.name,
      optimization_goal: input.optimizationGoal,
      status: input.status,
      created_time: input.createdTime,
      updated_time: input.updatedTime,
      raw: input.raw,
      updated_at: input.syncedAt,
    } satisfies AdsetDimInsert;

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
    const { error } = await supabase.from('adset_dims').upsert(chunk, { onConflict: 'id' });

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rowsToInsert, 250)) {
    const { error } = await supabase.from('adset_dims').insert(chunk);

    if (error) {
      throw error;
    }
  }

  const rows = await selectAdsetDims(supabase, {
    adAccountIds,
    externalIds,
  });

  return {
    count: rows.length,
    rows,
    byExternalId: new Map(
      rows.map((row) => [row.external_id, row] satisfies [string, AdsetDimRow])
    ),
  };
}
