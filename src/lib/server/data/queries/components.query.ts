'use server';

import { getAdSetsLifetimeIncludingZeros } from './adsets.query';
import { getAdsLifetimeIncludingZeros } from './ads.query';

export async function fetchAdSetsForCampaign(adAccountId: string, campaignExternalId: string) {
  return getAdSetsLifetimeIncludingZeros(adAccountId, { campaignExternalId });
}

export async function fetchAdsForAdset(adAccountId: string, adsetExternalId: string) {
  return getAdsLifetimeIncludingZeros(adAccountId, { adsetExternalId });
}

