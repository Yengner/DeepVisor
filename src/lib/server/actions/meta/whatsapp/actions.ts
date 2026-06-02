"use server";

import { getRequiredAppContext } from "@/lib/server/actions/app/context";
import {
    getBusinessIntegrationById,
    resolveIntegrationAccessToken,
} from "@/lib/server/integrations/service";
import { createSupabaseClient } from "@/lib/server/supabase/server";
import { fetchMetaCollection, fetchMetaObject } from "@/lib/server/sync/meta/client";
import { ApiResponse, ErrorCode } from "@/lib/shared/types/api";
import { fail, ok } from "@/lib/shared/utils/responses";

export interface MetaWhatsAppPhoneNumber {
    id: string;
    display_phone_number: string;
    verified_name?: string;
    quality_rating?: string;
    code_verification_status?: string;
    whatsapp_business_account_id: string;
    whatsapp_business_account_name?: string;
}

interface GetMetaWhatsAppPhoneNumbersParams {
    platformId: string;
    adAccountId?: string | null;
}

type MetaBusiness = {
    id?: string;
    name?: string;
};

type MetaAdAccountBusinessResponse = {
    business?: MetaBusiness | null;
};

type MetaWhatsAppBusinessAccount = {
    id?: string;
    name?: string;
};

type MetaGraphWhatsAppPhoneNumber = {
    id?: string;
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    code_verification_status?: string;
};

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

async function fetchMetaBusinessCandidates(input: {
    accessToken: string;
    adAccountId?: string | null;
}): Promise<MetaBusiness[]> {
    const candidates = new Map<string, MetaBusiness>();
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
            console.warn('Failed to fetch Meta ad account business for WhatsApp numbers', {
                adAccountId: input.adAccountId,
                error: error instanceof Error ? error.message : String(error),
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
        console.warn('Failed to fetch Meta businesses for WhatsApp numbers', {
            error: error instanceof Error ? error.message : String(error),
        });
    }

    return Array.from(candidates.values());
}

async function fetchWhatsAppBusinessAccounts(input: {
    accessToken: string;
    business: MetaBusiness;
}): Promise<MetaWhatsAppBusinessAccount[]> {
    if (!input.business.id) {
        return [];
    }

    const accountRequests = [
        `${input.business.id}/owned_whatsapp_business_accounts`,
        `${input.business.id}/client_whatsapp_business_accounts`,
    ].map(async (path) => {
        try {
            return await fetchMetaCollection<MetaWhatsAppBusinessAccount>({
                path,
                accessToken: input.accessToken,
                params: {
                    fields: 'id,name',
                    limit: 100,
                },
            });
        } catch (error) {
            console.warn('Failed to fetch WhatsApp Business Accounts from Meta', {
                businessId: input.business.id,
                path,
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    });

    const accountGroups = await Promise.all(accountRequests);
    const accountsById = new Map<string, MetaWhatsAppBusinessAccount>();

    accountGroups.flat().forEach((account) => {
        if (account.id) {
            accountsById.set(account.id, account);
        }
    });

    return Array.from(accountsById.values());
}

async function fetchPhoneNumbersForWhatsAppAccount(input: {
    accessToken: string;
    account: MetaWhatsAppBusinessAccount;
}): Promise<MetaWhatsAppPhoneNumber[]> {
    if (!input.account.id) {
        return [];
    }

    try {
        const phoneNumbers = await fetchMetaCollection<MetaGraphWhatsAppPhoneNumber>({
            path: `${input.account.id}/phone_numbers`,
            accessToken: input.accessToken,
            params: {
                fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status',
                limit: 100,
            },
        });

        return phoneNumbers
            .filter((phoneNumber) => Boolean(phoneNumber.id && phoneNumber.display_phone_number))
            .map((phoneNumber) => ({
                id: phoneNumber.id as string,
                display_phone_number: phoneNumber.display_phone_number as string,
                verified_name: phoneNumber.verified_name,
                quality_rating: phoneNumber.quality_rating,
                code_verification_status: phoneNumber.code_verification_status,
                whatsapp_business_account_id: input.account.id as string,
                whatsapp_business_account_name: input.account.name,
            }));
    } catch (error) {
        console.warn('Failed to fetch WhatsApp phone numbers from Meta', {
            whatsappBusinessAccountId: input.account.id,
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}

export async function getMetaWhatsAppPhoneNumbers({
    platformId,
    adAccountId,
}: GetMetaWhatsAppPhoneNumbersParams): Promise<ApiResponse<MetaWhatsAppPhoneNumber[]>> {
    try {
        const { businessId } = await getRequiredAppContext();
        const supabase = await createSupabaseClient();
        const integration = await getBusinessIntegrationById(supabase, {
            businessId,
            integrationId: platformId,
        });

        if (!integration || integration.platformKey !== 'meta' || !integration.isIntegrated) {
            return fail('Meta integration is not connected.', ErrorCode.INTEGRATION_ERROR, {
                userMessage: 'Connect Meta before choosing a WhatsApp Business number.',
                details: { platformId },
            });
        }

        const accessToken = await resolveIntegrationAccessToken(supabase, integration);
        if (!accessToken) {
            return fail('Missing Meta access token.', ErrorCode.INTEGRATION_ERROR, {
                userMessage: 'Reconnect Meta before choosing a WhatsApp Business number.',
                details: { platformId },
            });
        }

        const businesses = await fetchMetaBusinessCandidates({
            accessToken,
            adAccountId,
        });

        if (businesses.length === 0) {
            return ok([]);
        }

        const whatsappAccounts = (
            await Promise.all(
                businesses.map((business) =>
                    fetchWhatsAppBusinessAccounts({
                        accessToken,
                        business,
                    })
                )
            )
        ).flat();

        if (whatsappAccounts.length === 0) {
            return ok([]);
        }

        const phoneNumbers = (
            await Promise.all(
                whatsappAccounts.map((account) =>
                    fetchPhoneNumbersForWhatsAppAccount({
                        accessToken,
                        account,
                    })
                )
            )
        ).flat();
        const phoneNumbersById = new Map<string, MetaWhatsAppPhoneNumber>();

        phoneNumbers.forEach((phoneNumber) => {
            phoneNumbersById.set(phoneNumber.id, phoneNumber);
        });

        return ok(Array.from(phoneNumbersById.values()));
    } catch (error) {
        console.error('Unexpected error fetching Meta WhatsApp phone numbers:', error);
        return fail(
            error instanceof Error ? error.message : 'Unknown error',
            ErrorCode.EXTERNAL_API_ERROR,
            {
                userMessage: "We couldn't load WhatsApp Business numbers from Meta. Check the connection permissions and try again.",
                details: { platformId, adAccountId: adAccountId ?? null },
            }
        );
    }
}
