import { AdAccountWithMetrics } from "@/lib/api/platforms/meta/types";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { getErrorMessage, parseStringify } from "@/lib/utils/utils";
import { redirect } from "next/navigation";


// ====== USER PROFILE ACTIONS =====
/**
 * Creates user profile after email verification
 * @param userId The ID of the user for whom the profile is being created
 * @return Success status and error message if any
*/
export async function createUserProfile(userId: string) {
    try {
        const supabase = await createSupabaseClient();

        // Get user data
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData.user) {
            console.error("Error fetching user data:", userError);
            return { success: false, errorMessage: "Failed to retrieve user data" };
        }

        const metadata = userData.user.user_metadata;
        const first_name = metadata?.first_name || '';
        const last_name = metadata?.last_name || '';
        const phone_number = metadata?.phone_number || '';

        // Insert profile record
        const { error } = await supabase.from("profiles").insert({
            id: userId,
            full_name: `${first_name} ${last_name}`.trim(),
            phone_number: phone_number,
            avatar_url: null,
            plan_tier: null,
            subscription_status: null,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            subscription_start_date: null,
            subscription_end_date: null,
            subscription_created: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        if (error) {
            console.error("Error creating profile:", error);
            return { success: false, errorMessage: "Failed to create user profile" };
        }

        return { success: true, errorMessage: null };
    } catch (error) {
        console.error("Unexpected error creating profile:", error);
        return { success: false, errorMessage: getErrorMessage(error) };
    }
}

// ===== USER DATA ACTIONS =====

/**
 * Gets the currently logged-in user or redirects to login
*/
export async function getLoggedInUser() {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
        console.warn('No active user found. Redirecting to /login.');
        redirect('/login');
    }

    const user = await getUserInfo({ userId: data.user.id });

    if (user.onboarding_completed === false) {
        console.warn('User onboarding not completed. Redirecting to /onboarding.');
        redirect('/onboarding');
    }

    return user;
}

/**
 * Gets user information by user ID
 * @param userId The ID of the user to retrieve information for
 * @return User information or error message
*/
async function getUserInfo({ userId }: { userId: string }) {
    try {
        const supabase = await createSupabaseClient();

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        return parseStringify(data);
    } catch (error) {
        return { errorMessage: getErrorMessage(error) };
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
    supabase: any,
    userId: string,
    accountsToAdd: AdAccountWithMetrics | AdAccountWithMetrics[],
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
            (acc: any) => acc.platform === 'meta' && acc.accountId === account.details.id
        );

        if (existingIndex === -1) {
            connectedAccounts.push({
                platform: 'meta',
                accountId: account.details.id,
                accountName: account.details.name,
                connectedAt: currentTime,
                ad_account_ref: savedAdAccountIds[account.details.id]
            });
            updated = true;
        } else if (savedAdAccountIds[account.details.id]) {

            connectedAccounts[existingIndex] = {
                ...connectedAccounts[existingIndex],
                ad_account_ref: savedAdAccountIds[account.details.id],
                accountName: account.details.name,
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
 * 
 * @param userId The ID of the user to fetch notifications for
 * @param limit The maximum number of notifications to fetch
 * @returns An array of notifications for the user
 */
export async function getUserNotifications(userId: string, limit = 10) {
    try {
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
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
export function getTierLimits(tier: SubscriptionTier): TierLimits {
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

