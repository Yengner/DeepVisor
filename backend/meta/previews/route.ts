import { fetchCreativePreviews } from "@/lib/actions/meta/creatives/previews";
import { NextRequest, NextResponse } from "next/server";
// import your Facebook SDK logic here

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const platformId = searchParams.get("platformId");
    const creativeId = searchParams.get("creativeId");
    const previewTypes = searchParams.get("previewTypes")?.split(",") || [];

    if (!platformId || !creativeId) {
        return NextResponse.json({ error: "Missing platformId or creativeId" }, { status: 400 });
    }

    try {

        const previews = await fetchCreativePreviews({ platformId, creativeId, previewTypes });

        return NextResponse.json({ previews });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}