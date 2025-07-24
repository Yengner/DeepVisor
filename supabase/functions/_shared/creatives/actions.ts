'use server';

import { getAccessToken } from "@/lib/actions/common/accessToken";
import { AdAccount, AdCreative, FacebookAdsApi } from "../../../sdk/client";

export interface MetaCreative {
    id: string;
    name: string;
    thumbnail_url: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface GetExistingCreativesParams {
    platformId: string;
    adAccountId: string;
    limit?: number;
    after: string | null;
    before: string | null;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
}

/**
 * Fetch existing Meta ad creatives
 */
export async function fetchMetaCreatives({
    platformId,
    adAccountId,
    limit = 10,
    after = null,
    before = null,
    thumbnailWidth = 300,
    thumbnailHeight = 225
}: GetExistingCreativesParams): Promise<{
    creatives: MetaCreative[];
    totalCount: number;
    cursors: { before: string | null; after: string | null };
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}> {
    try {
        const accessToken = await getAccessToken(platformId);

        FacebookAdsApi.init(accessToken);

        const account = new AdAccount(adAccountId);

        const fields = [
            AdCreative.Fields.id,
            AdCreative.Fields.name,
            AdCreative.Fields.thumbnail_url,
            AdCreative.Fields.object_story_spec,
            AdCreative.Fields.object_type,
            AdCreative.Fields.call_to_action_type,
            AdCreative.Fields.asset_feed_spec,
        ];

        const params: Record<string, any> = {
            limit,
            thumbnail_width: thumbnailWidth,
            thumbnail_height: thumbnailHeight,
        };
        if (after) params.after = after;
        if (before) params.before = before;

        const creativesCursor = await account.getAdCreatives(fields, params);
        const creatives = creativesCursor.map((c: any) => c);

        const paging = creativesCursor.paging || {};
        const cursors = {
            before: paging.cursors?.before || null,
            after: paging.cursors?.after || null,
        };
        const hasNextPage = typeof creativesCursor.hasNext === "function" ? creativesCursor.hasNext() : !!paging.next;
        const hasPreviousPage = typeof creativesCursor.hasPrevious === "function" ? creativesCursor.hasPrevious() : !!paging.previous;

        return {
            creatives,
            totalCount: paging.total_count || creatives.length,
            cursors,
            hasNextPage,
            hasPreviousPage
        };
    } catch (err) {
        console.error('Meta creatives SDK error:', err);
        throw new Error(`Meta creatives SDK error: ${err instanceof Error ? err.message : 'Unknown error'}`);

    }
}