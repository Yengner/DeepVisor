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
    business_name: string,
    phone_number: string
) {
    try {
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase.auth.signUp({
            email,
            phone: phone_number,
            password,
            options: {
                data: {
                    first_name,
                    last_name,
                    business_name,
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
        const business_name = metadata?.business_name || '';
        const phone_number = metadata?.phone_number || '';

        // Insert profile record
        const { error } = await supabase.from("profiles").insert({
            id: userId,
            full_name: `${first_name} ${last_name}`.trim(),
            business_name: business_name,
            phone_number: phone_number,
            avatar_url: null,
            plan_tier: null,
            subscription_status: null,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            subscription_start_date: null,
            subscription_end_date: null,
            subscription_created: null,
            completed: false,
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
            .from('profiles')  // Changed from 'users' to 'profiles'
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