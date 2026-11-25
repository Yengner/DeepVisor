'use server';

import { getAdSetsLifetimeIncludingZeros, type AdSetLifetimeRow } from '@/lib/server/repositories/adsets/getAdSetsMetrics';
import { getAdsLifetimeIncludingZeros, type AdLifetimeRow } from '@/lib/server/repositories/ads/getAdsMetrics';
import { createSupabaseClient } from '@/lib/server/supabase/server';
import { parseTableRange, type TableRange } from '@/lib/shared/performance/periodTotals';
import { accountToday } from '@/lib/shared/reports/dates';

/** The account-local period for drill-down rows; RLS scopes the account read to the caller. */
async function tableRange(adAccountId: string, range: TableRange | undefined) {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from('ad_accounts').select('timezone').eq('id', adAccountId).maybeSingle();
  if (error) throw error;
  const timezone = data?.timezone ?? null;
  return { range: parseTableRange(range), today: accountToday(timezone) ?? new Date().toISOString().slice(0, 10), timezone };
}

export async function fetchAdSetsForCampaign(
  adAccountId: string,
  campaignExternalId: string,
  range?: TableRange
): Promise<AdSetLifetimeRow[]> {
  return getAdSetsLifetimeIncludingZeros(adAccountId, { campaignExternalId, range: await tableRange(adAccountId, range) });
}

export async function fetchAdsForAdset(
  adAccountId: string,
  adsetExternalId: string,
  range?: TableRange
): Promise<AdLifetimeRow[]> {
  return getAdsLifetimeIncludingZeros(adAccountId, { adsetExternalId, range: await tableRange(adAccountId, range) });
}
