import { getLoggedInUser } from "@/lib/actions/user.actions";
import { createSupabaseClient } from "../../utils/supabase/clients/server";
import { createErrorResponse, createSuccessResponse } from "../../utils/error-handling";
import { ApiResponse, ErrorCode } from "@/lib/types/api";

export async function getAccessToken(platformId: string): Promise< string | ApiResponse<string>> {
    try {
        const supabase = await createSupabaseClient();

        const loggedInUser = await getLoggedInUser();
        const userId = loggedInUser?.id;

        // Get access token
        const { data: integration, error: integrationError } = await supabase
            .from("platform_integrations")
            .select("access_token")
            .eq("id", platformId)
            .eq("user_id", userId)
            .eq("platform_name", "meta")
            .single();

        if (integrationError || !integration?.access_token) {
            return createErrorResponse(
                ErrorCode.DATABASE_ERROR,
                "Failed to get Meta Access Token",
                "We couldn't access your Meta account. Please reconnect your account."
            )
        }
        
        const accessToken = integration.access_token;

        return accessToken;


    } catch (err) {
        console.error("Error getting Meta access token:", err);
        return createErrorResponse(
            ErrorCode.UNKNOWN_ERROR,
            "Failed to get Meta Access Token",
            "An unexpected error occurred while retrieving your Meta access token."
        );
    }

}
