import { NextRequest, NextResponse } from "next/server";
import { createMetaCampaign } from "@/lib/actions/meta/campaign.actions";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { generateCampaignFlow } from "@/lib/actions/reactFlow/campaignFlow";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseClient();
    try {
        const form = await req.json();
        console.log("Received campaign POST form:", form);

        const { nodes, edges } = generateCampaignFlow(form);
        const jobId = crypto.randomUUID();
        console.log("Job ID:", jobId);

        await supabase
            .from('campaign_job_progress')
            .delete()
            .eq('job_id', jobId);

        const insertRes = await supabase
            .from("campaign_job_progress")
            .insert({ job_id: jobId, step: "started", status: "started" });
        console.log("Inserted initial progress row:", insertRes);

        createMetaCampaign(jobId, form);
        console.log("createMetaCampaign called with jobId:", jobId);

        return NextResponse.json({ success: true, jobId, nodes, edges }, { status: 200 });
    } catch (err) {
        console.error("Error in campaign POST route:", err);
        return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
    }
}

