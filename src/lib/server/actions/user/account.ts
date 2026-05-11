"use server";

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/server/supabase/server';
import type { Database } from '@/lib/shared/types/supabase';
import { requireUserId } from '@/lib/server/actions/user/session';
import { createServerTimer } from '@/lib/server/timing';

type UserRow = Database['public']['Tables']['users']['Row'];

async function requireUserRow(userId: string): Promise<UserRow> {
  const timer = createServerTimer('context', { enabledEnvVar: 'CONTEXT_TIMING' });
  const supabase = await timer.measure('create server client: user row', () => createServerClient());

  const { data, error } = await timer.measure('user row query', () =>
    supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
  );

  if (error || !data) {
    redirect('/login');
  }

  timer.finish('require user row total');
  return data;
}

export async function getLoggedInUserOrRedirect(): Promise<UserRow> {
  const timer = createServerTimer('context', { enabledEnvVar: 'CONTEXT_TIMING' });
  const userId = await timer.measure('require user id', () => requireUserId());
  const user = await timer.measure('require user row', () => requireUserRow(userId));
  timer.finish('get logged in user total');
  return user;
}

export async function getLoggedInUser(): Promise<UserRow | null> {
  try {
    const userId = await requireUserId();
    return await requireUserRow(userId);
  } catch {
    return null;
  }
}
