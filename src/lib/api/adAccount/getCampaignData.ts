import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export async function getCampaignData(platform: string, adAccountId: string) {
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase
        .from('campaigns')
        .select('campaign_id, name, status, objective, raw_data, start_date, platform_name, end_date, today_metrics, yesterday_metrics, last_7d_metrics, last_30d_metrics, this_month_metrics, last_month_metrics')
        .eq('platform_name', platform)
        .eq('ad_account_id', adAccountId)

    if (error) {
        console.error('Error fetching platform data:', error);
        throw new Error(`Failed to fetch campaign data: ${error.message}`);
    }

    return {
        campaign_id: data[0].campaign_id,
        name: data[0].name,
        status: data[0].status,
        objective: data[0].objective,
        raw_data: data[0].raw_data,
        start_date: data[0].start_date,
        end_date: data[0].end_date,
        today_metrics: data[0].today_metrics,
        yesterday_metrics: data[0].yesterday_metrics,
        last_7d_metrics: data[0].last_7d_metrics,
        last_30d_metrics: data[0].last_30d_metrics,
        this_month_metrics: data[0].this_month_metrics,
        last_month_metrics: data[0].last_month_metrics,
    }
}