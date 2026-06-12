"use server";

import { ApiResponse, ErrorCode } from "@/lib/shared/types/api";
import { fail, ok } from "@/lib/shared/utils/responses";
import { getRequiredAppContext } from "@/lib/server/actions/app/context";
import {
    getBusinessIntegrationById,
    resolveIntegrationAccessToken,
} from "@/lib/server/integrations/service";
import { fetchMetaCollection, fetchMetaObject } from "@/lib/server/sync/meta/client";
import { createSupabaseClient } from "@/lib/server/supabase/server";

export interface MetaPage {
    id: string;
    page_id: string;
    name: string;
    phone: string | null;
    instagram_account_id?: string;
    instagram_account_name?: string | null;
    instagram_account_username?: string | null;
    instagram_account_picture_url?: string | null;
    picture_url?: string;
}

interface GetMetaPagesParams {
    platformId: string;
    adAccountId?: string | null;
}

type MetaGraphPage = {
    id?: string;
    name?: string;
    phone?: string | null;
    instagram_business_account?: {
        id?: string;
        name?: string | null;
        username?: string | null;
        profile_picture_url?: string | null;
    };
    picture?: {
        data?: {
            url?: string;
        };
    };
};

type MetaBusiness = {
    id?: string;
    name?: string;
};

type MetaAdAccountBusinessResponse = {
    business?: MetaBusiness | null;
};

type MetaBusinessCandidateResult = {
    businesses: MetaBusiness[];
    errors: string[];
};

type MetaPagesFetchResult = {
    pages: MetaPage[];
    errors: string[];
};

const META_PAGE_FIELDS = 'id,name,phone,instagram_business_account{id,name,username,profile_picture_url},picture{url}';
const META_PAGE_MINIMAL_FIELDS = 'id,name,phone,picture{url}';

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

    return (data ?? []).map(page => {
      const pageRecord = page as Record<string, unknown>;

      return {
        id: page.id,
        page_id: page.page_id,
        name: page.name,
        phone: null,
        instagram_account_id: page.instagram_account_id,
        instagram_account_name:
          typeof pageRecord.instagram_account_name === 'string' ? pageRecord.instagram_account_name : null,
        instagram_account_username:
          typeof pageRecord.instagram_account_username === 'string' ? pageRecord.instagram_account_username : null,
        instagram_account_picture_url:
          typeof pageRecord.instagram_account_picture_url === 'string' ? pageRecord.instagram_account_picture_url : null,
      };
    });
}

function normalizeGraphPage(page: MetaGraphPage): MetaPage | null {
    if (!page.id || !page.name) {
        return null;
    }

    return {
        id: page.id,
        page_id: page.id,
        name: page.name,
        phone: typeof page.phone === 'string' && page.phone.trim() ? page.phone.trim() : null,
        instagram_account_id: page.instagram_business_account?.id,
        instagram_account_name: page.instagram_business_account?.name ?? null,
        instagram_account_username: page.instagram_business_account?.username ?? null,
        instagram_account_picture_url: page.instagram_business_account?.profile_picture_url ?? null,
        picture_url: page.picture?.data?.url,
    };
}

