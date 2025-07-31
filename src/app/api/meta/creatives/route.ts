import { fetchMetaCreatives } from "@/lib/actions/meta/creatives/actions";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const platformId = searchParams.get("platformId")!;
    const adAccountId = searchParams.get("adAccountId")!;
    const after = searchParams.get("after");
    const before = searchParams.get("before");
    const limit = Number(searchParams.get("limit") || 10);
    const thumbnailWidth = searchParams.get("thumbnailWidth");
    const thumbnailHeight = searchParams.get("thumbnailHeight");

    if (!adAccountId) {
        return NextResponse.json({ error: "Missing adAccountId" }, { status: 400 });
    }

    try {
        const result = await fetchMetaCreatives({
            platformId,
            adAccountId,
            limit,
            after,
            before,
            thumbnailWidth: thumbnailWidth ? Number(thumbnailWidth) : undefined,
            thumbnailHeight: thumbnailHeight ? Number(thumbnailHeight) : undefined,
        });
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}