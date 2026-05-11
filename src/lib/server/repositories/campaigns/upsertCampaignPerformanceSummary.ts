import { refreshAdEntityPerformanceSummaries } from '../ad_entities/refreshAdEntityPerformanceSummaries';
import type { RepositoryClient } from '../utils';
import type { CampaignDimRow } from './upsertCampaignDims';

export async function upsertCampaignPerformanceSummary(
  supabase: RepositoryClient,
  input: {
    campaigns: CampaignDimRow[];
    syncedAt: string;
  }
): Promise<{ count: number }> {
  return refreshAdEntityPerformanceSummaries(supabase, {
    entities: input.campaigns,
    syncedAt: input.syncedAt,
  });
}
