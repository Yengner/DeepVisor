import { refreshAdEntityPerformanceSummaries } from '../ad_entities/refreshAdEntityPerformanceSummaries';
import type { RepositoryClient } from '../utils';
import type { AdsetDimRow } from './upsertAdsetDims';

export async function upsertAdsetPerformanceSummary(
  supabase: RepositoryClient,
  input: {
    adsets: AdsetDimRow[];
    syncedAt: string;
  }
): Promise<{ count: number }> {
  return refreshAdEntityPerformanceSummaries(supabase, {
    entities: input.adsets,
    syncedAt: input.syncedAt,
  });
}
