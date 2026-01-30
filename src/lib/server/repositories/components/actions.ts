'use server';

import { getAdSetsLifetimeIncludingZeros } from '@/lib/quieries/adsets/getAdSetsMetrics';
import { getAdsLifetimeIncludingZeros } from '@/lib/quieries/ads/getAdsMetrics';

// Ad sets for a campaign (adAccountId is your internal UUID)
export async function fetchAdSetsForCampaign(adAccountId: string, campaignExternalId: string) {
    return getAdSetsLifetimeIncludingZeros(adAccountId, { campaignExternalId });
}

// Ads for an ad set
export async function fetchAdsForAdset(adAccountId: string, adsetExternalId: string) {
    return getAdsLifetimeIncludingZeros(adAccountId, { adsetExternalId });
}
