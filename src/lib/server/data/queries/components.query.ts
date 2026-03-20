'use server';

import { getAdSetsLifetimeIncludingZeros } from './adsets.query';
import { getAdsLifetimeIncludingZeros } from './ads.query';
import type { AdSetLifetimeRow } from './adsets.query';
import type { AdLifetimeRow } from './ads.query';

export async function fetchAdSetsForCampaign(
  adAccountId: string,
  campaignExternalId: string
): Promise<AdSetLifetimeRow[]> {
  return getAdSetsLifetimeIncludingZeros(adAccountId, { campaignExternalId });
}

export async function fetchAdsForAdset(
  adAccountId: string,
  adsetExternalId: string
): Promise<AdLifetimeRow[]> {
  return getAdsLifetimeIncludingZeros(adAccountId, { adsetExternalId });
}
