"use server";

import { ApiResponse, ErrorCode } from "@/lib/shared/types/api";
import { fail, ok } from "@/lib/shared/utils/responses";
import { getRequiredAppContext } from "@/lib/server/actions/app/context";
import {
    getBusinessIntegrationById,
    resolveIntegrationAccessToken,
} from "@/lib/server/integrations/service";
import { fetchMetaCollection } from "@/lib/server/sync/meta/client";
import { createSupabaseClient } from "@/lib/server/supabase/server";

export interface MetaPage {
    id: string;
    page_id: string;
    name: string;
    instagram_account_id?: string;
    picture_url?: string;
}

interface GetMetaPagesParams {
    platformId: string;
}

type MetaGraphPage = {
    id?: string;
    name?: string;
    instagram_business_account?: {
        id?: string;
    };
    picture?: {
        data?: {
            url?: string;
        };
    };
};

function isMissingMetaPagesTableError(message: string): boolean {
    return message.includes('relation "public.meta_pages" does not exist');
}

async function getStoredMetaPages(platformId: string): Promise<MetaPage[]> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
        .from('meta_pages')
        .select('*')
        .eq('platform_integration_id', platformId);

    if (error) {
        if (isMissingMetaPagesTableError(error.message)) {
            return [];
        }

        throw error;
    }

    return (data ?? []).map(page => ({
        id: page.id,
        page_id: page.page_id,
        name: page.name,
        instagram_account_id: page.instagram_account_id,
    }));
}

function normalizeGraphPage(page: MetaGraphPage): MetaPage | null {
    if (!page.id || !page.name) {
        return null;
    }

    return {
        id: page.id,
        page_id: page.id,
        name: page.name,
        instagram_account_id: page.instagram_business_account?.id,
        picture_url: page.picture?.data?.url,
    };
}

/**
 * Fetches live Meta Pages available to the connected integration.
 */
export async function getMetaPages({ platformId }: GetMetaPagesParams): Promise<ApiResponse<MetaPage[]>> {
    try {
        const { businessId } = await getRequiredAppContext();
        const supabase = await createSupabaseClient();
        const integration = await getBusinessIntegrationById(supabase, {
            businessId,
            integrationId: platformId,
        });
        console.log('integration', integration);
        if (!integration || integration.platformKey !== 'meta' || !integration.isIntegrated) {
            return fail('Meta integration is not connected.', ErrorCode.INTEGRATION_ERROR, {
                userMessage: 'Connect Meta before choosing a Facebook Page.',
                details: { platformId },
            });
        }

        const accessToken = await resolveIntegrationAccessToken(supabase, integration);
        if (!accessToken) {
            return fail('Missing Meta access token.', ErrorCode.INTEGRATION_ERROR, {
                userMessage: 'Reconnect Meta before choosing a Facebook Page.',
                details: { platformId },
            });
        }

        try {
            const pages = await fetchMetaCollection<MetaGraphPage>({
                path: 'me/accounts',
                accessToken,
                params: {
                    fields: 'id,name,instagram_business_account,picture{url}',
                    limit: 100,
                },
            });
            console.log('fetched pages from Meta API', { platformId, pages });
            return ok(pages.map(normalizeGraphPage).filter((page): page is MetaPage => Boolean(page)));
        } catch (error) {
            const storedPages = await getStoredMetaPages(platformId).catch(() => []);
            if (storedPages.length > 0) {
                console.warn('Falling back to stored Meta pages after live fetch failed', {
                    platformId,
                    error: error instanceof Error ? error.message : String(error),
                });
                return ok(storedPages);
            }

            throw error;
        }
    } catch (err) {
        console.error("Unexpected error fetching Meta pages:", err);
        return fail(
            err instanceof Error ? err.message : 'Unknown error',
            ErrorCode.EXTERNAL_API_ERROR,
            {
                userMessage: "We couldn't load your Meta pages from Meta. Check the connection permissions and try again."
            }
        );
    }

}
