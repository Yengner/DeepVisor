// import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

// export async function GET(
//     request: Request,
//     { params }: { params: { adsetId: string } }
// ) {
//     const supabase = await createSupabaseClient();

//     const data = getAllCampaigns('meta', adsetId);
//     if (error) {
//         return Response.json({ error: error.message }, { status: 500 });
//     }

//     return Response.json(data);
// }