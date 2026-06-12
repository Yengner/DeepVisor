import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createServerClient } from '@/lib/server/supabase/server';
import { chunkArray } from '@/lib/server/repositories/utils';
import { ErrorCode, fail, ok } from '@/lib/shared';
import type {
  CreativeLibraryItem,
  CreativeLibrarySource,
  CreativeLibraryStats,
} from '@/lib/shared/types/creativeLibrary';
import type { Json } from '@/lib/shared/types/supabase';

export const dynamic = 'force-dynamic';

type AdCreativeRow = {
  id: string;
  platform_creative_id: string;
  name: string | null;
  creative_type: string | null;
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  video_id: string | null;
  object_story_id: string | null;
  object_story_spec: Json;
  updated_at: string;
};

type AdDimRow = {
  id: string;
  creative_id: string | null;
  created_time: string | null;
};

type AdPerformanceRow = {
  ad_id: string | null;
  spend: number | null;
  leads: number | null;
  messages: number | null;
  calls: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  cost_per_result: number | null;
  first_day: string | null;
  last_day: string | null;
};

type StatAccumulator = {
  spend: number;
  leads: number;
  messages: number;
  calls: number;
  clicks: number;
  impressions: number;
  firstDay: string | null;
  lastDay: string | null;
};

const EMPTY_STATS: CreativeLibraryStats = {
  spend: 0,
  results: 0,
  leads: 0,
  messages: 0,
  calls: 0,
  clicks: 0,
  impressions: 0,
  ctr: null,
  costPerResult: null,
  firstDay: null,
  lastDay: null,
};

function emptyAccumulator(): StatAccumulator {
  return {
    spend: 0,
    leads: 0,
    messages: 0,
    calls: 0,
    clicks: 0,
    impressions: 0,
    firstDay: null,
    lastDay: null,
  };
}

function addPerformance(accumulator: StatAccumulator, row: AdPerformanceRow): void {
  accumulator.spend += row.spend ?? 0;
  accumulator.leads += row.leads ?? 0;
  accumulator.messages += row.messages ?? 0;
  accumulator.calls += row.calls ?? 0;
  accumulator.clicks += row.clicks ?? 0;
  accumulator.impressions += row.impressions ?? 0;

  if (row.first_day && (!accumulator.firstDay || row.first_day < accumulator.firstDay)) {
    accumulator.firstDay = row.first_day;
  }

  if (row.last_day && (!accumulator.lastDay || row.last_day > accumulator.lastDay)) {
    accumulator.lastDay = row.last_day;
  }
}

function statsFromAccumulator(accumulator: StatAccumulator | null | undefined): CreativeLibraryStats {
  if (!accumulator) {
    return EMPTY_STATS;
  }

  const results = accumulator.leads + accumulator.messages + accumulator.calls;

  return {
    spend: accumulator.spend,
    results,
    leads: accumulator.leads,
    messages: accumulator.messages,
    calls: accumulator.calls,
    clicks: accumulator.clicks,
    impressions: accumulator.impressions,
    ctr: accumulator.impressions > 0 ? accumulator.clicks / accumulator.impressions : null,
    costPerResult: results > 0 ? accumulator.spend / results : null,
    firstDay: accumulator.firstDay,
    lastDay: accumulator.lastDay,
  };
}

function scoreStats(stats: CreativeLibraryStats): number {
  const costPenalty = stats.costPerResult != null ? Math.min(stats.costPerResult, 500) : 0;
  return stats.results * 100 + (stats.ctr ?? 0) * 100 + Math.min(stats.spend, 1000) * 0.02 - costPenalty;
}

function displayName(creative: AdCreativeRow): string {
  return (
    creative.name ||
    creative.headline ||
    creative.primary_text ||
    creative.description ||
    `Creative ${creative.platform_creative_id.slice(-8)}`
  );
}

