import { ApiResponse, ok } from "@/lib/shared";
import { createClient } from "../supabase/browser";
import { fromSupabaseAuthError } from "@/lib/server/supabase/authError";
import toast from "react-hot-toast";

export const POST_AUTH_TOAST_KEY = 'deepvisor:post-auth-toast';

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
            const response = fromSupabaseAuthError(error);
            toast.error(response.success ? 'Failed to log out.' : response.error.userMessage);
            return response;
        }

        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(POST_AUTH_TOAST_KEY, JSON.stringify({
                type: 'success',
                message: 'Logged out successfully.',
            }));
            window.location.reload();
        }

        return ok(null);
    } catch (e: unknown) {
        const response = fromSupabaseAuthError(e);
        toast.error(response.success ? 'Failed to log out.' : response.error.userMessage);
        return response;
    }
}
