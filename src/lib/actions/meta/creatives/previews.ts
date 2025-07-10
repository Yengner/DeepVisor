'use server';

import { ApiResponse, ErrorCode } from "@/lib/types/api";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/error-handling";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export type PreviewType =
    | 'RIGHT_COLUMN_STANDARD'
    | 'DESKTOP_FEED_STANDARD'
    | 'MOBILE_FEED_STANDARD'
    | 'INSTAGRAM_STANDARD'
    | 'INSTAGRAM_STORY';

interface FetchCreativePreviewsParams {
    platformId: string;
    creativeId: string;
    previewTypes: PreviewType[];
}

/**
 * Fetches preview data for a specific Meta creative
 */
export async function fetchCreativePreviews({
    platformId,
    creativeId,
    previewTypes = ['DESKTOP_FEED_STANDARD', 'MOBILE_FEED_STANDARD']
}: FetchCreativePreviewsParams): Promise<ApiResponse<Record<string, { body: string }>>> {
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
                ErrorCode.INTEGRATION_ERROR,
                "Failed to get Meta integration",
                "We couldn't access your Meta account. Please reconnect your account."
            );
        }

        const accessToken = integration.access_token;

        // Build URL for preview endpoint
        const url = new URL(`https://graph.facebook.com/v23.0/${creativeId}/previews`);
        url.searchParams.set('ad_format', 'DESKTOP_FEED_STANDARD'); // Default format
        url.searchParams.set('access_token', accessToken);

        // Fetch preview data
        const resp = await fetch(url.toString());

        if (!resp.ok) {
            const text = await resp.text();
            console.error(`Meta creative preview error:`, text);
            return createErrorResponse(
                ErrorCode.EXTERNAL_API_ERROR,
                `Failed to fetch creative previews: ${text}`,
                "We couldn't load the preview for this creative."
            );
        }

        const data = await resp.json();
        const previews: Record<string, { body: string }> = {};
        // Process preview data for requested types
        if (Array.isArray(data.data)) {
            // Process each preview in the array
            data.data.forEach((preview: any, index: number) => {
                if (preview && preview.body) {
                    // Use the previewType as key if available, or fallback to index
                    const key = previewTypes[index] || `preview_${index}`;
                    previews[key] = {
                        body: preview.body
                    };
                }
            });
        }
        console.log('Processed Meta creative previews:', previews);
        return createSuccessResponse(previews);
    } catch (err: any) {
        console.error('Meta creative previews error:', err);
        return createErrorResponse(
            ErrorCode.UNKNOWN_ERROR,
            err instanceof Error ? err.message : 'Server error processing request',
            "We couldn't load the preview for this creative due to an unexpected error."
        );
    }
}