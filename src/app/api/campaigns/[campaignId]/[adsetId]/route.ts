import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { NextResponse } from "next/server";

export const dynamic = 'force-static';
export const revalidate = 60;

export async function GET(
  request: Request,
  { params }: { params: { campaignId: string } }
) {
  const { campaignId } = await params;
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from('adset_metrics')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}