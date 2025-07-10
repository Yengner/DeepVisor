'use server';

import { ApiResponse, ErrorCode } from "@/lib/types/api";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/error-handling";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { makeMetaApiGetRequest } from '../helpers/apiHelpers';

// Simple interface - just passing through what the API returns
export interface MetaCreative {
    id: string;
    name: string;
    thumbnail_url?: string;
    // Any other fields will be passed through as-is
    [key: string]: any;
}

export interface GetExistingCreativesParams {
    platformId: string;
    adAccountId: string;
    page?: number;
    limit?: number;
}

/**
 * Fetch existing Meta ad creatives
 */
export async function fetchExistingCreatives({
    platformId,
    adAccountId,
    page = 1,
    limit = 9
}: GetExistingCreativesParams): Promise<ApiResponse<{
    creatives: MetaCreative[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
}>> {
    try {
        const supabase = await createSupabaseClient();
        // Get access token
        const { data: integration, error: integrationError } = await supabase
            .from("platform_integrations")
            .select("access_token")
            .eq("id", platformId)
            .eq("platform_name", "meta")
            .single();

        if (integrationError || !integration?.access_token) {
            return createErrorResponse(
                ErrorCode.DATABASE_ERROR,
                "Failed to get database integration",
                "We couldn't access your Meta account. Please reconnect your account."
            );
        }

        const accessToken = integration.access_token;

        // Fields to fetch from Meta API
        const baseFields = [
            'id', 'name', 'thumbnail_url',
            'object_story_spec', 'object_type', 'call_to_action_type',
            'call_to_action', 'asset_feed_spec',
        ];

        // Calculate pagination parameters
        const offset = (page - 1) * limit;

        try {
            // Use our helper to make the API request
            const result = await makeMetaApiGetRequest(
                `https://graph.facebook.com/v23.0/${adAccountId}/adcreatives`,
                {
                    fields: baseFields,
                    access_token: accessToken,
                    limit,
                    offset: offset > 0 ? offset : undefined
                },
                'creatives'
            );

            const { data = [], paging } = result;

            // Just pass through the creatives as-is
            // No complex processing

            console.log(`Total creatives found: ${paging?.total_count || data.length}`);

            return createSuccessResponse({
                creatives: data,
                totalCount: paging?.total_count || data.length,
                currentPage: page,
                totalPages: Math.ceil((paging?.total_count || data.length) / limit) || 1
            });

        } catch (apiError) {
            return createErrorResponse(
                ErrorCode.EXTERNAL_API_ERROR,
                apiError instanceof Error ? apiError.message : 'Unknown API error',
                "We couldn't load your Meta creatives. Please try again later."
            );
        }
    } catch (err: any) {
        console.error('Meta creatives server action error:', err);
        return createErrorResponse(
            ErrorCode.UNKNOWN_ERROR,
            err instanceof Error ? err.message : 'Server error processing request',
            "We couldn't load your Meta creatives due to an unexpected error."
        );
    }
}