import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

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
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}