import type { Json } from '@/lib/shared/types/supabase';
import type { Database } from '@/lib/shared/types/supabase';
import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];
type AdAccountInsert = Database['public']['Tables']['ad_accounts']['Insert'];

export interface UpsertAdAccountInput {
  businessId: string;
  platformId: string;
  externalAccountId: string;
  name: string | null;
  status: string | null;
  currencyCode: string | null;
  timezone: string | null;
  aggregatedMetrics: Json | null;
  timeIncrementMetrics: Json | null;
  syncedAt: string;
}

export interface UpsertAdAccountsResult {
  count: number;
  rows: AdAccountRow[];
  byExternalAccountId: Map<string, AdAccountRow>;
}

async function selectAdAccountsByExternalIds(
  supabase: RepositoryClient,
  input: { businessId: string; platformId: string; externalAccountIds: string[] }
): Promise<AdAccountRow[]> {
  const rows: AdAccountRow[] = [];

  for (const externalIdsChunk of chunkArray(input.externalAccountIds, 250)) {
    const { data, error } = await supabase
      .from('ad_accounts')
      .select('*')
      .eq('business_id', input.businessId)
      .eq('platform_id', input.platformId)
      .in('external_account_id', externalIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));
  }

  return rows;
}

export async function upsertAdAccounts(
  supabase: RepositoryClient,
  inputs: UpsertAdAccountInput[]
): Promise<UpsertAdAccountsResult> {
  const normalizedInputs = dedupeBy(
    inputs.filter((input) => input.externalAccountId.trim().length > 0),
    (input) => input.externalAccountId
  );

  if (normalizedInputs.length === 0) {
    return {
      count: 0,
      rows: [],
      byExternalAccountId: new Map(),
    };
  }

  const { businessId, platformId } = normalizedInputs[0];
  const externalAccountIds = normalizedInputs.map((input) => input.externalAccountId);
  const existingRows = await selectAdAccountsByExternalIds(supabase, {
    businessId,
    platformId,
    externalAccountIds,
  });
  const existingByExternalId = new Map(
    existingRows.map((row) => [row.external_account_id, row] satisfies [string, AdAccountRow])
  );

  const rowsToUpdate: AdAccountInsert[] = [];
  const rowsToInsert: AdAccountInsert[] = [];

  for (const input of normalizedInputs) {
    const baseRow = {
      business_id: input.businessId,
      platform_id: input.platformId,
      external_account_id: input.externalAccountId,
      name: input.name,
      status: input.status,
      currency_code: input.currencyCode,
      timezone: input.timezone,
      aggregated_metrics: input.aggregatedMetrics,
      time_increment_metrics: input.timeIncrementMetrics,
      last_synced: input.syncedAt,
      updated_at: input.syncedAt,
    } satisfies AdAccountInsert;

    const existing = existingByExternalId.get(input.externalAccountId);
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
    const { error } = await supabase.from('ad_accounts').upsert(chunk, { onConflict: 'id' });

    if (error) {
      throw error;
    }
  }

  for (const chunk of chunkArray(rowsToInsert, 250)) {
    const { error } = await supabase.from('ad_accounts').insert(chunk);

    if (error) {
      throw error;
    }
  }

  const rows = await selectAdAccountsByExternalIds(supabase, {
    businessId,
    platformId,
    externalAccountIds,
  });

  return {
    count: rows.length,
    rows,
    byExternalAccountId: new Map(
      rows.map((row) => [row.external_account_id, row] satisfies [string, AdAccountRow])
    ),
  };
}
