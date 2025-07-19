import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export async function getCampaignsWithAdSetsAndAds(adAccountId: string) {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
        .from('campaigns_metrics')
        .select(`
                id,
                name,
                adset_metrics (
                            id,
                            name,
                            ads_metrics (
                                    id,
                                    name
                                    )
                            )
            `)
        .eq('ad_account_id', adAccountId);

    if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
    }

    return data;
}
