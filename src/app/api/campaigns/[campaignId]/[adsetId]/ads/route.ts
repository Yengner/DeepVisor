import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export async function GET(
    request: Request,
    { params }: { params: { adsetId: string } }
) {
    const { adsetId } = await params;
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase
        .from('ads_metrics')
        .select('*')
        .eq('adset_id', adsetId);

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
}