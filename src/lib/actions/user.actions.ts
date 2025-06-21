'use server';

import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { getErrorMessage, parseStringify } from '../utils/utils';
import { redirect } from 'next/navigation';

// ===== AUTHENTICATION ACTIONS =====

/**
 * Handles user login with email and password
*/
export async function handleLogin(email: string, password: string) {
    try {
        const supabase = await createSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            throw error;
        }

        return { success: true, errorMessage: null };
    } catch (error) {
        return { success: false, errorMessage: getErrorMessage(error) };
    }
}

/**
 * Handles user signup - creates auth record but NOT profile
*/
export async function handleSignUp(
    email: string,
    password: string,
    first_name: string,
    last_name: string,
    phone_number: string
) {
    try {
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase.auth.signUp({
            email,
            phone: phone_number, // Have to fix this later but focusing on email for now
            password,
            options: {
                data: {
                    first_name,
                    last_name,
                    phone_number,
                },
            },
        });

        if (error) {
            console.error("Supabase signUp Error:", error.message, error);
            throw error;
        }

        // No longer creating profile here - will create after verification

        return { success: true, userId: data.user?.id, errorMessage: null };
    } catch (error) {
        return { success: false, errorMessage: getErrorMessage(error) };
    }
}

/**
 * Creates user profile after email verification
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

/**
 * Handles user sign out
*/
export async function handleSignOut() {
    try {
        const supabase = await createSupabaseClient();
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        return { success: true, errorMessage: null };
    } catch (error) {
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
    return user;
}

/**
 * Gets user information by user ID
*/
export async function getUserInfo({ userId }: { userId: string }) {
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

// ===== EMAIL VERIFICATION ACTIONS =====

/**
 * Resends verification email
*/
export async function resendVerificationEmail(email: string) {
    try {
        const supabase = await createSupabaseClient();

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
        });

        if (error) {
            console.error('Error resending verification email:', error.message);
            throw error;
        }

        return { success: true };
    } catch (error) {
        console.error('Unexpected error while resending verification email:', error);
        return { success: false, error: getErrorMessage(error) };
    }
}

// ===== OTHER USER ACTIONS =====

/**
 * Updates user onboarding progress
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

        // Log what we're actually sending to the database because this is annoying me
        console.log('Sending to database:', updateData);

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