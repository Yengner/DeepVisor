import { chunkArray, type RepositoryClient } from '../utils';
import type { AdEntityLevel } from './types';

export type UpsertAdEntityPerformanceSummaryInput = {
  entityId: string;
  adAccountId: string;
  entityLevel: AdEntityLevel;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  calls: number;
  firstDay: string | null;
  lastDay: string | null;
  summarySource: string;
  historyStatus: string;
  syncedAt: string;
};

function toDay(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export async function upsertAdEntityPerformanceSummaries(
  supabase: RepositoryClient,
  inputs: UpsertAdEntityPerformanceSummaryInput[]
): Promise<{ count: number }> {
  const rows = inputs
    .filter((input) => input.entityId && input.adAccountId)
    .map((input) => {
      const results = input.leads + input.messages + input.calls;

      return {
        entity_id: input.entityId,
        ad_account_id: input.adAccountId,
        entity_level: input.entityLevel,
        spend: input.spend,
        impressions: input.impressions,
        reach: input.reach,
        clicks: input.clicks,
        inline_link_clicks: input.inlineLinkClicks,
        leads: input.leads,
        messages: input.messages,
        calls: input.calls,
        ctr: input.impressions > 0 ? (input.clicks / input.impressions) * 100 : null,
        cpc: input.clicks > 0 ? input.spend / input.clicks : null,
        cpm: input.impressions > 0 ? input.spend / (input.impressions / 1000) : null,
        frequency: input.reach > 0 ? input.impressions / input.reach : null,
        cost_per_result: results > 0 ? input.spend / results : null,
        first_day: toDay(input.firstDay),
        last_day: toDay(input.lastDay),
        best_day: null,
        worst_day: null,
        summary_source: input.summarySource,
        history_status: input.historyStatus,
        synced_at: input.syncedAt,
        updated_at: input.syncedAt,
      };
    });

  if (rows.length === 0) {
    return { count: 0 };
  }

  const client = supabase as any;

  for (const chunk of chunkArray(rows, 500)) {
    const { error } = await client
      .from('ad_entity_performance_summary')
      .upsert(chunk, { onConflict: 'entity_id' });

    if (error) {
      throw error;
    }
  }

  return { count: rows.length };
}
