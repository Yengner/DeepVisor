import { createSupabaseClient } from "../../utils/supabase/clients/server";
import { getLoggedInUser } from "../user";


export async function getAccessToken(platformId: string): Promise<string> {
    try {
        const supabase = await createSupabaseClient();
        const userId = await getLoggedInUser().then((user: { id: string }) => user?.id);

        const { data: integration, error: integrationError } = await supabase
            .from("platform_integrations")
            .select("access_token")
            .eq("id", platformId)
            .eq("user_id", userId)
            .eq("platform_name", "meta")
            .single();

        if (integrationError || !integration?.access_token) {
            throw new Error(
                "We couldn't access your Meta account. Please reconnect your account."
            );
        }

        return integration.access_token;
    } catch (err) {
        console.error("Error getting Meta access token:", err);
        throw new Error(
            "An unexpected error occurred while retrieving your Meta access token."
        );
    }
}
