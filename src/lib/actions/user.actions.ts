'use server';

import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { getErrorMessage, parseStringify } from '../utils/utils';
import { redirect } from 'next/navigation';


export async function handleLogin(email: string, password: string) {

    try {
        const supabase = await createSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            throw error;
        }

        return { errorMessage: null }

    } catch (error) {
        return { errorMessage: getErrorMessage(error) }
    }
}

// Handle Sign Up
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

        if (data.user) {
            await supabase.from("user_onboarding").insert({
                user_id: data.user.id,
                businessType: null,
                hasEcommerce: false,
                adGoal: null,
                monthlyBudget: null,
                socialPlatforms: [],
                runsAds: false,
                completed: false
            });
        }

        return { errorMessage: null }

    } catch (error) {
        return { errorMessage: getErrorMessage(error) }
    }
}

export async function handleSignOut() {

    try {
        const supabase = await createSupabaseClient();
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        return { errorMessage: null }

    } catch (error) {

        return { errorMessage: getErrorMessage(error) }

    }
}

// Helper function for updating user
// export async function updateUser(email: string) {
//   const { error } = await supabase.supabase.auth.updateUser({ email });

//   if (error) {
//     return { success: false, message: error.message };
//   }

//   return { success: true };
// }

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

export async function getUserInfo({ userId }: getUserInfoProps) {

    try {
        const supabase = await createSupabaseClient();

        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        return parseStringify(data);
    } catch (error) {
        return { errorMessage: getErrorMessage(error) }
    }
};

// export async function getAdAccounts({ userId }: getAdAccountsProps) {

//     try {
//         const supabase = createSupabaseClient();

//         const { data } = await supabase
//             .from('ad_accounts') // The table where social media data is stored
//             .select('ad_account_id')
//             .eq('platform', 'facebook')
//             .eq('user_id', userId);

//         return parseStringify(data);
//     } catch (error) {

//     }

// }

export async function handleFreeEstimate(data: {
    name: string;
    company?: string;
    email: string;
    phone: string;
    budget: string;
    projectDetails: string;
    timeline: string;
    preferredContact: string;
    isFreeOption: boolean;
    estimatedIncome?: string;
    termsAgreed: boolean;
}) {
    try {
        const supabase = await createSupabaseClient();
        const { data: insertedData, error } = await supabase
            .from('free_estimates')
            .insert([
                {
                    name: data.name,
                    company: data.company || null,
                    email: data.email,
                    phone: data.phone,
                    budget: data.budget,
                    project_details: data.projectDetails,
                    timeline: data.timeline,
                    preferred_contact: data.preferredContact,
                    is_free_option: data.isFreeOption,
                    estimated_income: data.isFreeOption ? data.estimatedIncome || null : null,
                    terms_agreed: data.termsAgreed,
                },
            ]);

        if (error) throw error;

        return { success: true, data: insertedData };
    } catch (error) {
        if (error instanceof Error) {
            console.error('Supabase Insert Error:', error.message);
            return { success: false, error: error.message };
        } else {
            console.error('Unknown error:', error);
            return { success: false, error: 'An unknown error occurred.' };
        }
    }
};

export async function handleUploadFile(file: File, userId: string) {
    try {
        const supabase = await createSupabaseClient();

        if (!userId || typeof userId !== "string") {
            return { success: false, message: "Invalid user ID." };
        }

        const sanitizedFileName = file.name.replace(/\s+/g, "-");
        const filePath = `${userId}/${Date.now()}-${sanitizedFileName}`;

        const storage = supabase.storage;

        if (!file) {
            return { success: false, message: "No file uploaded." };
        }

        const { error: bucketError } = await storage
            .from("business-media")
            .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
            });

        if (bucketError) {
            console.error("Error uploading file:", bucketError);
            return { success: false, message: "Error Uploading File." };
        }

        const { data } = supabase.storage
            .from("business-media")
            .getPublicUrl(filePath)


        const publicUrl = data?.publicUrl ?? null;

        if (!publicUrl) {
            console.error("Error getting public URL.");
            return { success: false, message: "Error getting public URL." };
        }

        return { success: true, url: publicUrl };

    } catch (error) {
        return { success: false, error: getErrorMessage(error) };
    }
}

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