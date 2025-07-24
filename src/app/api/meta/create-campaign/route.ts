import { NextRequest, NextResponse } from "next/server";
import { createMetaCampaign } from "@/lib/actions/meta/campaign.actions";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { logProgress } from "@/lib/actions/utils";

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

import { Node, Edge } from "@xyflow/react";

export function generateCampaignFlow(
    form: any
): { nodes: Node[]; edges: Edge[] } {


    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodes.push({
        id: "campaign",
        type: "customNode",
        position: { x: 250, y: 0 },
        width: 200,
        initialHeight: 100,
        data: { type: "input", label: "Campaign", step: "campaign" },
    });

    // For each ad set
    form.adSets.forEach((adSet: any, i: any) => {
        const adSetId = `adset-${i}`;
        nodes.push({
            id: adSetId,
            type: "customNode",
            position: { x: 100, y: (i + 1) * 150 },
            width: 200,
            initialHeight: 100,
            data: { type: "default", label: `Ad Set ${i + 1}: ${adSet.adSetName || "Untitled"}`, step: adSetId },
        });
        edges.push({
            id: `e-campaign-${adSetId}`,
            source: "campaign",
            target: adSetId,
            animated: true,
            type: "smoothstep",
        });

        // For each creative in ad set
        adSet.creatives.forEach((creative: any, j: any) => {
            const creativeId = `creative-${i}-${j}`;
            nodes.push({
                id: creativeId,
                type: "customNode",
                position: { x: 400, y: (i + 1) * 150 + j * 80 },
                width: 160,
                initialHeight: 100,

                data: { type: "default", label: `Creative ${j + 1}`, step: creativeId },
            });
            edges.push({
                id: `e-${adSetId}-${creativeId}`,
                source: adSetId,
                target: creativeId,
                animated: true,
                type: "smoothstep",
            });

            // Ad node
            const adId = `ad-${i}-${j}`;
            nodes.push({
                id: adId,
                type: "customNode",
                position: { x: 650, y: (i + 1) * 150 + j * 80 },
                width: 120,
                initialHeight: 100,

                data: { type: "output", label: `Ad ${j + 1}`, step: adId },
            });
            edges.push({
                id: `e-${creativeId}-${adId}`,
                source: creativeId,
                target: adId,
                animated: true,
                type: "smoothstep",
            });
        });
    });

    return { nodes, edges };
}
