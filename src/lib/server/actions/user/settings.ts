import type { NotificationFeedItem } from '@/lib/shared';
import {
    listNotifications,
    listUnreadNotificationIds,
} from '@/lib/server/intelligence/repositories/notifications';
import { createSupabaseClient } from "../../supabase/server";

/**
 * 
 * @param userId The ID of the user to fetch notifications for
 * @param limit The maximum number of notifications to fetch
 * @returns An array of notifications for the user
 */
export async function getUserNotifications(userId: string, limit = 10): Promise<NotificationFeedItem[]> {
    try {
        const supabase = await createSupabaseClient();
        return await listNotifications(supabase as any, {
            userId,
            limit,
        });
    } catch (error) {
        console.error('Failed to load user notifications:', error);
        return [];
    }
}

export async function getUnreadUserNotificationIds(userId: string): Promise<string[]> {
    try {
        const supabase = await createSupabaseClient();
        return await listUnreadNotificationIds(supabase as any, { userId });
    } catch (error) {
        console.error('Failed to load unread notification ids:', error);
        return [];
    }
}

/**
 * Gets the user's subscription tier and limits
 * @param userId The ID of the user to get subscription tier for
 * @return Subscription tier and limits
*/
const LEGACY_MANAGED_SERVICE_TIER = 'agency';

export type SubscriptionTier = 'tier1' | 'tier2' | 'tier3' | 'managed_service' | 'free';

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

        if (data.plan_tier === LEGACY_MANAGED_SERVICE_TIER) {
            return 'managed_service';
        }

        if (data.plan_tier === 'tier1' || data.plan_tier === 'tier2' || data.plan_tier === 'tier3') {
            return data.plan_tier;
        }

        return 'free';
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
        case 'managed_service':
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
