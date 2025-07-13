/**
 * Store a single Meta ad account and its metrics in the database
 */

import { AdAccountWithMetrics } from "./types";

export async function storeAdAccount(
    supabase: any,
    userId: string,
    adAccountId: string,
    adAccountData: AdAccountWithMetrics,
    platformIntegrationId: string
) {
    const date = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

    // Format the ad account for database
    const adAccountForDb = {
        name: adAccountData.name,
        account_status: adAccountData.account_status,
        aggregated_metrics: adAccountData.maximumMetrics,
        time_increment_metrics: adAccountData.incrementMetrics,
        last_synced: date,

    };

    // Save the ad account to the database
    const { error: adAccountError } = await supabase
        .from('ad_accounts')
        .update(adAccountForDb)
        .eq('user_id', userId)
        .eq('ad_account_id', adAccountId)
        .eq('platform_integration_id', platformIntegrationId);


    if (adAccountError) {
        console.error('Supabase ad account update error:', adAccountError);
        throw new Error('Failed to save ad account to Supabase');
    };
    console.log(`Ad account ${adAccountId} updated successfully.`);

};