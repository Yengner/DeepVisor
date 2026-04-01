import { createServerClient as createSupabaseClient } from '../../supabase/server'
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
    getBusinessIntegrationById,
    resolveIntegrationAccessToken,
} from '@/lib/server/integrations/service';


export async function getAccessToken(platformId: string): Promise<string> {
    try {
        const supabase = await createSupabaseClient();
        const { businessId } = await getRequiredAppContext();
        const integration = await getBusinessIntegrationById(supabase, {
            businessId,
            integrationId: platformId,
        });

        if (!integration || integration.platformKey !== 'meta' || !integration.isIntegrated) {
            throw new Error(
                "We couldn't access your Meta account. Please reconnect your account."
            );
        }

        const accessToken = await resolveIntegrationAccessToken(supabase, integration);
        if (!accessToken) {
            throw new Error(
                "We couldn't access your Meta account. Please reconnect your account."
            );
        }

        return accessToken;
    } catch (err) {
        console.error("Error getting Meta access token:", err);
        throw new Error(
            "An unexpected error occurred while retrieving your Meta access token."
        );
    }
}
