"use server";

import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { storeAdAccounts } from "../../store/ad_accounts/store";
import { fetchMetaAdAccounts } from "@/lib/api/platforms/meta/ad_accounts/fetch";


/**
 * Trigger a sync for an ad account
 * @param userId - The ID of the user
 * @param adAccountId - The ID of the ad account to sync
 * @param platformIntegrationId - The ID of the platform integration
 * @returns The result of the sync action
 */
export async function syncAdAccounts(userId: string, adAccountId: string, platformIntegrationId: string) {
    const supabase = await createSupabaseClient();

    const { data: integrationData, error: integrationError } = await supabase
        .from('platform_integrations')
        .select('access_token, integration_details, platform_name')
        .eq('id', platformIntegrationId)
        .eq('user_id', userId)
        .single();

    if (integrationError || !integrationData) {
        throw new Error('Failed to fetch platform integration details');
    }

    switch (integrationData.platform_name) {
        case 'meta': {
            const accessToken = integrationData.access_token;

            console.log(`Syncing ad accounts for user ${userId} and ad account ${adAccountId}`);
            const adAccountData = await fetchMetaAdAccounts(false, accessToken, adAccountId);
            await storeAdAccounts(
                supabase,
                userId,
                platformIntegrationId,
                adAccountData,
                true,
            );
            console.log(`Stored ad accounts for user ${userId} and ad account ${adAccountId}`);
            break;
        }

    }
}