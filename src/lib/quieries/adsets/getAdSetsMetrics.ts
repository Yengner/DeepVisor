// lib/quieries/adsets/getAdSetsLifetimeIncludingZeros.ts
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export async function getAdSetsLifetimeIncludingZeros(
    adAccountUuid: string,
    opts?: { campaignExternalId?: string; adsetExternalId?: string; vendor?: "meta" | "google" | "tiktok" }
) {
    const supabase = await createSupabaseClient();
    const vendor = opts?.vendor ?? "meta";

    let q = supabase
        .from("v_adsets_lifetime_full")
        .select("*")
        .eq("vendor", vendor)
        .eq("ad_account_id", adAccountUuid);

    if (opts?.campaignExternalId) q = q.eq("campaign_external_id", opts.campaignExternalId);
    if (opts?.adsetExternalId) q = q.eq("adset_external_id", opts.adsetExternalId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // Match the shape/pattern you used for campaigns
    return (data || []).map((row: any) => ({
        id: row.adset_external_id,
        name: row.adset_name,
        status: row.adset_current_status,
        objective: row.optimization_goal,              // (ad set "objective" ≈ optimization_goal)
        campaign_id: row.campaign_external_id,
        campaign_name: row.campaign_name,

        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        spend: row.spend != null ? Number(row.spend).toFixed(2) : "0.00",
        leads: Number(row.leads || 0),
        reach: Number(row.reach || 0),
        link_clicks: Number(row.inline_link_clicks || 0),
        messages: Number(row.messages || 0),

        cpm: row.cpm != null ? Number(row.cpm).toFixed(2) : null,
        ctr: row.ctr != null ? Number(row.ctr).toFixed(4) : null,
        cpc: row.cpc != null ? Number(row.cpc).toFixed(2) : null,
        cpl: row.cpl != null ? Number(row.cpl).toFixed(2) : null,
        frequency: row.frequency != null ? Number(row.frequency).toFixed(2) : null,

        start_date: formatDate(row.first_day),
        end_date: formatDate(row.last_day),

        platform_name: vendor,
    }));
}
