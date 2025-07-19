import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { NextResponse } from "next/server";

export const dynamic = 'force-static';
export const revalidate = 60;

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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}