import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

/**
 * Fetches ad account data for a specific platform
 * @param selectedAdAccountId - The ID of the ad account to fetch data for
 * @param selectedPlatformId - The ID of the platform to fetch data for
 * @param userId - The ID of the user to fetch data for
 * @returns An object containing the ad account data
 */
export async function getAdAccountData(selectedAdAccountId: string, selectedPlatformId: string, userId: string) {
    const supabase = await createSupabaseClient();

    try {
        const { data, error } = await supabase
            .from('ad_accounts')
            .select('*')
            .eq('id', selectedAdAccountId)
            .eq('platform_integration_id', selectedPlatformId)
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching ad account data:', error.message);
            throw new Error('Failed to fetch ad account data');
        }

        if (!data) {
            throw new Error('No ad account data found');
        }

        return data;
    } catch (error) {
        console.error('Error in getAdAccountData Function:', error);
        throw error;
    }
}