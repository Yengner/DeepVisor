import 'server-only';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createServerClient } from '@/lib/server/supabase/server';
import { createAdminClient } from '@/lib/server/supabase/admin';
export class AssistantError extends Error {
    constructor(message: string, readonly status = 400) { super(message); }
}
export async function authorizeAssistant(expectedAccount?: string) {
    const session = await createServerClient();
    const { data, error } = await session.auth.getUser();
    if (error || !data.user)
        throw new AssistantError('Sign in to use the assistant.', 401);
    const context = await getRequiredAppContext();
    const selection = await resolveCurrentSelection(context.businessId);
    if (!selection.selectedAdAccountId || !selection.selectedPlatformId || (expectedAccount && expectedAccount !== selection.selectedAdAccountId)) {
        throw new AssistantError('The selected account changed. Reload this conversation.', 409);
    }
    const db = createAdminClient();
    const [{ data: account, error: accountError }, { data: integration, error: integrationError }] = await Promise.all([
        db.from('ad_accounts').select('id, platform_id, currency_code, timezone, name').eq('id', selection.selectedAdAccountId).eq('business_id', context.businessId).maybeSingle(),
        db.from('platform_integrations').select('id, platform_id, status, platforms(key)').eq('id', selection.selectedPlatformId).eq('business_id', context.businessId).maybeSingle(),
    ]);
    if (accountError || integrationError)
        throw new AssistantError('Account access could not be verified.', 503);
    const platform = Array.isArray(integration?.platforms) ? integration.platforms[0] : integration?.platforms;
    if (!account || !integration || account.platform_id !== integration.platform_id || platform?.key !== 'meta')
        throw new AssistantError('Selected Meta account is unavailable.', 403);
    return { db, businessId: context.businessId, userId: data.user.id, account, integration };
}
export type AssistantAccess = Awaited<ReturnType<typeof authorizeAssistant>>;
