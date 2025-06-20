import { createSupabaseClient } from './supabase/clients/server';

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
            .eq('user_id', userId)
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