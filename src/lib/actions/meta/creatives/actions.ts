'use server';

import { ApiResponse, ErrorCode } from "@/lib/types/api";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/error-handling";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { makeMetaApiGetRequest } from '../helpers/apiHelpers';
import { getMetaAccessToken } from "@/lib/utils/common/accessToken";

// Simple interface - just passing through what the API returns
export interface MetaCreative {
    id: string;
    name: string;
    thumbnail_url?: string;
    // Any other fields will be passed through as-is
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
export async function fetchExistingCreatives({
    platformId,
    adAccountId,
    limit = 25,
    after = null,
    before = null,
    thumbnailWidth = 300,
    thumbnailHeight = 225
}: GetExistingCreativesParams): Promise<ApiResponse<{
    creatives: MetaCreative[];
    totalCount: number;
    cursors: {
        before: string | null;
        after: string | null;
    };
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}>> {
    try {

        const accessTokenResult = await getMetaAccessToken(platformId);

        if (typeof accessTokenResult !== 'string') {
            console.error("Failed to get Meta access token:", accessTokenResult);
            return createErrorResponse(
                ErrorCode.INTEGRATION_ERROR,
                "Failed to get Meta access token",
                "We couldn't access your Meta account. Please reconnect your account."
            );
        }

        const accessToken = accessTokenResult;

        // Fields to fetch from Meta API
        const baseFields = [
            'id', 'name', 'thumbnail_url',
            'object_story_spec', 'object_type', 'call_to_action_type',
            'call_to_action', 'asset_feed_spec',
        ];

        const params: Record<string, string | string[] | number | undefined> = {
            fields: baseFields,
            access_token: accessToken,
            limit,
            thumbnail_width: thumbnailWidth,
            thumbnail_height: thumbnailHeight,
        };

        if (after) {
            params.after = after;
        } else if (before) {
            params.before = before;
        }
        try {


            const result = await makeMetaApiGetRequest(
                `https://graph.facebook.com/v23.0/${adAccountId}/adcreatives`,
                params,
                'creatives'
            );

            const { data = [], paging } = result;

            // Extract cursors for pagination
            const cursors = {
                before: paging?.cursors?.before || null,
                after: paging?.cursors?.after || null
            };

            // Determine if we have next/previous pages
            const hasNextPage = !!paging?.next;
            const hasPreviousPage = !!paging?.previous;

            return createSuccessResponse({
                creatives: data,
                totalCount: paging?.total_count || data.length,
                cursors,
                hasNextPage,
                hasPreviousPage
            });

        } catch (apiError) {
            return createErrorResponse(
                ErrorCode.EXTERNAL_API_ERROR,
                apiError instanceof Error ? apiError.message : 'Unknown API error',
                "We couldn't load your Meta creatives. Please try again later."
            );
        }
    } catch (err) {
        console.error('Meta creatives server action error:', err);
        return createErrorResponse(
            ErrorCode.UNKNOWN_ERROR,
            err instanceof Error ? err.message : 'Server error processing request',
            "We couldn't load your Meta creatives due to an unexpected error."
        );
    }
}