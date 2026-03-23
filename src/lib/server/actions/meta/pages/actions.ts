"use server";

import { ApiResponse, ErrorCode } from "@/lib/shared/types/api";
import { fail, ok } from "@/lib/shared/utils/responses";
import { createSupabaseClient } from "@/lib/server/supabase/server";

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
            const errorResponse = fail(error.message, ErrorCode.DATABASE_ERROR, {
                userMessage: "We couldn't load your Meta pages. Please try again.",
                details: { platformId },
            });
            console.log("Returning error response:", errorResponse);
            return errorResponse;
        }

        if (!data || data.length === 0) {
            return ok([]);
        }


        const pages: MetaPage[] = data.map(page => ({
            id: page.id,
            page_id: page.page_id,
            name: page.name,
            instagram_account_id: page.instagram_account_id,
        }));

        return ok(pages);
    } catch (err) {
        console.error("Unexpected error fetching Meta pages:", err);
        return fail(
            err instanceof Error ? err.message : 'Unknown error',
            ErrorCode.UNKNOWN_ERROR,
            {
                userMessage: "An unexpected error occurred while loading your Meta pages."
            }
        );
    }

}
