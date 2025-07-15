import { MetaAdParams } from "../types";
import { AdAccount, Ad } from "../sdk/client";
import { logApiCallResult } from "../sdk/utils";

/**
 * Creates a single ad in the Meta Ads platform using the SDK
 * 
 * @param params - Parameters for ad creation
 * @returns Ad ID from Meta API
 */
export async function createAd(params: MetaAdParams): Promise<string> {
  const { adAccountId, adsetId, creativeId, formData } = params;

  try {
    const adParams: Record<string, any> = {
      [Ad.Fields.name]: `${formData.campaignName} - Ad`,
      [Ad.Fields.adset_id]: adsetId,
      [Ad.Fields.creative]: { creative_id: creativeId },
      [Ad.Fields.status]: "PAUSED", // Paused for testing
    };

    const account = new AdAccount(adAccountId);
    const ad = await account.createAd(
      [Ad.Fields.id, Ad.Fields.name],
      adParams
    );

    logApiCallResult("createAd", ad);

    return ad.id;
  } catch (err) {
    logApiCallResult("createAd ERROR", err, true);
    throw err;
  }
}

/* 
// Smart campaign functionality - disabled for now
// Create multiple ads for smart campaigns
export async function createSmartAds(
  params: Omit<MetaAdParams, 'adsetId' | 'creativeId' | 'adVariation'>,
  adsetIds: string[],
  creativeIds: string[]
): Promise<string[]> {
  const adIds: string[] = [];
  
  // Create ads combining different ad sets with different creatives
  for (let i = 0; i < adsetIds.length; i++) {
    // Get the creative that matches this adset's position, or use the first one if not enough creatives
    const creativeId = creativeIds[i % creativeIds.length];
    
    const adId = await createAd({
      ...params,
      adsetId: adsetIds[i],
      creativeId: creativeId,
      adVariation: i,
      isSmartCampaign: true
    });
    adIds.push(adId);
  }
  
  return adIds;
}
*/