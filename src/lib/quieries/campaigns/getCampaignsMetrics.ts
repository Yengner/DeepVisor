import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export async function getCampaignLifetimeIncludingZeros(
    adAccountUuid: string,
    campaignExternalId?: string,
    vendor: "meta" | "google" | "tiktok" = "meta"
) {
    const supabase = await createSupabaseClient();

    let q = supabase
        .from("v_campaigns_lifetime_full")
        .select("*")
        .eq("vendor", vendor)
        .eq("ad_account_id", adAccountUuid);

    if (campaignExternalId) {
        q = q.eq("campaign_external_id", campaignExternalId);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // shape it like your old function’s return
    return (data || []).map((row: any) => ({
        id: row.campaign_external_id,
        name: row.campaign_name,
        status: row.campaign_current_status,
        objective: row.campaign_objective,
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        spend: Number(row.spend || 0).toFixed(2),
        leads: Number(row.leads || 0),
        reach: Number(row.reach || 0),
        link_clicks: Number(row.inline_link_clicks || 0),
        cpm: row.cpm != null ? Number(row.cpm).toFixed(2) : null,
        ctr: row.ctr != null ? Number(row.ctr).toFixed(4) : null,
        cpc: row.cpc != null ? Number(row.cpc).toFixed(2) : null,
        cpl: row.cpl != null ? Number(row.cpl).toFixed(2) : null,
        frequency: row.frequency != null ? Number(row.frequency).toFixed(2) : null,
        start_date: formatDate(row.first_day),
        end_date: formatDate(row.last_day),
        platform_name: vendor, // optional for display
    }));
}
