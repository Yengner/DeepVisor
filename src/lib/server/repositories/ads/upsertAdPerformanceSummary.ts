import { refreshAdEntityPerformanceSummaries } from '../ad_entities/refreshAdEntityPerformanceSummaries';
import type { RepositoryClient } from '../utils';
import type { AdDimRow } from './upsertAdDims';

export async function upsertAdPerformanceSummary(
  supabase: RepositoryClient,
  input: {
    ads: AdDimRow[];
    syncedAt: string;
  }
): Promise<{ count: number }> {
  return refreshAdEntityPerformanceSummaries(supabase, {
    entities: input.ads,
    syncedAt: input.syncedAt,
  });
}
