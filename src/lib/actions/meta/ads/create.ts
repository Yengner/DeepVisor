import { MetaAdParams } from "./types";

/**
 * Creates a single ad in the Meta Ads platform
 * 
 * @param params - Parameters for ad creation
 * @returns Ad ID from Meta API
 */
export async function createAd(params: MetaAdParams): Promise<string> {
  const { adAccountId, accessToken, adsetId, creativeId, formData } = params;

  try {
    const url = `https://graph.facebook.com/v23.0/${adAccountId}/ads`;

    // Simplified ad parameters focusing on the basics
    const adParams = {
      name: `${formData.campaignName} - Ad`,
      adset_id: adsetId,
      creative: {
        creative_id: creativeId
      },
      status: "PAUSED", // Always paused for safety
      access_token: accessToken
    };

    // Make the API request
    const adsRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adParams)
    });

    // Handle errors
    if (!adsRes.ok) {
      const text = await adsRes.text();
      console.error("❌ Facebook API Error (Ad):", text);
      throw new Error("Failed to create ad. Check logs for full response.");
    }

    // Process successful response
    const adData = await adsRes.json();
    console.log(`✅ Ad created:`, adData);

    return adData.id;
  } catch (err) {
    console.error("Error in Ad creation:", err);
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