"use server";

// ===== AUTHENTICATION ACTIONS =====

import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { getErrorMessage } from "@/lib/utils/utils";

/**
 * Handles user login with email and password
 * @param email User's email
 * @param password User's password
 * @return Success status and error message if any
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
 * @param email User's email
 * @param password User's password
 * @param first_name User's first name
 * @param last_name User's last name
 * @param phone_number User's phone number
 * @return Success status and user ID if successful, error message otherwise
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
 * Handles user sign out
 * @return Success status and error message if any
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

// ===== EMAIL VERIFICATION ACTIONS =====

/**
 * Resends verification email
 * @param email User's email to resend verification to
 * @return Success status and error message if any
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