import { getAccessToken } from "@/lib/actions/common/accessToken";
import { AdCreative } from 'facebook-nodejs-business-sdk';
import { FacebookAdsApi } from "../../../sdk/client";

export type PreviewType =
    | 'RIGHT_COLUMN_STANDARD'
    | 'DESKTOP_FEED_STANDARD'
    | 'MOBILE_FEED_STANDARD'
    | 'INSTAGRAM_STANDARD'
    | 'INSTAGRAM_STORY';

interface FetchCreativePreviewsParams {
    platformId: string;
    creativeId: string | null;
    previewTypes: string[];
}

/**
 * Fetches preview data for a specific Meta creative
 */
export async function fetchCreativePreviews({
    platformId,
    creativeId,
    previewTypes = ['DESKTOP_FEED_STANDARD', 'MOBILE_FEED_STANDARD']
}: FetchCreativePreviewsParams): Promise<Record<string, { body: string }>> {
    const accessToken = await getAccessToken(platformId);

    FacebookAdsApi.init(accessToken);

    const previews: Record<string, { body: string }> = {};

    await Promise.all(
        previewTypes.map(async (ad_format) => {
            try {
                const creative = new AdCreative(creativeId);
                const res = await creative.getPreviews([], { ad_format });
                if (Array.isArray(res) && res[0]?.body) {
                    previews[ad_format] = { body: res[0].body };
                }
            } catch (err) {
                console.error(`Error fetching preview for ${ad_format}:`, err);
                throw new Error(`Failed to fetch preview for ${ad_format}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        })
    );

    if (Object.keys(previews).length === 0) {
        throw new Error('No previews could be generated for this creative.');
    }

    return previews;
}