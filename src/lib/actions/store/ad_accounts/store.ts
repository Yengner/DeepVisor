import { getTierLimits } from "../../user";
import { date } from "../../utils";

/**
 * Store ad accounts with tier-based limits
 * @param supabase - Supabase client instance
 * @param userId - The ID of the user
 * @param platformIntegrationId - The ID of the platform integration
 * @param adAccountsData - The ad accounts data to store
 * @param sync - Whether to sync the ad accounts or not
 * @param userTier - The tier of the user for limit checks
 * @returns An object containing the stored ad accounts and a mapping of ad account IDs to Sup
 */
export async function storeAdAccounts(
    supabase: any,
    userId: string,
    platformIntegrationId: string,
    adAccountsData: any,
    sync?: boolean,
    userTier?: string
): Promise<{ accounts: any, accountIdMap: { [adAccountId: string]: string } } | void> {

    if (sync) {
        const updateAdAccountForDb = {
            name: adAccountsData.details.name,
            account_status: adAccountsData.details.account_status,
            aggregated_metrics: adAccountsData.maximumMetrics,
            time_increment_metrics: adAccountsData.incrementMetrics,
            last_synced: date,
        }

        const { error: updateError } = await supabase
            .from('ad_accounts')
            .update(updateAdAccountForDb)
            .eq('user_id', userId)
            .eq('platform_integration_id', platformIntegrationId)
            .eq('ad_account_id', adAccountsData.details.id);


        if (updateError) {
            console.error('Supabase ad account update error:', updateError);
            throw new Error('Failed to update ad account in Supabase');
        }

        return;
    }

    const { maxAdAccounts } = getTierLimits(userTier as any);

    let accountsToSave = Array.isArray(adAccountsData) ? [...adAccountsData] : [adAccountsData];

    if (accountsToSave.length > maxAdAccounts) {
        accountsToSave = accountsToSave.slice(0, maxAdAccounts);
    }

    const adAccountsForDb = accountsToSave.map((account) => ({
        user_id: userId,
        platform_integration_id: platformIntegrationId,
        ad_account_id: account.details.id,
        platform_name: 'meta',
        name: account.details.name,
        account_status: account.details.account_status,
        aggregated_metrics: account.maximumMetrics,
        time_increment_metrics: account.incrementMetrics,
        last_synced: date,
        updated_at: date,
        created_at: date,
    }));

    if (adAccountsForDb.length === 0) {
        return { accounts: [], accountIdMap: {} };
    }

    const { data: savedAccounts, error: adAccountsError } = await supabase
        .from('ad_accounts')
        .upsert(adAccountsForDb)
        .select('id, ad_account_id');

    if (adAccountsError) {
        console.error('Supabase ad account upsert error:', adAccountsError);
        throw new Error('Failed to save ad accounts to Supabase');
    }

    const accountIdMap: { [adAccountId: string]: string } = {};
    if (savedAccounts) {
        for (const account of savedAccounts) {
            accountIdMap[account.ad_account_id] = account.id;
        }
    }

    return { accounts: accountsToSave, accountIdMap };
}
