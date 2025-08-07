import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export const runtime = "nodejs"; // crypto/node APIs OK

/**
 * GET /api/campaign/draft/:id
 * Returns a single draft row for server-page SSR and the client editor.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase
        .from("campaign_drafts")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !data) {
        return new Response(JSON.stringify({ error: error?.message ?? "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ draft: data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * PATCH /api/campaign/draft/:id
 * Body: { payload: any, version: number }
 * Updates payload_json with optimistic concurrency (version must match).
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { payload, version } = await req.json();
    const supabase = await createSupabaseClient();

    if (typeof version !== "number") {
        return new Response(JSON.stringify({ error: "Missing or invalid version" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Check current version
    const { data: current, error: readErr } = await supabase
        .from("campaign_drafts")
        .select("version")
        .eq("id", id)
        .single();

    if (readErr || !current) {
        return new Response(JSON.stringify({ error: readErr?.message ?? "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (current.version !== version) {
        return new Response(JSON.stringify({ error: "Version conflict" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Update payload_json and bump version
    const { data, error } = await supabase
        .from("campaign_drafts")
        .update({ payload_json: payload, version: version + 1 })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, draft: data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}