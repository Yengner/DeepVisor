import { NextResponse } from 'next/server';
import { getTierLimits } from '@/lib/utils/subscription';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Interface for Ad Account data
interface AdAccount {
    id: string;
    name: string;
    account_status: number;
    amount_spent: number;
    users?: any;
}

// Interface for Page Account data
interface PageAccount {
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: {
        id: string;
    };
}


/**
 * Handle redirection after Meta OAuth connection
 */
export function redirectWithError(request: Request, isOnboarding: boolean, error: string) {
    if (isOnboarding) {
        return NextResponse.redirect(
            new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/onboarding?platform=meta&status=error&error=${error}`, request.url)
        );
    } else {
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL}/integration/meta/unsuccessful?error=${error}`
        );
    }
}


/**
 * Fetch Meta page accounts for a user
 */
export async function fetchMetaPageAccounts(accessToken: string): Promise<{ data: PageAccount[] }> {
    const pageAccountUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/me/accounts?fields=id,name,account,access_token,instagram_business_account`;

    const pageAccountResponse = await fetch(pageAccountUrl, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!pageAccountResponse.ok) {
        const errorDetails = await pageAccountResponse.json();
        throw new Error(errorDetails.error?.message || 'Failed to fetch page accounts');
    }

    return await pageAccountResponse.json();
}

/**
 * Store Meta integration data in Supabase
 */
export async function storeMetaIntegration(
    supabase: any,
    userId: string,
    accessToken: string
): Promise<string> {
    const date = new Date().toISOString();

    // Extract additional token details
    const integrationDetails = {
        access_token: accessToken,
        issued_at: date,
    };

    // Upsert into the platform_integration table
    const upsertData = {
        user_id: userId,
        platform_name: 'meta',
        access_token: accessToken,
        is_integrated: true,
        integration_details: integrationDetails,
        created_at: date,
        updated_at: date,
    };

    const { data, error } = await supabase
        .from('platform_integrations')
        .upsert(upsertData)
        .select('id')
        .single();

    if (error || !data) {
        throw new Error('Failed to save platform integration');
    }

    return data.id;
}

/**
 * Store ad accounts with tier-based limits
 */
export async function storeAdAccounts(
    supabase: any,
    userId: string,
    platformIntegrationId: string,
    adAccounts: AdAccount[],
    userTier?: string
): Promise<{ accounts: AdAccount[], accountIdMap: { [adAccountId: string]: string } }> {
    const date = new Date().toISOString();

    // Get tier limits
    const { maxAdAccounts } = getTierLimits(userTier as any);

    // Apply tier limits
    let accountsToSave = [...adAccounts];

    // Enforce the limit if needed
    if (accountsToSave.length > maxAdAccounts) {
        accountsToSave = accountsToSave.slice(0, maxAdAccounts);
    }

    // Format accounts for database
    const adAccountsForDb = accountsToSave.map((account) => ({
        user_id: userId,
        platform_integration_id: platformIntegrationId,
        ad_account_id: account.id,
        platform_name: 'meta',
        name: account.name,
        account_status: account.account_status,
        created_at: date,
        updated_at: date,
    }));

    // Skip if no accounts to save
    if (adAccountsForDb.length === 0) {
        return { accounts: [], accountIdMap: {} };
    }

    // Save to database and get back the inserted rows with their UUIDs
    const { data: savedAccounts, error: adAccountsError } = await supabase
        .from('ad_accounts')
        .upsert(adAccountsForDb)
        .select('id, ad_account_id'); // Get back the internal IDs and ad account IDs

    if (adAccountsError) {
        console.error('Supabase ad account upsert error:', adAccountsError);
        throw new Error('Failed to save ad accounts to Supabase');
    }

    // Create mapping of ad account IDs to their row UUIDs
    const accountIdMap: { [adAccountId: string]: string } = {};
    if (savedAccounts) {
        for (const account of savedAccounts) {
            accountIdMap[account.ad_account_id] = account.id;
        }
    }

    return { accounts: accountsToSave, accountIdMap };
}

/**
 * Store page accounts
 */
export async function storePageAccounts(
    supabase: any,
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

/**
 * Update user's connected accounts in profile
 */
export async function updateUserConnectedAccounts(
    supabase: any,
    userId: string,
    accountsToAdd: AdAccount[],
    savedAdAccountIds: { [adAccountId: string]: string } // Map of ad account IDs to their row UUIDs
): Promise<void> {
    // Skip if no accounts to add
    if (accountsToAdd.length === 0) {
        return;
    }

    // Get existing connected accounts
    const { data } = await supabase
        .from('profiles')
        .select('connected_accounts')
        .eq('id', userId)
        .single();

    const connectedAccounts = data?.connected_accounts || [];
    const currentTime = new Date().toISOString();

    // Add each new account if not already connected
    let updated = false;

    for (const account of accountsToAdd) {
        const existingIndex = connectedAccounts.findIndex(
            (acc: any) => acc.platform === 'meta' && acc.accountId === account.id
        );

        if (existingIndex === -1) {
            // Add new connection with reference to ad_accounts table
            connectedAccounts.push({
                platform: 'meta',
                accountId: account.id,
                accountName: account.name,
                connectedAt: currentTime,
                ad_account_ref: savedAdAccountIds[account.id] // Reference to the ad_accounts row
            });
            updated = true;
        } else if (savedAdAccountIds[account.id]) {
            // Update existing connection with reference
            connectedAccounts[existingIndex] = {
                ...connectedAccounts[existingIndex],
                ad_account_ref: savedAdAccountIds[account.id],
                accountName: account.name, // Refresh name in case it changed
                updatedAt: currentTime
            };
            updated = true;
        }
    }

    // Update profile if accounts were added or updated
    if (updated) {
        await supabase
            .from('profiles')
            .update({ connected_accounts: connectedAccounts })
            .eq('id', userId);
    }
}

/**
 * Check if user needs account selection based on tier and accounts
 */
export function needsAccountSelection(
    userTier: string,
    adAccounts: AdAccount[],
    isOnboarding: boolean
): boolean {
    // During onboarding we'll just use the first account for simplicity
    if (isOnboarding) {
        return false;
    }

    // If tier1 or free and has multiple accounts
    return (userTier === 'tier1' || userTier === 'free') && adAccounts.length > 1;
}

// Add this function to your existing utils

/**
 * Trigger sync of user ad data after successful Meta integration
 */
export async function triggerMetaSync(userId: string) {
    try {
        // Call the Supabase Edge Function
        const response = await fetch('https://gkdyyjqepzayjdpvqnja.supabase.co/functions/v1/sync_user_ad_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Error triggering ad data sync:', response.status, errorData);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Failed to trigger ad data sync:', error);
        return false;
    }
}