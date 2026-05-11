import type { Json } from '@/lib/shared/types/supabase';
import {
  chunkArray,
  dedupeBy,
  type RepositoryClient,
} from '../utils';
import type { AdAccountEntityScope, AdEntityLevel, AdEntityRow } from './types';

export type UpsertAdEntityInput = {
  businessId?: string;
  adAccountId: string;
  platformId?: string;
  platformIntegrationId?: string | null;
  entityLevel: AdEntityLevel;
  externalId: string;
  parentId?: string | null;
  parentExternalId?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  name?: string | null;
  objective?: string | null;
  optimizationGoal?: string | null;
  status?: string | null;
  creativeExternalId?: string | null;
  createdTime?: string | null;
  updatedTime?: string | null;
  raw?: Json | null;
  syncedAt: string;
};

type AdEntityUpsertRow = {
  id?: string;
  business_id: string;
  ad_account_id: string;
  platform_id: string;
  platform_integration_id: string | null;
  entity_level: AdEntityLevel;
  external_id: string;
  parent_id: string | null;
  parent_external_id: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  name: string | null;
  objective: string | null;
  optimization_goal: string | null;
  status: string | null;
  creative_external_id: string | null;
  created_time: string | null;
  updated_time: string | null;
  raw: Json;
  created_at?: string;
  updated_at: string;
};

function entityKey(row: Pick<AdEntityRow, 'ad_account_id' | 'entity_level' | 'external_id'>): string {
  return `${row.ad_account_id}::${row.entity_level}::${row.external_id}`;
}

async function listAdAccountScopes(
  supabase: RepositoryClient,
  adAccountIds: string[]
): Promise<Map<string, AdAccountEntityScope>> {
  const scopes = new Map<string, AdAccountEntityScope>();

  for (const idsChunk of chunkArray(adAccountIds, 200)) {
    const { data, error } = await supabase
      .from('ad_accounts')
      .select('id, business_id, platform_id')
      .in('id', idsChunk);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      scopes.set(row.id, row as AdAccountEntityScope);
    }
  }

  return scopes;
}

async function selectAdEntities(
  supabase: RepositoryClient,
  input: {
    adAccountIds: string[];
    entityLevel: AdEntityLevel;
    externalIds: string[];
  }
): Promise<AdEntityRow[]> {
  const rows: AdEntityRow[] = [];
  const client = supabase as any;

  for (const adAccountIdsChunk of chunkArray(input.adAccountIds, 100)) {
    for (const externalIdsChunk of chunkArray(input.externalIds, 250)) {
      const { data, error } = await client
        .from('ad_entities')
        .select('*')
        .in('ad_account_id', adAccountIdsChunk)
        .eq('entity_level', input.entityLevel)
        .in('external_id', externalIdsChunk);

      if (error) {
        throw error;
      }

      rows.push(...((data ?? []) as AdEntityRow[]));
    }
  }

  return rows;
}

export async function upsertAdEntities(
  supabase: RepositoryClient,
  inputs: UpsertAdEntityInput[]
): Promise<AdEntityRow[]> {
  const normalizedInputs = dedupeBy(
    inputs.filter((input) => input.adAccountId && input.externalId && input.entityLevel),
    (input) => `${input.adAccountId}::${input.entityLevel}::${input.externalId}`
  );

  if (normalizedInputs.length === 0) {
    return [];
  }

  const entityLevel = normalizedInputs[0]!.entityLevel;
  const adAccountIds = Array.from(new Set(normalizedInputs.map((input) => input.adAccountId)));
  const externalIds = Array.from(new Set(normalizedInputs.map((input) => input.externalId)));
  const accountScopes = await listAdAccountScopes(supabase, adAccountIds);
  const existingRows = await selectAdEntities(supabase, {
    adAccountIds,
    entityLevel,
    externalIds,
  });
  const existingByKey = new Map(existingRows.map((row) => [entityKey(row), row]));
  const rowsToUpsert: AdEntityUpsertRow[] = [];

  for (const input of normalizedInputs) {
    const accountScope = accountScopes.get(input.adAccountId);
    const businessId = input.businessId ?? accountScope?.business_id ?? null;
    const platformId = input.platformId ?? accountScope?.platform_id ?? null;

    if (!businessId || !platformId) {
      throw new Error(`Ad account scope not found for entity sync: ${input.adAccountId}`);
    }

    const existing = existingByKey.get(
      `${input.adAccountId}::${input.entityLevel}::${input.externalId}`
    );

    rowsToUpsert.push({
      ...(existing ? { id: existing.id } : {}),
      business_id: businessId,
      ad_account_id: input.adAccountId,
      platform_id: platformId,
      platform_integration_id: input.platformIntegrationId ?? existing?.platform_integration_id ?? null,
      entity_level: input.entityLevel,
      external_id: input.externalId,
      parent_id: input.parentId ?? null,
      parent_external_id: input.parentExternalId ?? null,
      campaign_id: input.campaignId ?? null,
      adset_id: input.adsetId ?? null,
      name: input.name ?? null,
      objective: input.objective ?? null,
      optimization_goal: input.optimizationGoal ?? null,
      status: input.status ?? null,
      creative_external_id: input.creativeExternalId ?? null,
      created_time: input.createdTime ?? null,
      updated_time: input.updatedTime ?? null,
      raw: input.raw ?? {},
      ...(existing ? {} : { created_at: input.syncedAt }),
      updated_at: input.syncedAt,
    });
  }

  const client = supabase as any;

  for (const chunk of chunkArray(rowsToUpsert, 250)) {
    const { error } = await client
      .from('ad_entities')
      .upsert(chunk, { onConflict: 'ad_account_id,entity_level,external_id' });

    if (error) {
      throw error;
    }
  }

  return selectAdEntities(supabase, {
    adAccountIds,
    entityLevel,
    externalIds,
  });
}
