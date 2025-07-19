import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { getErrorMessage } from "@/lib/utils/utils";

/**
 * Updates user onboarding progress
 * @param onboarding_completed Whether the onboarding is completed
 * @param step The current step in the onboarding process
 * @return Success status and error message if any
*/
export async function updateOnboardingProgress(onboarding_completed: boolean, step?: number) {
    try {
        const supabase = await createSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        const updateData: {
            onboarding_completed?: boolean;
            onboarding_step?: number;
            onboarding_updated_at: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any;
        } = {
            onboarding_updated_at: new Date().toISOString(),
        };

        if (onboarding_completed) {
            updateData.onboarding_completed = true;
        }

        if (typeof step === 'number') {
            updateData.onboarding_step = step;
        }

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', user.id);

        if (error) {
            throw error;
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating onboarding progress:', error);
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Gets user onboarding progress from the database
*/
export async function getOnboardingProgress() {
    try {
        const supabase = await createSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
            .from('profiles')
            .select(`
                    onboarding_step, 
                    onboarding_completed, 
                    connected_accounts, 
                    business_name,
                    business_type,
                    industry,
                    monthly_budget,
                    website,
                    description,
                    ad_goals, 
                    preferred_platforms,
                    email_notifications,
                    weekly_reports,
                    performance_alerts
            `)
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching onboarding progress:', error);
            throw error;
        }

        return {
            success: true,
            step: data?.onboarding_step || 0,
            completed: data?.onboarding_completed || false,
            connectedAccounts: data?.connected_accounts || [],
            businessData: {
                businessName: data?.business_name || '',
                businessType: data?.business_type || '',
                industry: data?.industry || '',
                monthlyBudget: data?.monthly_budget || '',
                website: data?.website || '',
                description: data?.description || '',
                adGoals: data?.ad_goals || [],
                preferredPlatforms: data?.preferred_platforms || [],
                emailNotifications: data?.email_notifications || false,
                weeklyReports: data?.weekly_reports || false,
                performanceAlerts: data?.performance_alerts || false
            }
        };
    } catch (error) {
        console.error('Error getting onboarding progress:', error);
        return {
            success: false,
            step: 0,
            completed: false,
            connectedAccounts: [],
            businessData: {
                businessName: '',
                businessType: '',
                industry: '',
                adGoals: [],
                monthlyBudget: '',
                preferredPlatforms: [],
                emailNotifications: false,
                weeklyReports: false,
                performanceAlerts: false
            }
        };
    }
}

/**
 * Updates user business profile data
 * @param businessData The business data to update
 * @return Success status and error message if any
*/
export async function updateBusinessProfileData(businessData: {
    businessName?: string;
    businessType?: string;
    industry?: string;
    monthlyBudget?: string;
    website?: string;
    description?: string;
    adGoals?: string[];
    preferredPlatforms?: string[];
    weeklyReports?: boolean;
    emailNotifications?: boolean;
    performanceAlerts?: boolean;
}) {
    try {
        const supabase = await createSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        // Prepare the update data
        console.log('Updating business profile data:', businessData);
        const updateData = {
            business_name: businessData.businessName,
            business_type: businessData.businessType,
            industry: businessData.industry,
            monthly_budget: businessData.monthlyBudget,
            website: businessData.website,
            description: businessData.description,
            ad_goals: businessData.adGoals,
            preferred_platforms: businessData.preferredPlatforms,
            weekly_reports: businessData.weeklyReports,
            email_notifications: businessData.emailNotifications,
            performance_alerts: businessData.performanceAlerts,
            updated_at: new Date().toISOString()
        };

        // Remove undefined values
        Object.keys(updateData).forEach((key) => {
            const typedKey = key as keyof typeof updateData;
            if (updateData[typedKey] === undefined) {
                delete updateData[typedKey];
            }
        });

        // Update the profile
        const { error, data } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', user.id)
            .select();

        if (error) {
            console.error('Database update error:', error);
            throw error;
        }

        console.log('Update successful, returned data:', data);
        return { success: true };
    } catch (error) {
        console.error('Error updating business profile data:', error);
        return { success: false, error: getErrorMessage(error) };
    }
}