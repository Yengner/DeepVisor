import { NextRequest, NextResponse } from "next/server";
import { createCampaign } from "@/lib/actions/meta/campaigns/create";
import { createMetaCampaign } from "@/lib/actions/meta/campaign.actions";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const campaign = await createMetaCampaign(body);
        return NextResponse.json({ success: true, campaign });
    } catch (err) {
        return NextResponse.json(
            { success: false, error: (err as Error).message },
            { status: 500 }
        );
    }
}