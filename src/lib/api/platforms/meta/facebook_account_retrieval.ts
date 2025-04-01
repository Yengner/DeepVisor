import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export async function PageAccessToken(userId: string) { //pass in platform name
    const supabase = await createSupabaseClient();

    const { data: accessToken, error } = await supabase //Make it userId first for simplicity but once in supabase edge function have it change to platform name. 
        .from("platform_integration")
        .select("access_token")
        .eq("platform_name", "meta")
        .eq("user_id", userId)
        .single();

    if (error) {
        console.warn("Error fetching access token:", error);
    }

    const API_BASE_URL = process.env.FACEBOOK_GRAPH_API_BASE_URL

    // const batchBody = {
    //     balance: `${API_BASE_URL}/me/accounts`, // This should be enetered primarily whenever the user enters meta business login 
    //     spend: `${API_BASE_URL}/${adAccountId}/insights?fields=spend&time_range[since]=${today}&time_range[until]=${today}`,
    //     insights: `${API_BASE_URL}/${adAccountId}/insights?fields=clicks,spend,actions&date_preset=maximum`,
    //     accountDetails: `${API_BASE_URL}/${adAccountId}?fields=name,currency,spend_cap,amount_spent,account_status`,
    //     campaigns: `${API_BASE_URL}/${adAccountId}/campaigns?fields=id`,
    //   };
    
    // const response = await fetch(batchBody, {
    //     method: 'GET',
    //     headers: {
    //         Authorization: `Bearer ${accessToken}`,
    //         'Content-Type': 'application/json',
    //     },
    // });


    if (!response.ok) {
        // Attempt to parse error details
        const errorDetails = await response.json().catch(() => ({}));
        throw new Error(
            errorDetails.error?.message ||
            `Request failed with status ${response.status}`
        );
    }

}