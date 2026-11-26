import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { readAllPages } from '@/lib/server/repositories/pagination';
import type { AudienceObservation } from '@/lib/shared/reports/audience';
import type { HourlyObservation } from '@/lib/shared/reports/timeAnalysis';

export type AdSetBreakdowns = {
  /** Saved hour-by-hour rows inside the selected period. Null when they could not be read. */
  hourly: HourlyObservation[] | null;
  /**
   * Meta's age and gender totals for this ad set. They cover `audienceRange`, which is the saved
   * summary's own range and not the selected period. Null when they could not be read.
   */
  audience: AudienceObservation[] | null;
  audienceRange: { since: string; until: string } | null;
};

type Counts = { leads: number | null; messages: number | null; calls: number | null };
/** Results only when every part is known; a missing part is never counted as zero. */
const results = ({ leads, messages, calls }: Counts) => (leads === null || messages === null || calls === null ? null : leads + messages + calls);

/** `entityId` must be an ad set already authorized for this ad account. */
export async function loadAdSetBreakdowns(db: SupabaseClient<Database>, input: {
  accountId: string; entityId: string; since: string; until: string; currency: string | null;
}): Promise<AdSetBreakdowns> {
  const options = { nullDataError: 'Breakdown unavailable' };
  const [hourly, audience] = await Promise.all([
    readAllPages((from, to) => db.from('ad_entity_performance_hourly')
      .select('day,hour_of_day,currency_code,spend,impressions,clicks,inline_link_clicks,leads,messages,calls')
      .eq('ad_account_id', input.accountId).eq('entity_level', 'adset').eq('entity_id', input.entityId)
      .gte('day', input.since).lte('day', input.until).order('day').order('hour_of_day').range(from, to), options).catch(() => null),
    readAllPages((from, to) => db.from('ad_audience_breakdowns_summary')
      .select('dimension_1_value,dimension_2_value,first_day,last_day,currency_code,spend,impressions,clicks,leads,messages,calls')
      .eq('ad_account_id', input.accountId).eq('entity_level', 'adset').eq('entity_id', input.entityId)
      .eq('breakdown_type', 'age_gender').order('dimension_1_value').order('dimension_2_value').range(from, to), options).catch(() => null),
  ]);
  const money = (value: number | null, currency: string | null) => (currency === input.currency ? value : null);
  const days = (audience ?? []).flatMap((row) => (row.first_day && row.last_day ? [row.first_day, row.last_day] : [])).sort();
  return {
    hourly: hourly && hourly.map((row) => ({
      dayKey: row.day, hourOfDay: row.hour_of_day, spend: money(row.spend, row.currency_code),
      impressions: row.impressions, clicks: row.clicks, inlineLinkClicks: row.inline_link_clicks, results: results(row),
    })),
    audience: audience && audience.map((row) => ({
      date: row.last_day ?? '', age: row.dimension_1_value ?? '', gender: row.dimension_2_value ?? '', currencyCode: row.currency_code,
      values: { spend: money(row.spend, row.currency_code), impressions: row.impressions, clicks: row.clicks, conversion: results(row) },
    })),
    audienceRange: days.length ? { since: days[0], until: days[days.length - 1] } : null,
  };
}
