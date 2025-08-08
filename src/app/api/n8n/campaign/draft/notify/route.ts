import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { draftId, userId, payload } = await req.json();
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase
            .from("campaign_drafts")
            .insert({
                id: draftId,
                user_id: userId,
                ad_account_id: payload?.campaign?.adAccountId ?? null,
                creative_id: payload?.ads?.[0]?.creative?.creative_id ?? null,
                payload_json: payload,
                status: "pending",
                idempotency_key: draftId
            })
            .select()
            .single();

        if (error) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
                status: 400, headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ ok: true, draft: data }), {
            status: 200, headers: { "Content-Type": "application/json" }
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: e?.message || "bad_request" }), {
            status: 400, headers: { "Content-Type": "application/json" }
        });
    }
}