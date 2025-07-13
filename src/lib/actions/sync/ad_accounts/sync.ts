"use server";

import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { fetchMetaAdAccountWithMetrics } from "./fetch";
import { storeAdAccount } from "./store";


/**
 * Trigger a sync for an ad account
 * @param userId - The ID of the user
 * @param adAccountId - The ID of the ad account to sync
 * @param platformIntegrationId - The ID of the platform integration
 * @returns The result of the sync action
 */
export async function syncAdAccounts(userId: string, adAccountId: string, platformIntegrationId: string) {
    const supabase = await createSupabaseClient();

    // Fetch Platform Integration details
    const { data: integrationData, error: integrationError } = await supabase
        .from('platform_integrations')
        .select('access_token, integration_details, platform_name')
        .eq('id', platformIntegrationId)
        .eq('user_id', userId)
        .single();

    if (integrationError || !integrationData) {
        throw new Error('Failed to fetch platform integration details');
    }

    // Switch based on platform name
    switch (integrationData.platform_name) {
        case 'meta': {
            const accessToken = integrationData.access_token;

            // Fetch ad accounts using the access token
            const adAccountData = await fetchMetaAdAccountWithMetrics(accessToken, adAccountId);
            // Store the ad accounts in the database
            await storeAdAccount(
                supabase,
                userId,
                adAccountId,
                adAccountData,
                platformIntegrationId,
            );
            console.log(`Stored ad accounts for user ${userId} and ad account ${adAccountId}`);
            break;
        }

    }
}