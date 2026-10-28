'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/server/supabase/server';
import { createAdminClient } from '@/lib/server/supabase/admin';

type Result = { success: boolean; message: string };
const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone_number: z.string().trim().max(40).refine(
    value => !value || /^[+\d\s().-]+$/.test(value),
    'Use a valid phone number.'
  ),
}).strict();

function recentlySignedIn(user: User): boolean {
  const age = Date.now() - Date.parse(user.last_sign_in_at ?? '');
  return Number.isFinite(age) && age >= -60_000 && age < 10 * 60_000;
}

export async function updateOwnProfile(input: unknown): Promise<Result> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: 'Enter your first and last name (up to 100 characters) and a valid optional phone number.' };
  try {
    const client = await createServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { success: false, message: 'Sign in to update your profile.' };
    const { error } = await client.from('users').update({
      ...parsed.data,
      phone_number: parsed.data.phone_number || null,
    }).eq('id', user.id).select('id').single();
    if (error) return { success: false, message: 'Your profile could not be saved. Please try again.' };
    revalidatePath('/', 'layout');
    return { success: true, message: 'Profile saved.' };
  } catch {
    return { success: false, message: 'Your profile could not be saved. Please try again.' };
  }
}

export async function requestOwnEmailChange(input: unknown): Promise<Result> {
  const parsed = z.string().trim().email().max(254).safeParse(input);
  if (!parsed.success) return { success: false, message: 'Enter a valid email address.' };
  try {
    const client = await createServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { success: false, message: 'Sign in to change your email.' };
    if (!recentlySignedIn(user)) return { success: false, message: 'For security, sign out and sign in again before changing your email.' };
    if (parsed.data.toLowerCase() === user.email?.toLowerCase()) return { success: false, message: 'Enter a different email address.' };
    // Supabase owns verification. Never write an unconfirmed address to public.users.
    const { data, error } = await client.auth.updateUser({ email: parsed.data });
    if (error) return { success: false, message: 'Email change could not be requested. Check the address and try again later.' };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: data.user?.email?.toLowerCase() === parsed.data.toLowerCase()
        ? 'Email updated.'
        : 'Check your new and current inboxes for confirmation instructions. Your current email stays active until verification is complete.',
    };
  } catch {
    return { success: false, message: 'Email change could not be requested. Please try again later.' };
  }
}

const deletionMessages: Record<string, string> = {
  ACCOUNT_DELETE_LAST_OWNER: 'Transfer ownership to another member before deleting your account. Shared workspaces need a remaining owner.',
  ACCOUNT_DELETE_STORAGE: 'Your account owns uploaded files. Contact support to remove or transfer those files before deleting your account.',
  ACCOUNT_DELETE_BUSY: 'A sync or advertising operation is still running or needs reconciliation. Please wait, or contact support if it is stuck.',
};

export async function deleteOwnAccount(confirmation: unknown): Promise<Result> {
  if (confirmation !== 'DELETE') return { success: false, message: 'Type DELETE to confirm permanent account deletion.' };
  let deleted = false;
  try {
    const client = await createServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { success: false, message: 'Sign in to delete your account.' };
    if (!recentlySignedIn(user)) return { success: false, message: 'For security, sign out and sign in again before deleting your account.' };
    const admin = createAdminClient();
    // Authenticated identity only; no user/workspace IDs are accepted from the browser.
    const { error: checkError } = await admin.rpc('assert_account_deletable', { p_user: user.id });
    if (checkError) return { success: false, message: deletionMessages[checkError.message] ?? 'Account deletion is unavailable. Contact support before trying again.' };
    // The database repeats the checks and cleans up in the same Auth deletion transaction.
    const { error } = await admin.auth.admin.deleteUser(user.id, false);
    if (error) return { success: false, message: 'Account deletion could not be confirmed. Please sign in again to check your account before retrying.' };
    deleted = true;
    await client.auth.signOut({ scope: 'local' });
    const cookieStore = await cookies();
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.startsWith('sb-') || ['platform_integration_id', 'ad_account_row_id'].includes(cookie.name)) cookieStore.delete(cookie.name);
    }
    return { success: true, message: 'Account permanently deleted.' };
  } catch {
    if (deleted) return { success: true, message: 'Account permanently deleted.' };
    return { success: false, message: 'Account deletion could not be confirmed. Please sign in again to check your account before retrying.' };
  }
}
