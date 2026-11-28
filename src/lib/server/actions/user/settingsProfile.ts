'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('profileErrors');
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: t('invalidProfile') };
  try {
    const client = await createServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { success: false, message: t('signInProfile') };
    const { error } = await client.from('users').update({
      ...parsed.data,
      phone_number: parsed.data.phone_number || null,
    }).eq('id', user.id).select('id').single();
    if (error) return { success: false, message: t('saveFailed') };
    revalidatePath('/', 'layout');
    return { success: true, message: 'Profile saved.' };
  } catch {
    return { success: false, message: t('saveFailed') };
  }
}

export async function requestOwnEmailChange(input: unknown): Promise<Result> {
  const t = await getTranslations('profileErrors');
  const parsed = z.string().trim().email().max(254).safeParse(input);
  if (!parsed.success) return { success: false, message: t('invalidEmail') };
  try {
    const client = await createServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { success: false, message: t('signInEmail') };
    if (!recentlySignedIn(user)) return { success: false, message: t('recentSignInEmail') };
    if (parsed.data.toLowerCase() === user.email?.toLowerCase()) return { success: false, message: t('sameEmail') };
    // Supabase owns verification. Never write an unconfirmed address to public.users.
    const { data, error } = await client.auth.updateUser({ email: parsed.data });
    if (error) return { success: false, message: t('emailRequestFailedCheck') };
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: data.user?.email?.toLowerCase() === parsed.data.toLowerCase()
        ? 'Email updated.'
        : 'Check your new and current inboxes for confirmation instructions. Your current email stays active until verification is complete.',
    };
  } catch {
    return { success: false, message: t('emailRequestFailed') };
  }
}

const deletionMessageKeys: Record<string, 'deleteLastOwner' | 'deleteStorage' | 'deleteBusy' | 'deleteActiveClients'> = {
  ACCOUNT_DELETE_LAST_OWNER: 'deleteLastOwner',
  ACCOUNT_DELETE_STORAGE: 'deleteStorage',
  ACCOUNT_DELETE_BUSY: 'deleteBusy',
  ACCOUNT_DELETE_ACTIVE_CLIENTS: 'deleteActiveClients',
};

export async function deleteOwnAccount(confirmation: unknown): Promise<Result> {
  const t = await getTranslations('profileErrors');
  if (confirmation !== 'DELETE') return { success: false, message: t('deleteConfirm') };
  let deleted = false;
  try {
    const client = await createServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { success: false, message: t('signInDelete') };
    if (!recentlySignedIn(user)) return { success: false, message: t('recentSignInDelete') };
    const admin = createAdminClient();
    // Authenticated identity only; no user/workspace IDs are accepted from the browser.
    const { error: checkError } = await admin.rpc('assert_account_deletable', { p_user: user.id });
    if (checkError) return { success: false, message: t(deletionMessageKeys[checkError.message] ?? 'deleteUnavailable') };
    // The database repeats the checks and cleans up in the same Auth deletion transaction.
    const { error } = await admin.auth.admin.deleteUser(user.id, false);
    if (error) return { success: false, message: t('deleteUnconfirmed') };
    deleted = true;
    await client.auth.signOut({ scope: 'local' });
    const cookieStore = await cookies();
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.startsWith('sb-') || ['platform_integration_id', 'ad_account_row_id', 'active_business_id'].includes(cookie.name)) cookieStore.delete(cookie.name);
    }
    return { success: true, message: 'Account permanently deleted.' };
  } catch {
    if (deleted) return { success: true, message: 'Account permanently deleted.' };
    return { success: false, message: t('deleteUnconfirmed') };
  }
}
