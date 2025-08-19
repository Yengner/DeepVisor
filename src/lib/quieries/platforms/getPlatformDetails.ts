import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { PlatformDetails } from "../types";

/**
 * Fetches platform details by ID
 * @param selectedPlatformId - The ID of the platform to fetch details for
 * @return An object containing the platform details or an error response
 */
export async function getPlatformDetails(selectedPlatformId: string, userId: string): Promise<PlatformDetails> {

    const supabase = await createSupabaseClient();

    const { data, error: platformError } = await supabase
        .from("platform_integrations")
        .select("*")
        .eq("id", selectedPlatformId)
        .eq("user_id", userId)
        .single();

    if (platformError) {
        console.error("Error fetching platform details:", platformError);

    }

    const platformDetails: PlatformDetails = {
        id: data.id,
        vendor: data.platform_name as "meta" | "google" | "tiktok",
        is_integrated: data.is_integrated,
        access_token: data.access_token,
        updated_at: data.updated_at,
    }
    return platformDetails
}