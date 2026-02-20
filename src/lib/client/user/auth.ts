import { ApiResponse, ok } from "@/lib/shared";
import { createClient } from "../supabase/browser";
import { fromSupabaseAuthError } from "@/lib/server/supabase/authError";

/**
 * Handles user sign out
 * @return Success status and error message if any
*/
export async function clientHandleSignOut(): Promise<ApiResponse<null>> {
    try {
        const supabase = createClient();
        const { error } = await supabase.auth.signOut();

        // Clear platform and ad account cookies
        // DEPRECATED - we should be handling this on the client side instead of server side since these cookies are only used on the client and not needed for auth - will remove this later

        // const cookieStore = cookies();
        // (await cookieStore).set('platform_integration_id', '', { path: '/', maxAge: 0 });
        // (await cookieStore).set('ad_account_id', '', { path: '/', maxAge: 0 });

        if (error) {
            return fromSupabaseAuthError(error);
        }

        return ok(null);
    } catch (e: unknown) {
        return fromSupabaseAuthError(e);
    }
}
