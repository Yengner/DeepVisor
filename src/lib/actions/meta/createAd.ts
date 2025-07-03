import { MetaAdParams } from "./types";

export async function createAd(params: MetaAdParams): Promise<string> {
  const { adAccountId, accessToken, adsetId, creativeId, formData, isSmartCampaign, adVariation = 0 } = params;
  
  try {
    const url = `https://graph.facebook.com/v21.0/${adAccountId}/ads`;

    const adParams = {
      name: `[DeepVisor${isSmartCampaign ? ' Smart' : ''}] ${formData.campaignName}${isSmartCampaign ? ` - Ad ${adVariation}` : ''}`,
      adset_id: adsetId,
      creative: {
        creative_id: creativeId
      },
      status: "PAUSED", // Always paused for safety
      adlabels: isSmartCampaign ? [
        {
          name: "ad_variation",  
          value: String(adVariation)
        },
        {
          name: "smart_campaign",  
          value: "true"
        }
      ] : undefined,
      access_token: accessToken
    };

    const adsRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adParams)
    });

    if (!adsRes.ok) {
      const text = await adsRes.text();
      console.error("❌ Facebook API Error (Ad):", text);
      throw new Error("Failed to create ad. Check logs for full response.");
    }

    const adData = await adsRes.json();
    console.log(`✅ Ad created (variation ${adVariation}):`, adData);
    
    return adData.id;
  } catch (err) {
    console.error("Error in Ad creation:", err);
    throw err;
  }
}

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