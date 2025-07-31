import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export async function getAdSetsMetrics(campaignId: string, adset_id?: string) {
    const supabase = await createSupabaseClient();
    const query = supabase
        .from("adset_metrics")
        .select("*")
        .eq("campaign_id", campaignId);

    if (adset_id) {
        query.eq("adset_id", adset_id);
    }
    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
        id: row.adset_id,
        name: row.name,
        status: row.status,
        start_date: row.start_date,
        end_date: row.end_date,
        clicks: Number(row.clicks),
        impressions: Number(row.impressions),
        spend: Number(row.spend),
        leads: Number(row.leads),
        reach: Number(row.reach),
        link_clicks: Number(row.link_clicks),
        messages: Number(row.messages),
        cpm: Number(row.cpm),
        ctr: Number(row.ctr),
        cpc: Number(row.cpc),
        optimization_goal: row.optimization_goal,
        platform_name: row.platform_name,
        raw_data: row.raw_data,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }));
}