function normalizeAdAccountObjectId(adAccountId: string | null | undefined): string | null {
    const trimmed = adAccountId?.trim();
    if (!trimmed) {
        return null;
    }

    return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

function addBusinessCandidate(
    candidates: Map<string, MetaBusiness>,
    business: MetaBusiness | null | undefined
): void {
    if (!business?.id) {
        return;
    }

    candidates.set(business.id, {
        id: business.id,
        name: business.name,
    });
}

function mergePages(pages: MetaPage[]): MetaPage[] {
    const pagesById = new Map<string, MetaPage>();

    pages.forEach((page) => {
        pagesById.set(page.page_id, page);
    });

    return Array.from(pagesById.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchMetaBusinessCandidates(input: {
    accessToken: string;
    adAccountId?: string | null;
}): Promise<MetaBusinessCandidateResult> {
    const candidates = new Map<string, MetaBusiness>();
    const errors: string[] = [];
    const adAccountObjectId = normalizeAdAccountObjectId(input.adAccountId);

    if (adAccountObjectId) {
        try {
            const adAccount = await fetchMetaObject<MetaAdAccountBusinessResponse>({
                path: adAccountObjectId,
                accessToken: input.accessToken,
                params: {
                    fields: 'business{id,name}',
                },
            });
            addBusinessCandidate(candidates, adAccount.business);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
            console.warn('Failed to fetch Meta ad account business for Pages', {
                adAccountId: input.adAccountId,
                error: message,
            });
        }
    }

    try {
        const businesses = await fetchMetaCollection<MetaBusiness>({
            path: 'me/businesses',
            accessToken: input.accessToken,
            params: {
                fields: 'id,name',
                limit: 100,
            },
        });

        businesses.forEach((business) => addBusinessCandidate(candidates, business));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        console.warn('Failed to fetch Meta businesses for Pages', {
            error: message,
        });
    }

    return {
        businesses: Array.from(candidates.values()),
        errors,
    };
}

async function fetchUserPages(accessToken: string): Promise<MetaPage[]> {
    return fetchPagesFromPath({
        accessToken,
        path: 'me/accounts',
    });
}

async function fetchPagesFromPath(input: {
    accessToken: string;
    path: string;
}): Promise<MetaPage[]> {
    const fetchPages = async (fields: string) => {
        const pages = await fetchMetaCollection<MetaGraphPage>({
            path: input.path,
            accessToken: input.accessToken,
            params: {
                fields,
                limit: 100,
            },
        });

        return pages
            .map(normalizeGraphPage)
            .filter((page): page is MetaPage => Boolean(page));
    };

    try {
        return await fetchPages(META_PAGE_FIELDS);
    } catch (error) {
        console.warn('Retrying Meta Pages fetch without Instagram fields', {
            path: input.path,
            error: error instanceof Error ? error.message : String(error),
        });
        return fetchPages(META_PAGE_MINIMAL_FIELDS);
    }
}

async function fetchBusinessPages(input: {
    accessToken: string;
    business: MetaBusiness;
}): Promise<MetaPagesFetchResult> {
    if (!input.business.id) {
        return { pages: [], errors: [] };
    }

    const pageRequests = [
        `${input.business.id}/owned_pages`,
        `${input.business.id}/client_pages`,
    ].map(async (path) => {
        try {
            return await fetchPagesFromPath({
                path,
                accessToken: input.accessToken,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn('Failed to fetch Meta Pages from business edge', {
                businessId: input.business.id,
                path,
                error: message,
            });
            return { pages: [], errors: [message] };
        }
    });

    const pageResults = await Promise.all(pageRequests);

    return {
        pages: pageResults.flatMap((result) => Array.isArray(result) ? result : result.pages),
        errors: pageResults.flatMap((result) => Array.isArray(result) ? [] : result.errors),
    };
}

/**
 * Fetches live Meta Pages available to the connected integration.
 */
export async function getMetaPages({
    platformId,
    adAccountId,
}: GetMetaPagesParams): Promise<ApiResponse<MetaPage[]>> {
    try {
        const { businessId } = await getRequiredAppContext();
        const supabase = await createSupabaseClient();
        const integration = await getBusinessIntegrationById(supabase, {
            businessId,
            integrationId: platformId,
        });
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
            const pages: MetaPage[] = [];
            const liveFetchErrors: string[] = [];

            try {
                const userPages = await fetchUserPages(accessToken);
                pages.push(...userPages);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                liveFetchErrors.push(message);
                console.warn('Failed to fetch Meta Pages from user accounts edge', {
                    platformId,
                    error: message,
                });
            }

            const businessCandidates = await fetchMetaBusinessCandidates({
                accessToken,
                adAccountId,
            });
            liveFetchErrors.push(...businessCandidates.errors);

            if (businessCandidates.businesses.length > 0) {
                const businessPageGroups = await Promise.all(
                    businessCandidates.businesses.map((business) =>
                        fetchBusinessPages({
                            accessToken,
                            business,
                        })
                    )
                );
                pages.push(...businessPageGroups.flatMap((result) => result.pages));
                liveFetchErrors.push(...businessPageGroups.flatMap((result) => result.errors));
            }

            const normalizedPages = mergePages(pages);
            if (normalizedPages.length > 0) {
                return ok(normalizedPages);
            }

            const storedPages = await getStoredMetaPages(platformId).catch(() => []);
            if (storedPages.length > 0) {
                return ok(storedPages);
            }

            if (liveFetchErrors.length > 0) {
                throw new Error(`Meta Page lookup failed: ${liveFetchErrors[0]}`);
            }

            return ok(storedPages);
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
