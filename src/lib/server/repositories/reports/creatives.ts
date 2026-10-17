import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { mediaFor } from '@/lib/server/campaigns/exploration/model';
import { chunkArray } from '../utils';
export type ReportCreative = Database['public']['Tables']['ad_creatives']['Row'];
/** Reuses the campaign media resolver and the report's already-authorized account scope. */
export async function listReportCreatives(client: SupabaseClient<Database>, input: { businessId: string; adAccountIds: string[]; platformCreativeIds: string[] }) {
  const rows: ReportCreative[] = [];
  if (!input.adAccountIds.length) return rows;
  for (const ids of chunkArray([...new Set(input.platformCreativeIds)], 200)) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from('ad_creatives').select('*')
        .eq('business_id', input.businessId).in('ad_account_id', input.adAccountIds)
        .in('platform_creative_id', ids).order('id').range(offset, offset + 999);
      // Media is optional. An unavailable creative must not erase measured performance.
      if (error) return [];
      rows.push(...data ?? []);
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}
export function reportCreativePreview(creative: ReportCreative | undefined) {
  if (!creative) return null;
  const media = mediaFor(creative);
  return { image: media.image, fallbackImages: media.fallbackImages, fallbackImage: media.fallbackImage, kind: media.kind };
}
