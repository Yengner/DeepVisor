'use server';

import { createServerClient } from '@/lib/server/supabase/server';

type CreateUserProfileResult = {
  success: boolean;
  errorMessage: string | null;
};

export async function createUserProfile(userId: string): Promise<CreateUserProfileResult> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || user.id !== userId) {
      return {
        success: false,
        errorMessage: 'Authenticated user not found.',
      };
    }

    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (existingUserError) {
      return {
        success: false,
        errorMessage: existingUserError.message,
      };
    }

    if (existingUser) {
      return {
        success: true,
        errorMessage: null,
      };
    }

    const metadata =
      user.user_metadata && typeof user.user_metadata === 'object'
        ? user.user_metadata
        : {};
    const firstName =
      typeof metadata.first_name === 'string' ? metadata.first_name : '';
    const lastName =
      typeof metadata.last_name === 'string' ? metadata.last_name : '';
    const phoneNumber =
      typeof metadata.phone_number === 'string' ? metadata.phone_number : '';

    if (!user.email) {
      return {
        success: false,
        errorMessage: 'Authenticated user email is missing.',
      };
    }

    const { error: insertError } = await supabase.from('users').insert({
      id: userId,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber,
      status: 'active',
    });

    if (insertError) {
      return {
        success: false,
        errorMessage: insertError.message,
      };
    }

    return {
      success: true,
      errorMessage: null,
    };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Failed to create user profile.',
    };
  }
}
