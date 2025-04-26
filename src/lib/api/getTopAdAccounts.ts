import { createSupabaseClient } from "../utils/supabase/clients/server";

export async function getTopAdAccounts(userId: string) {
    const supabase = await createSupabaseClient();

    try {
        const { data: adAccounts, error: adAccountError } = await supabase
            .from("ad_accounts")
            .select("id, name, account_status, platform_name, aggregated_metrics")
            .eq("user_id", userId)
            .order("aggregated_metrics->spend", { ascending: false })

        if (adAccountError) throw new Error(`Error fetching ad accounts: ${adAccountError.message}`);


        const { data: campaigns, error: campaignError } = await supabase
            .from("campaigns")
            .select("id, name, objective, status, ad_account_id(name), raw_data")
            .order("raw_data->spend", { ascending: false });

        if (campaignError) throw new Error(`Error fetching campaigns: ${campaignError.message}`);


        const { data: adSets, error: adSetError } = await supabase
            .from("adset_metrics")
            .select("id, name, campaign_id, raw_data")
            .order("raw_data->spend", { ascending: false });

        if (adSetError) throw new Error(`Error fetching ad sets: ${adSetError.message}`);


        const { data: ads, error: adError } = await supabase
            .from("ad_metrics")
            .select("id, name, adset_id, raw_data")
            .order("raw_data->spend", { ascending: false });

        if (adError) throw new Error(`Error fetching ads: ${adError.message}`);

        // Return structured data
        return {
            topAdAccounts: adAccounts,
            topCampaigns_metrics: campaigns,
            topAdset_metrics: adSets,
            topAd_metrics: ads,
        };

    } catch (error) {
        console.error("Error fetching ad account data:", error);
        return {
            topAdAccounts: [],
            topCampaigns_metrics: [],
            topAdset_metrics: [],
            topAd_metrics: [],
            error: "Unknown error occurred",
        };
    }
}
