"use server";

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/server/supabase/server';
import type { Database } from '@/lib/shared/types/supabase';
import { requireUserId } from '@/lib/server/actions/user/session';

type UserRow = Database['public']['Tables']['users']['Row'];

async function requireUserRow(userId: string): Promise<UserRow> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    redirect('/login');
  }

  return data;
}

export async function getLoggedInUserOrRedirect(): Promise<UserRow> {
  const userId = await requireUserId();
  return requireUserRow(userId);
}

export async function getLoggedInUser(): Promise<UserRow | null> {
  try {
    const userId = await requireUserId();
    return await requireUserRow(userId);
  } catch {
    return null;
  }
}
