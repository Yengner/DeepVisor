"use server";

import { ApiResponse, ErrorCode } from "@/lib/utils/error-handling/types/api";
import { createErrorResponse, createSuccessResponse } from "@/lib/utils/error-handling";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export interface MetaPage {
    id: string;
    page_id: string;
    name: string;
    instagram_account_id?: string;
}

interface GetMetaPagesParams {
    platformId: string;
}


/**
 * Fetches Meta Pages that the user has from the DB
 */
export async function getMetaPages({ platformId }: GetMetaPagesParams): Promise<ApiResponse<MetaPage[]>> {
    try {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
            .from('meta_pages')
            .select('*')
            .eq('platform_integration_id', platformId);

        if (error) {
            const errorResponse = createErrorResponse(
                ErrorCode.DATABASE_ERROR,
                error.message,
                "We couldn't load your Meta pages. Please try again.",
                error
            );
            console.log("Returning error response:", errorResponse);
            return errorResponse;
        }

        if (!data || data.length === 0) {
            return createSuccessResponse([]);
        }


        const pages: MetaPage[] = data.map(page => ({
            id: page.id,
            page_id: page.page_id,
            name: page.name,
            instagram_account_id: page.instagram_account_id,
        }));

        return createSuccessResponse(pages);
    } catch (err) {
        console.error("Unexpected error fetching Meta pages:", err);
        return createErrorResponse(
            ErrorCode.UNKNOWN_ERROR,
            err instanceof Error ? err.message : 'Unknown error',
            "An unexpected error occurred while loading your Meta pages."
        );
    }

}