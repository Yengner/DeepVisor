import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export type CampaignReviewSummary = {
    ad_account_uuid: string;
    campaign_external_id: string;
    campaign_name: string | null;
    needs_review: boolean;
    total_actions: number;
    actions_requiring_human: number;
    pause_actions: number;
    budget_increase_actions: number;
    budget_decrease_actions: number;
    last_decision_created_at: string | null;
    last_decision_id: string | null;
    last_decision_status: string | null;
};

export async function getCampaignReviewSummary(adAccountUuid: string) {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
        .from("v_campaign_review_status")
        .select("*")
        .eq("ad_account_uuid", adAccountUuid);

    if (error) throw new Error(error.message);

    const rows = (data || []) as CampaignReviewSummary[];
    // return both list and a quick map for joins
    const byId = Object.fromEntries(
        rows.map(r => [r.campaign_external_id, r])
    );

    return { list: rows, byId };
}
