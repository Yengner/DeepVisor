'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { reviewProposal } from '@/lib/server/decisions/reviewProposal';

export async function reviewDecisionAction(proposalId: string, choice: 'approve' | 'reject', reviewFingerprint: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(proposalId).success || !['approve', 'reject'].includes(choice) || !z.string().regex(/^[a-f0-9]{64}$/).safeParse(reviewFingerprint).success) return { error: 'Invalid action.' };
  const context = await getRequiredAppContext();
  if (!['owner', 'admin'].includes(context.role)) return { error: 'Only an owner or admin can review actions.' };
  try {
    await reviewProposal(createAdminClient(), { businessId: context.businessId, userId: context.user.id, role: context.role, proposalId, choice, reviewFingerprint });
    revalidatePath('/decisions');
    return {};
  } catch (error) {
    unstable_rethrow(error);
    return { error: 'The action could not be updated. Refresh to check its latest status and try again.' };
  }
}
