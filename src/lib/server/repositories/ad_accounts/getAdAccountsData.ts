import { createSupabaseClient } from "@/lib/server/supabase/server";

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
            // .eq('id', selectedAdAccountId)
            .eq('business_id', "8f1f8a8c-13c2-42b5-99bb-3d69e7622205")
            .single();

        console.log(data)
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