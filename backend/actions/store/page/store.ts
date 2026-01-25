import { PageAccount } from "@/lib/api/platforms/meta/types";

/**
 * Store page accounts
 */
export async function storePageAccounts(
    supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    userId: string,
    platformIntegrationId: string,
    pageAccounts: PageAccount[]
): Promise<void> {
    const date = new Date().toISOString();

    // Skip if no page accounts
    if (pageAccounts.length === 0) {
        return;
    }

    // Format page accounts for database
    const pageAccountsForDb = pageAccounts.map((account) => (
        {
            user_id: userId,
            platform_integration_id: platformIntegrationId,
            page_id: account.id,
            name: account.name,
            access_token: account.access_token,
            instagram_account_id: account.instagram_business_account?.id || null,
            created_at: date,
        }
    )
    );

    // Save to database
    const { error: pageAccountsError } = await supabase
        .from('meta_pages')
        .upsert(pageAccountsForDb);

    if (pageAccountsError) {
        console.error('Supabase page account upsert error:', pageAccountsError);
        throw new Error('Failed to save page accounts to Supabase');
    }
}
