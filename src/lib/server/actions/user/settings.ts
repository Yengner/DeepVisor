import { STATIC_NOTIFICATION_FEED, type NotificationFeedItem } from '@/lib/shared';
import type { AdAccountDetails } from "../../services/platforms/meta/types";
import { createSupabaseClient } from "../../supabase/server";

function getStaticNotifications(userId: string, limit: number): NotificationFeedItem[] {
    return STATIC_NOTIFICATION_FEED.slice(0, limit).map((notification) => ({
        ...notification,
        user_id: userId,
    }));
}

/**
 * 
 * @param userId The ID of the user to fetch notifications for
 * @param limit The maximum number of notifications to fetch
 * @returns An array of notifications for the user
 */
export async function getUserNotifications(userId: string, limit = 10): Promise<NotificationFeedItem[]> {
    try {
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error || !data || data.length === 0) {
            return getStaticNotifications(userId, limit);
        }

        return data;
    } catch {
        return getStaticNotifications(userId, limit);
    }
}


/**
 * Update user's connected accounts in profile
 * @param supabase Supabase client instance
 * @param userId The ID of the user to update
 * @param accountsToAdd The ad accounts to add to the user's profile
 * @param savedAdAccountIds Map of ad account IDs to their saved references
 * @return Promise that resolves when the update is complete
 */
export async function updateUserConnectedAccounts(
    supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    userId: string,
    accountsToAdd: AdAccountDetails | AdAccountDetails[],
    savedAdAccountIds: { [adAccountId: string]: string }
): Promise<void> {

    if (Array.isArray(accountsToAdd) && accountsToAdd.length === 0) {
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

    for (const account of Array.isArray(accountsToAdd) ? accountsToAdd : [accountsToAdd]) {
        const existingIndex = connectedAccounts.findIndex(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (acc: any) => acc.platform === 'meta' && acc.accountId === account.id
        );

        if (existingIndex === -1) {
            connectedAccounts.push({
                platform: 'meta',
                accountId: account.id,
                accountName: account.name,
                connectedAt: currentTime,
                ad_account_ref: savedAdAccountIds[account.id]
            });
            updated = true;
        } else if (savedAdAccountIds[account.id]) {

            connectedAccounts[existingIndex] = {
                ...connectedAccounts[existingIndex],
                ad_account_ref: savedAdAccountIds[account.id],
                accountName: account.name,
                updatedAt: currentTime
            };
            updated = true;
        }
    }

    if (updated) {
        await supabase
            .from('profiles')
            .update({ connected_accounts: connectedAccounts })
            .eq('id', userId);
    }
}

/**
 * Gets the user's subscription tier and limits
 * @param userId The ID of the user to get subscription tier for
 * @return Subscription tier and limits
*/
export type SubscriptionTier = 'tier1' | 'tier2' | 'tier3' | 'agency' | 'free';

export interface TierLimits {
    maxAdAccounts: number;
    maxPlatforms: string[];
    allowMultipleAccounts: boolean;
}


export async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
    try {
        const supabase = await createSupabaseClient();

        // Query the user's subscription information
        const { data, error } = await supabase
            .from('profiles')
            .select('subscription_status, plan_tier')
            .eq('id', userId)
            .single();

        if (error || !data) {
            console.warn('No active subscription found for user:', userId);
            return 'free';
        }

        return data.plan_tier as SubscriptionTier;
    } catch (error) {
        console.error('Error fetching user subscription tier:', error);
        return 'free'; // Default to free tier on error
    }
}

/**
 * Gets the limits for a given subscription tier
 * @param tier The subscription tier to get limits for
 * @return The limits for the specified tier
*/
export async function getTierLimits(tier: SubscriptionTier): Promise<TierLimits> {
    switch (tier) {
        case 'tier1':
            return {
                maxAdAccounts: 1,
                maxPlatforms: ['meta'],
                allowMultipleAccounts: false
            };
        case 'tier2':
            return {
                maxAdAccounts: 5,
                maxPlatforms: ['meta', 'google', 'tiktok'],
                allowMultipleAccounts: true
            };
        case 'tier3':
        case 'agency':
            return {
                maxAdAccounts: 999,
                maxPlatforms: ['meta', 'google', 'tiktok', 'linkedin', 'pinterest', 'twitter'],
                allowMultipleAccounts: true
            };
        default:
            return {
                maxAdAccounts: 1,
                maxPlatforms: ['meta'],
                allowMultipleAccounts: false
            };
    }
}