function imageForCreative(creative: AdCreativeRow): string | null {
  return creative.thumbnail_url || creative.image_url || null;
}

function markBest(items: CreativeLibraryItem[]): CreativeLibraryItem[] {
  const bestIndex = items.findIndex(
    (item) => item.stats.results > 0 || item.stats.spend > 0 || item.stats.impressions > 0
  );

  return items.map((item, index) => ({
    ...item,
    isBest: index === bestIndex,
  }));
}

function sortBest(items: CreativeLibraryItem[]): CreativeLibraryItem[] {
  return [...items].sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const spendDiff = right.stats.spend - left.stats.spend;
    if (spendDiff !== 0) {
      return spendDiff;
    }

    return (right.updatedTime ?? '').localeCompare(left.updatedTime ?? '');
  });
}

async function listPerformanceRows(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  adIds: string[]
): Promise<AdPerformanceRow[]> {
  const rows: AdPerformanceRow[] = [];

  for (const adIdsChunk of chunkArray(adIds, 200)) {
    const { data, error } = await supabase
      .from('ad_performance_summary')
      .select('ad_id, spend, leads, messages, calls, clicks, impressions, ctr, cost_per_result, first_day, last_day')
      .in('ad_id', adIdsChunk);

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as AdPerformanceRow[]));
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const platformId = request.nextUrl.searchParams.get('platformId');
    const externalAdAccountId = request.nextUrl.searchParams.get('adAccountId');
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 120, 20), 200);

    if (!platformId || !externalAdAccountId) {
      return NextResponse.json(
        fail('Missing creative library context', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Select a connected Meta ad account before choosing creative.',
        }),
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const [{ data: integration, error: integrationError }, { data: adAccount, error: adAccountError }] =
      await Promise.all([
        supabase
          .from('platform_integrations')
          .select('id, business_id, platform_id, status')
          .eq('id', platformId)
          .eq('business_id', businessId)
          .maybeSingle(),
        supabase
          .from('ad_accounts')
          .select('id, business_id, platform_id, external_account_id')
          .eq('business_id', businessId)
          .eq('external_account_id', externalAdAccountId)
          .maybeSingle(),
      ]);

    if (integrationError) {
      throw integrationError;
    }

    if (adAccountError) {
      throw adAccountError;
    }

    if (!integration || integration.status !== 'connected' || !adAccount || adAccount.platform_id !== integration.platform_id) {
      return NextResponse.json(
        fail('Invalid creative library context', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'The selected Meta account is not connected.',
        }),
        { status: 400 }
      );
    }

    const [{ data: creativesData, error: creativesError }, { data: adsData, error: adsError }] =
      await Promise.all([
        supabase
          .from('ad_creatives')
          .select(
            'id, platform_creative_id, name, creative_type, primary_text, headline, description, image_url, thumbnail_url, video_id, object_story_id, object_story_spec, updated_at'
          )
          .eq('ad_account_id', adAccount.id)
          .order('updated_at', { ascending: false })
          .limit(limit),
        supabase
          .from('ad_dims')
          .select('id, creative_id, created_time')
          .eq('ad_account_id', adAccount.id)
          .not('creative_id', 'is', null),
      ]);

    if (creativesError) {
      throw creativesError;
    }

    if (adsError) {
      throw adsError;
    }

    const creatives = (creativesData ?? []) as AdCreativeRow[];
    const ads = (adsData ?? []) as AdDimRow[];
    const adIds = ads.map((ad) => ad.id).filter((id): id is string => Boolean(id));
    const performanceRows = adIds.length > 0 ? await listPerformanceRows(supabase, adIds) : [];
    const performanceByAdId = new Map(performanceRows.map((row) => [row.ad_id, row]));
    const statsByCreativeId = new Map<string, StatAccumulator>();
    const adCreatedTimesByCreativeId = new Map<string, string[]>();

    for (const ad of ads) {
      if (!ad.id || !ad.creative_id) {
        continue;
      }

      const accumulator = statsByCreativeId.get(ad.creative_id) ?? emptyAccumulator();
      const performance = performanceByAdId.get(ad.id);
      if (performance) {
        addPerformance(accumulator, performance);
      }
      statsByCreativeId.set(ad.creative_id, accumulator);

      if (ad.created_time) {
        const dates = adCreatedTimesByCreativeId.get(ad.creative_id) ?? [];
        dates.push(ad.created_time);
        adCreatedTimesByCreativeId.set(ad.creative_id, dates);
      }
    }

    const adCreatives = markBest(
      sortBest(
        creatives.map((creative) => {
          const stats = statsFromAccumulator(statsByCreativeId.get(creative.platform_creative_id));
          const createdTimes = adCreatedTimesByCreativeId.get(creative.platform_creative_id) ?? [];
          const createdTime = createdTimes.length > 0 ? createdTimes.sort()[0] : null;

          return {
            id: creative.platform_creative_id,
            source: 'ad_creative' as CreativeLibrarySource,
            sourceId: creative.platform_creative_id,
            name: displayName(creative),
            thumbnail_url: imageForCreative(creative),
            type: creative.creative_type || (creative.video_id ? 'Video creative' : 'Ad creative'),
            createdTime,
            updatedTime: creative.updated_at,
            stats,
            score: scoreStats(stats),
            isBest: false,
            creativeIds: [creative.platform_creative_id],
            postId: creative.object_story_id ?? null,
          } satisfies CreativeLibraryItem;
        })
      )
    );

    const postsById = new Map<string, AdCreativeRow[]>();
    for (const creative of creatives) {
      if (!creative.object_story_id) {
        continue;
      }

      const group = postsById.get(creative.object_story_id) ?? [];
      group.push(creative);
      postsById.set(creative.object_story_id, group);
    }

    const pagePosts = markBest(
      sortBest(
        Array.from(postsById.entries()).map(([postId, postCreatives]) => {
          const accumulator = emptyAccumulator();
          const creativeIds = postCreatives.map((creative) => creative.platform_creative_id);

          for (const creativeId of creativeIds) {
            const creativeStats = statsByCreativeId.get(creativeId);
            if (!creativeStats) {
              continue;
            }

            accumulator.spend += creativeStats.spend;
            accumulator.leads += creativeStats.leads;
            accumulator.messages += creativeStats.messages;
            accumulator.calls += creativeStats.calls;
            accumulator.clicks += creativeStats.clicks;
            accumulator.impressions += creativeStats.impressions;
            if (creativeStats.firstDay && (!accumulator.firstDay || creativeStats.firstDay < accumulator.firstDay)) {
              accumulator.firstDay = creativeStats.firstDay;
            }
            if (creativeStats.lastDay && (!accumulator.lastDay || creativeStats.lastDay > accumulator.lastDay)) {
              accumulator.lastDay = creativeStats.lastDay;
            }
          }

          const representative = postCreatives[0];
          const stats = statsFromAccumulator(accumulator);

          return {
            id: `post:${postId}`,
            source: 'page_post' as CreativeLibrarySource,
            sourceId: postId,
            name: representative.primary_text || representative.headline || representative.name || `Page post ${postId.slice(-8)}`,
            thumbnail_url: imageForCreative(representative),
            type: 'Page post',
            createdTime: null,
            updatedTime: representative.updated_at,
            stats,
            score: scoreStats(stats),
            isBest: false,
            creativeIds,
            postId,
          } satisfies CreativeLibraryItem;
        })
      )
    );

    return NextResponse.json(
      ok({
        adCreatives,
        pagePosts,
      })
    );
  } catch (error) {
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to load creative library',
        ErrorCode.UNKNOWN_ERROR,
        {
          userMessage: 'We could not load existing creatives right now.',
        }
      ),
      { status: 500 }
    );
  }
}
